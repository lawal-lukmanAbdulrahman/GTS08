import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { createServiceClient } from "@gts/database";
import type { BroadcastItem } from "../../../../../lib/notifications";

// ─── Rate Limiter (sliding window, max 120 analytics pings/min per IP) ─────────
const rlStore = new Map<string, { count: number; windowStart: number }>();
const RL_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rlStore.get(ip);
  if (!entry || now - entry.windowStart >= RL_WINDOW_MS) {
    rlStore.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= 120) {
    return true;
  }
  entry.count++;
  return false;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ─── Campaigns Store Disk Persistence ─────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "broadcast_campaigns.json");

async function loadCampaignsFromDisk(): Promise<BroadcastItem[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

async function saveCampaignsToDisk(campaigns: BroadcastItem[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(campaigns, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to persist analytics update to disk:", err);
  }
}

// ─── In-memory Internal Statistics for Exact Analytics Calculation ────────────
interface AnalyticsInternalState {
  visitors: Set<string>;
  mobileCount: number;
  desktopCount: number;
  attentionSum: number;
  attentionCount: number;
  retentionCounts: {
    under2s: number;
    twoTo5s: number;
    fiveTo10s: number;
    over10s: number;
  };
}

const internalStatsMap = new Map<string, AnalyticsInternalState>();

function getOrCreateInternalStats(campaign: BroadcastItem): AnalyticsInternalState {
  let stats = internalStatsMap.get(campaign.id);
  if (!stats) {
    const a = campaign.analytics || {
      impressions: 0,
      uniqueVisitors: 0,
      avgAttentionSeconds: 0,
      clicks: 0,
      ctrPct: 0,
      dismissals: 0,
      desktopPct: 50,
      mobilePct: 50,
      retentionBreakdown: { under2s: 0, twoTo5s: 0, fiveTo10s: 0, over10s: 0 },
    };

    const initialAttentionCount = Math.max(a.clicks + a.dismissals, a.avgAttentionSeconds > 0 ? 1 : 0);
    stats = {
      visitors: new Set<string>(),
      mobileCount: a.impressions > 0 ? Math.round((a.impressions * (a.mobilePct || 50)) / 100) : 0,
      desktopCount: a.impressions > 0 ? Math.round((a.impressions * (a.desktopPct || 50)) / 100) : 0,
      attentionSum: a.avgAttentionSeconds * initialAttentionCount,
      attentionCount: initialAttentionCount,
      retentionCounts: {
        under2s: Math.round(((a.retentionBreakdown?.under2s || 0) * initialAttentionCount) / 100),
        twoTo5s: Math.round(((a.retentionBreakdown?.twoTo5s || 0) * initialAttentionCount) / 100),
        fiveTo10s: Math.round(((a.retentionBreakdown?.fiveTo10s || 0) * initialAttentionCount) / 100),
        over10s: Math.round(((a.retentionBreakdown?.over10s || 0) * initialAttentionCount) / 100),
      },
    };
    internalStatsMap.set(campaign.id, stats);
  }
  return stats;
}

// ─── POST /api/v1/broadcast/analytics ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: any;
  try {
    const text = await request.text();
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, event, attentionSeconds, device, visitorId } = body;

  // Strict validation
  if (!id || typeof id !== "string" || id.length > 100) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!event || !["impression", "click", "dismiss"].includes(event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const cleanAttention =
    typeof attentionSeconds === "number" && !isNaN(attentionSeconds) && isFinite(attentionSeconds)
      ? Math.min(600, Math.max(0.1, attentionSeconds))
      : undefined;

  const cleanDevice: "mobile" | "desktop" = device === "mobile" ? "mobile" : "desktop";
  const cleanVisitorId = typeof visitorId === "string" && visitorId.trim() ? visitorId.trim().slice(0, 64) : null;

  // Load campaigns store
  const campaigns = await loadCampaignsFromDisk();
  let campaign = campaigns.find((c) => c.id === id);

  // If not found in disk, attempt to lookup active slot from Supabase content_slots
  if (!campaign) {
    try {
      const serviceClient = createServiceClient();
      const { data: slot } = await serviceClient
        .from("content_slots")
        .select("*")
        .eq("slot_key", "promo_banner")
        .maybeSingle();

      if (slot) {
        let meta: any = {};
        if (slot.mobile_image_cloudinary_id) {
          try {
            meta = JSON.parse(slot.mobile_image_cloudinary_id);
          } catch {}
        }
        if (slot.id === id || meta.id === id) {
          campaign = {
            id,
            title: slot.headline || "",
            subtitle: slot.subheadline || "",
            imageUrl: slot.image_cloudinary_id || "",
            ctaLabel: slot.cta_label || "Visit",
            ctaLink: slot.cta_link || "/shop",
            isActive: slot.is_active ?? true,
            status: meta.status || "active",
            createdAt: new Date().toISOString(),
            updatedAt: slot.updated_at || new Date().toISOString(),
            rebroadcastedAt: meta.rebroadcastedAt,
            expiresAt: meta.expiresAt,
            designConfig: meta.designConfig,
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
          campaigns.push(campaign);
        }
      }
    } catch {}
  }

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (!campaign.analytics) {
    campaign.analytics = {
      impressions: 0,
      uniqueVisitors: 0,
      avgAttentionSeconds: 0,
      clicks: 0,
      ctrPct: 0,
      dismissals: 0,
      desktopPct: 50,
      mobilePct: 50,
      retentionBreakdown: { under2s: 0, twoTo5s: 0, fiveTo10s: 0, over10s: 0 },
    };
  }

  const stats = getOrCreateInternalStats(campaign);

  // ── 1. Process Event ────────────────────────────────────────────────────────
  if (event === "impression") {
    campaign.analytics.impressions++;

    if (cleanVisitorId) {
      stats.visitors.add(cleanVisitorId);
      campaign.analytics.uniqueVisitors = Math.max(campaign.analytics.uniqueVisitors, stats.visitors.size);
    } else {
      campaign.analytics.uniqueVisitors++;
    }

    if (cleanDevice === "mobile") {
      stats.mobileCount++;
    } else {
      stats.desktopCount++;
    }

    const totalDev = stats.mobileCount + stats.desktopCount;
    if (totalDev > 0) {
      campaign.analytics.mobilePct = Math.round((stats.mobileCount / totalDev) * 100);
      campaign.analytics.desktopPct = 100 - campaign.analytics.mobilePct;
    }
  } else if (event === "click") {
    campaign.analytics.clicks++;
  } else if (event === "dismiss") {
    campaign.analytics.dismissals++;
  }

  // Always keep CTR% mathematically accurate
  campaign.analytics.ctrPct =
    Math.round(((campaign.analytics.clicks / Math.max(1, campaign.analytics.impressions)) * 100) * 10) / 10;

  // ── 2. Update Attention Metrics (if duration provided on close/click) ────────
  if (cleanAttention !== undefined) {
    stats.attentionSum += cleanAttention;
    stats.attentionCount++;
    campaign.analytics.avgAttentionSeconds =
      Math.round((stats.attentionSum / Math.max(1, stats.attentionCount)) * 10) / 10;

    if (cleanAttention < 2) {
      stats.retentionCounts.under2s++;
    } else if (cleanAttention < 5) {
      stats.retentionCounts.twoTo5s++;
    } else if (cleanAttention < 10) {
      stats.retentionCounts.fiveTo10s++;
    } else {
      stats.retentionCounts.over10s++;
    }

    const totalRetention =
      stats.retentionCounts.under2s +
      stats.retentionCounts.twoTo5s +
      stats.retentionCounts.fiveTo10s +
      stats.retentionCounts.over10s;

    if (totalRetention > 0) {
      campaign.analytics.retentionBreakdown = {
        under2s: Math.round((stats.retentionCounts.under2s / totalRetention) * 100),
        twoTo5s: Math.round((stats.retentionCounts.twoTo5s / totalRetention) * 100),
        fiveTo10s: Math.round((stats.retentionCounts.fiveTo10s / totalRetention) * 100),
        over10s: Math.round((stats.retentionCounts.over10s / totalRetention) * 100),
      };
    }
  }

  campaign.updatedAt = new Date().toISOString();

  // ── 3. Persist to Disk ───────────────────────────────────────────────────────
  await saveCampaignsToDisk(campaigns);

  // ── 4. Async Sync to DB & Supabase Realtime (non-blocking) ───────────────────
  try {
    const serviceClient = createServiceClient();

    // Persist active analytics into content_slots
    serviceClient
      .from("content_slots")
      .update({
        updated_at: campaign.updatedAt,
        mobile_image_cloudinary_id: JSON.stringify({
          id: campaign.id,
          status: campaign.status,
          rebroadcastedAt: campaign.rebroadcastedAt,
          expiresAt: campaign.expiresAt,
          designConfig: campaign.designConfig,
          analytics: campaign.analytics,
        }),
      })
      .eq("slot_key", "promo_banner")
      .then(() => {}, () => {});

    // Broadcast Realtime update to connected admin dashboard
    const channel = serviceClient.channel("storefront_broadcast");
    channel.subscribe((subStatus) => {
      if (subStatus === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event: "broadcast_analytics_updated",
            payload: {
              id: campaign.id,
              analytics: campaign.analytics,
            },
          })
          .then(() => {
            setTimeout(() => serviceClient.removeChannel(channel), 200);
          })
          .catch(() => {});
      }
    });
  } catch {}

  return NextResponse.json({
    success: true,
    analytics: campaign.analytics,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
