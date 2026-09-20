import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { sanitizeSafeText, sanitizeUrl } from "@gts/utils";
import type { BroadcastItem } from "../../../../lib/notifications";
import { requireAdmin } from "../_lib/staff-access";
import { serverError } from "../_lib/http";

// ─── File-backed & In-memory broadcast campaigns store ───────────────────────
let broadcastCampaigns: BroadcastItem[] = [];

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "broadcast_campaigns.json");

async function loadCampaignsFromDisk(): Promise<BroadcastItem[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // File doesn't exist or unreadable yet
  }
  return [];
}

async function saveCampaignsToDisk(campaigns: BroadcastItem[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(campaigns, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to persist broadcast campaigns to disk:", err);
  }
}

async function ensureCampaignsLoaded(): Promise<void> {
  const fromDisk = await loadCampaignsFromDisk();
  if (fromDisk && fromDisk.length > 0) {
    broadcastCampaigns = fromDisk;
  }
}

// ─── Per-IP Rate Limiter (sliding window, no external dependency) ─────────────
interface RateLimitWindow {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, Map<string, RateLimitWindow>>();
const RL_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(
  ip: string,
  bucket: string,
  maxPerWindow: number
): { allowed: boolean; retryAfterMs: number } {
  if (!rateLimitStore.has(bucket)) rateLimitStore.set(bucket, new Map());
  const bucketMap = rateLimitStore.get(bucket)!;
  const now = Date.now();
  const entry = bucketMap.get(ip);

  if (!entry || now - entry.windowStart >= RL_WINDOW_MS) {
    bucketMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxPerWindow) {
    const retryAfterMs = RL_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimitResponse(retryAfterMs: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please slow down.", code: "RATE_LIMITED" },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Reset": String(Date.now() + retryAfterMs),
      },
    }
  );
}

// ─── Auto-archive expired broadcasts ─────────────────────────────────────────
function autoArchiveExpired(): void {
  const now = new Date();
  broadcastCampaigns.forEach((b) => {
    if (b.status === "active" && b.expiresAt) {
      if (new Date(b.expiresAt) <= now) {
        b.status = "archived";
        b.isActive = false;
        b.updatedAt = now.toISOString();
      }
    }
  });
}

// ─── Get all active broadcasts (post expiry check) ──────────────────────────
function getActiveBroadcasts(): BroadcastItem[] {
  autoArchiveExpired();
  return broadcastCampaigns.filter((b) => b.status === "active" && b.isActive);
}

// ─── Get the primary active broadcast (post expiry check) ───────────────────
function getActiveBroadcast(): BroadcastItem | null {
  const actives = getActiveBroadcasts();
  return actives[0] || null;
}

// ─── Sanitize expiresAt ───────────────────────────────────────────────────────
function sanitizeExpiresAt(raw: unknown): string | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

// ─── GET /api/v1/broadcast ───────────────────────────────────────────────────
// Serves active broadcast for storefront & full campaigns list for dashboard
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "broadcast_get", 60);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  await ensureCampaignsLoaded();

  try {
    const serviceClient = createServiceClient();
    const { data: slot } = await serviceClient
      .from("content_slots")
      .select("*")
      .eq("slot_key", "promo_banner")
      .maybeSingle();

    // Run expiry check before responding
    autoArchiveExpired();

    // If DB slot exists and is active, and campaigns store is empty, seed from DB slot
    if (slot && slot.is_active && broadcastCampaigns.length === 0) {
      let extraMeta: any = {};
      if (slot.mobile_image_cloudinary_id) {
        try {
          extraMeta = JSON.parse(slot.mobile_image_cloudinary_id);
        } catch {}
      }

      const dbBroadcast: BroadcastItem = {
        id: extraMeta.id || slot.id || "broadcast-default",
        title: slot.headline || "",
        subtitle: slot.subheadline || "",
        imageUrl:
          slot.image_cloudinary_id && slot.image_cloudinary_id.startsWith("http")
            ? slot.image_cloudinary_id
            : "",
        ctaLabel: slot.cta_label || "Visit",
        ctaLink: slot.cta_link || "/shop",
        isActive: slot.is_active ?? true,
        updatedAt: slot.updated_at || new Date().toISOString(),
        designConfig: extraMeta.designConfig,
        status: extraMeta.status || "active",
        createdAt: new Date().toISOString(),
        expiresAt: extraMeta.expiresAt,
        rebroadcastedAt: extraMeta.rebroadcastedAt,
        analytics: extraMeta?.analytics || {
          impressions: 0,
          uniqueVisitors: 0,
          avgAttentionSeconds: 0,
          clicks: 0,
          ctrPct: 0,
          dismissals: 0,
          desktopPct: 50,
          mobilePct: 50,
          retentionBreakdown: { under2s: 0, twoTo5s: 0, fiveTo10s: 0, over10s: 0 },
        },
      };

      broadcastCampaigns.unshift(dbBroadcast);
      await saveCampaignsToDisk(broadcastCampaigns);
    }

    const activeList = getActiveBroadcasts();
    return NextResponse.json({
      data: activeList[0] || null,
      activeBroadcasts: activeList,
      broadcasts: broadcastCampaigns,
    });
  } catch {
    autoArchiveExpired();
    const activeList = getActiveBroadcasts();
    return NextResponse.json({
      data: activeList[0] || null,
      activeBroadcasts: activeList,
      broadcasts: broadcastCampaigns,
    });
  }
}

// ─── DELETE /api/v1/broadcast?id=... ─────────────────────────────────────────
// Deletes a broadcast campaign permanently (auth required, idempotent)
export const DELETE = withIdempotency(async function DELETE(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "broadcast_mutate", 10);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  await ensureCampaignsLoaded();

  try {
    // Only admins manage broadcasts (no development-mode bypass).
    const access = await requireAdmin(request);
    if (!access.ok) return access.response;
    const user = access.user;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing broadcast id", code: "BAD_REQUEST" }, { status: 400 });
    }

    broadcastCampaigns = broadcastCampaigns.filter((b) => b.id !== id);
    await saveCampaignsToDisk(broadcastCampaigns);

    try {
      const serviceClient = createServiceClient();
      await serviceClient.from("content_slots").delete().eq("slot_key", "promo_banner");
    } catch {}

    return NextResponse.json({
      success: true,
      broadcasts: broadcastCampaigns,
      message: "Broadcast deleted successfully",
    });
  } catch (err: any) {
    return serverError(err);
  }
});

// ─── POST /api/v1/broadcast ───────────────────────────────────────────────────
// Admin: configure, activate, disable, archive, rebroadcast, or add broadcasts
export const POST = withIdempotency(async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "broadcast_mutate", 10);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  await ensureCampaignsLoaded();

  try {
    const access = await requireAdmin(request);
    if (!access.ok) return access.response;
    const user = access.user;
    const serviceClient = createServiceClient();

    const body = await request.json();
    const {
      id,
      title,
      subtitle,
      imageUrl,
      ctaLabel,
      ctaLink,
      isActive,
      status,
      action,
      designConfig,
      expiresAt: rawExpiresAt,
      broadcast: incomingBroadcast,
    } = body;

    // Run expiry check on every mutation
    autoArchiveExpired();

    // ── Action: toggle_status (Activate / Disable / Archive) ─────────────────
    if (action === "toggle_status" && id) {
      let target: BroadcastItem | undefined = broadcastCampaigns.find((b) => b.id === id);
      if (!target && incomingBroadcast) {
        target = { ...incomingBroadcast } as BroadcastItem;
        broadcastCampaigns.unshift(target);
      }
      if (target) {
        const validTarget: BroadcastItem = target;
        if (status) {
          validTarget.status = status;
          validTarget.isActive = status === "active";
        } else {
          validTarget.isActive = !validTarget.isActive;
          validTarget.status = validTarget.isActive ? "active" : "disabled";
        }
        validTarget.updatedAt = new Date().toISOString();

        await syncToRealtimeAndDb(serviceClient, validTarget, broadcastCampaigns);

        return NextResponse.json({
          data: validTarget,
          broadcasts: broadcastCampaigns,
          message: `Broadcast updated to ${validTarget.status}`,
        });
      }
    }

    // ── Action: rebroadcast ───────────────────────────────────────────────────
    // Bumps rebroadcastedAt so all users (new & returning) see it again.
    // The storefront derives its dismissal key from id + rebroadcastedAt,
    // so a new timestamp = a fresh dismissal key = everyone sees it again.
    if (action === "rebroadcast" && id) {
      let target: BroadcastItem | undefined = broadcastCampaigns.find((b) => b.id === id);

      // If target not in in-memory store, restore from payload
      if (!target && incomingBroadcast) {
        target = { ...incomingBroadcast } as BroadcastItem;
        broadcastCampaigns.unshift(target);
      } else if (!target) {
        // Fallback: create from top-level body fields if provided
        target = {
          id,
          title: title || "",
          subtitle: subtitle || "",
          imageUrl: imageUrl || "",
          ctaLabel: ctaLabel || "Visit",
          ctaLink: ctaLink || "/shop",
          isActive: true,
          status: "active",
          designConfig: designConfig,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: sanitizeExpiresAt(rawExpiresAt),
          rebroadcastedAt: new Date().toISOString(),
          analytics: {
            impressions: 0,
            uniqueVisitors: 0,
            avgAttentionSeconds: 0,
            clicks: 0,
            ctrPct: 0,
            dismissals: 0,
            desktopPct: 50,
            mobilePct: 50,
            retentionBreakdown: { under2s: 0, twoTo5s: 0, fiveTo10s: 0, over10s: 0 },
          },
        };
        broadcastCampaigns.unshift(target);
      }

      if (!target) {
        return NextResponse.json({ error: "Broadcast target not found", code: "NOT_FOUND" }, { status: 404 });
      }

      const validTarget: BroadcastItem = target;
      const now = new Date().toISOString();
      validTarget.rebroadcastedAt = now;
      validTarget.updatedAt = now;
      validTarget.status = "active";
      validTarget.isActive = true;
      if (title !== undefined) validTarget.title = sanitizeSafeText(title, 120);
      if (subtitle !== undefined) validTarget.subtitle = sanitizeSafeText(subtitle, 300);
      if (imageUrl !== undefined) validTarget.imageUrl = sanitizeUrl(imageUrl, "");
      if (ctaLabel !== undefined) validTarget.ctaLabel = sanitizeSafeText(ctaLabel, 50);
      if (ctaLink !== undefined) validTarget.ctaLink = sanitizeUrl(ctaLink, "/shop");
      if (designConfig) validTarget.designConfig = designConfig;

      await syncToRealtimeAndDb(serviceClient, validTarget, broadcastCampaigns);

      return NextResponse.json({
        data: validTarget,
        broadcasts: broadcastCampaigns,
        message: "Broadcast rebroadcasted successfully — all users will see it again.",
      });
    }

    // ── Default: Create or Update broadcast ──────────────────────────────────
    const sanitizedExpiresAt = sanitizeExpiresAt(rawExpiresAt);

    const currentActive = getActiveBroadcast();
    const sanitizedTitle = title !== undefined ? sanitizeSafeText(title, 120) : (currentActive?.title || "");
    const sanitizedSubtitle = subtitle !== undefined ? sanitizeSafeText(subtitle, 300) : (currentActive?.subtitle || "");
    const sanitizedCtaLabel = ctaLabel !== undefined ? sanitizeSafeText(ctaLabel, 50) : "Visit";
    const sanitizedCtaLink = ctaLink !== undefined ? sanitizeUrl(ctaLink, "/shop") : "/shop";
    const sanitizedImageUrl = imageUrl
      ? sanitizeUrl(imageUrl, currentActive?.imageUrl || "")
      : imageUrl === ""
      ? ""
      : currentActive?.imageUrl || "";

    const targetId = id || "broadcast-" + Date.now();
    const existingIndex = broadcastCampaigns.findIndex((b) => b.id === targetId);
    const existing = existingIndex >= 0 ? broadcastCampaigns[existingIndex] : null;

    const isTargetActive = isActive !== undefined ? Boolean(isActive) : true;
    const targetStatus = status || (isTargetActive ? "active" : "disabled");

    const updatedItem: BroadcastItem = {
      id: targetId,
      title: sanitizedTitle,
      subtitle: sanitizedSubtitle,
      imageUrl: sanitizedImageUrl,
      ctaLabel: sanitizedCtaLabel,
      ctaLink: sanitizedCtaLink,
      isActive: isTargetActive,
      status: targetStatus,
      designConfig: designConfig || existing?.designConfig,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: sanitizedExpiresAt ?? existing?.expiresAt,
      rebroadcastedAt: existing?.rebroadcastedAt,
      analytics: existing
        ? existing.analytics
        : {
            impressions: 0,
            uniqueVisitors: 0,
            avgAttentionSeconds: 0,
            clicks: 0,
            ctrPct: 0,
            dismissals: 0,
            desktopPct: 50,
            mobilePct: 50,
            retentionBreakdown: { under2s: 0, twoTo5s: 0, fiveTo10s: 0, over10s: 0 },
          },
    };

    if (existingIndex >= 0) {
      broadcastCampaigns[existingIndex] = updatedItem;
    } else {
      broadcastCampaigns.unshift(updatedItem);
    }

    await syncToRealtimeAndDb(serviceClient, updatedItem, broadcastCampaigns);

    return NextResponse.json({
      data: updatedItem,
      broadcasts: broadcastCampaigns,
      message: "Broadcast notification updated successfully",
    });
  } catch (err: any) {
    return serverError(err);
  }
});

// ─── Shared: Persist to DB + Disk + push Realtime event ──────────────────────
async function syncToRealtimeAndDb(
  serviceClient: ReturnType<typeof createServiceClient>,
  item: BroadcastItem,
  allCampaigns: BroadcastItem[]
): Promise<void> {
  // 1. Persist entire list to disk
  await saveCampaignsToDisk(allCampaigns);

  // 2. Persist active item to content_slots
  try {
    await serviceClient.from("content_slots").upsert(
      {
        slot_key: "promo_banner",
        headline: item.title,
        subheadline: item.subtitle,
        image_cloudinary_id: item.imageUrl || "",
        mobile_image_cloudinary_id: JSON.stringify({
          id: item.id,
          status: item.status,
          rebroadcastedAt: item.rebroadcastedAt,
          expiresAt: item.expiresAt,
          designConfig: item.designConfig,
          analytics: item.analytics,
        }),
        cta_label: item.ctaLabel,
        cta_link: item.ctaLink,
        is_active: item.isActive,
        updated_at: item.updatedAt,
      },
      { onConflict: "slot_key" }
    );
  } catch (e) {
    console.warn("DB content_slots persistence warning:", e);
  }

  // 3. Push Realtime event to all connected storefront clients
  try {
    const channel = serviceClient.channel("storefront_broadcast");
    await new Promise<void>((resolve) => {
      channel.subscribe(async (subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          try {
            await channel.send({
              type: "broadcast",
              event: "broadcast_updated",
              // Send FULL item so storefront gets designConfig + rebroadcastedAt
              payload: item,
            });
          } catch {}
          setTimeout(() => {
            serviceClient.removeChannel(channel);
            resolve();
          }, 300);
        } else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT") {
          resolve();
        }
      });
      setTimeout(resolve, 1200);
    });
  } catch {
    // Ignore realtime send failure
  }
}
