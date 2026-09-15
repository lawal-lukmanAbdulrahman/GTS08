import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@gts/database";

// Fallback in-memory cache for ultra-fast deduplication and resilience
interface MemoryIdempotencyEntry {
  key: string;
  endpoint: string;
  requestHash: string;
  statusCode: number | null;
  responseBody: any | null;
  lockedAt: number;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryIdempotencyEntry>();
const MAX_MEMORY_ENTRIES = 5000;
const IN_FLIGHT_TIMEOUT_MS = 30000; // 30 seconds
const TTL_HOURS = 24;

/**
 * Prunes expired or overflow entries from in-memory cache
 */
function pruneMemoryStore() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
  if (memoryStore.size > MAX_MEMORY_ENTRIES) {
    // Delete the oldest 1000 entries
    let count = 0;
    for (const key of memoryStore.keys()) {
      memoryStore.delete(key);
      if (++count >= 1000) break;
    }
  }
}

/**
 * Computes a deterministic SHA-256 hash of the request body or parameters
 */
async function computeRequestHash(req: NextRequest): Promise<{ hash: string; clonedReq: NextRequest }> {
  try {
    const cloned = req.clone();
    const text = await cloned.text();
    const hash = crypto.createHash("sha256").update(text || req.nextUrl.search).digest("hex");
    return { hash, clonedReq: req };
  } catch {
    const hash = crypto.createHash("sha256").update(req.nextUrl.search || "").digest("hex");
    return { hash, clonedReq: req };
  }
}

export type RouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse | Response>;

/**
 * withIdempotency
 * High-performance IETF/Stripe standard wrapper for mutating Next.js route handlers.
 * Prevents double-processing of checkouts, orders, inventory updates, and dashboard mutations.
 */
export function withIdempotency(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: any) => {
    // Only apply idempotency to mutating HTTP methods
    const method = req.method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return handler(req, context);
    }

    // Extract idempotency key from headers
    const rawKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");
    if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length === 0) {
      // No idempotency key provided: pass-through without overhead
      return handler(req, context);
    }

    const idempotencyKey = rawKey.trim().slice(0, 255);
    const endpoint = req.nextUrl.pathname;
    const { hash: requestHash } = await computeRequestHash(req);

    // ── STEP 1: Check In-Memory / Database for Existing Key ──
    const now = Date.now();
    pruneMemoryStore();

    let existingFromDb: any = null;
    let dbAvailable = true;

    try {
      const serviceClient = createServiceClient();
      const { data, error } = await serviceClient
        .from("idempotency_keys")
        .select("*")
        .eq("key", idempotencyKey)
        .maybeSingle();

      if (!error && data) {
        existingFromDb = data;
      }
    } catch {
      dbAvailable = false;
    }

    const existingMemory = memoryStore.get(idempotencyKey);
    const existing = existingFromDb
      ? {
          key: existingFromDb.key,
          endpoint: existingFromDb.endpoint,
          requestHash: existingFromDb.request_hash,
          statusCode: existingFromDb.status_code,
          responseBody: existingFromDb.response_body,
          lockedAt: new Date(existingFromDb.locked_at).getTime(),
          expiresAt: new Date(existingFromDb.expires_at).getTime(),
        }
      : existingMemory;

    // ── STEP 2: Evaluate Existing State ──
    if (existing) {
      // 2a. Key reused with a different payload: reject with 422 Unprocessable Entity
      if (existing.requestHash !== requestHash) {
        return NextResponse.json(
          {
            error: "Idempotency key reused with different request payload.",
            code: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
          },
          {
            status: 422,
            headers: {
              "Idempotency-Key": idempotencyKey,
            },
          }
        );
      }

      // 2b. Previous request completed: return cached response
      if (existing.statusCode !== null && existing.responseBody !== null) {
        return NextResponse.json(existing.responseBody, {
          status: existing.statusCode,
          headers: {
            "Idempotency-Key": idempotencyKey,
            "Idempotent-Replayed": "true",
          },
        });
      }

      // 2c. Previous request is currently in-flight
      const lockAge = now - existing.lockedAt;
      if (lockAge < IN_FLIGHT_TIMEOUT_MS) {
        return NextResponse.json(
          {
            error: "A request with this idempotency key is currently processing. Please wait.",
            code: "IDEMPOTENCY_CONFLICT_IN_FLIGHT",
          },
          {
            status: 409,
            headers: {
              "Idempotency-Key": idempotencyKey,
              "Retry-After": "2",
            },
          }
        );
      }
      // If older than IN_FLIGHT_TIMEOUT_MS, previous worker died or timed out; allow re-execution
    }

    // ── STEP 3: Acquire In-Flight Lock ──
    const lockEntry: MemoryIdempotencyEntry = {
      key: idempotencyKey,
      endpoint,
      requestHash,
      statusCode: null,
      responseBody: null,
      lockedAt: now,
      expiresAt: now + TTL_HOURS * 3600 * 1000,
    };
    memoryStore.set(idempotencyKey, lockEntry);

    if (dbAvailable) {
      try {
        const serviceClient = createServiceClient();
        await serviceClient.from("idempotency_keys").upsert(
          {
            key: idempotencyKey,
            endpoint,
            request_hash: requestHash,
            locked_at: new Date(now).toISOString(),
            expires_at: new Date(now + TTL_HOURS * 3600 * 1000).toISOString(),
          },
          { onConflict: "key" }
        );
      } catch {
        // Fallback continues with memoryStore
      }
    }

    // ── STEP 4: Execute Handler ──
    try {
      const response = await handler(req, context);

      // Clone response to capture status code and body for caching
      const statusCode = response.status;
      let responseBody: any = null;

      try {
        const clonedRes = response.clone();
        const contentType = clonedRes.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          responseBody = await clonedRes.json();
        } else {
          responseBody = { text: await clonedRes.text() };
        }
      } catch {
        responseBody = { ok: response.ok, status: statusCode };
      }

      // ── STEP 5: Cache Completed Response ──
      lockEntry.statusCode = statusCode;
      lockEntry.responseBody = responseBody;
      memoryStore.set(idempotencyKey, lockEntry);

      if (dbAvailable) {
        try {
          const serviceClient = createServiceClient();
          await serviceClient
            .from("idempotency_keys")
            .update({
              status_code: statusCode,
              response_body: responseBody,
              expires_at: new Date(now + TTL_HOURS * 3600 * 1000).toISOString(),
            })
            .eq("key", idempotencyKey);
        } catch {
          // In-memory retains the cached result
        }
      }

      // Add standard Idempotency-Key header to response
      if (response instanceof NextResponse) {
        response.headers.set("Idempotency-Key", idempotencyKey);
        return response;
      }

      const nextRes = new NextResponse(response.body, response);
      nextRes.headers.set("Idempotency-Key", idempotencyKey);
      return nextRes;
    } catch (err) {
      // In case of unhandled error during execution, release lock so subsequent retry can run
      memoryStore.delete(idempotencyKey);
      if (dbAvailable) {
        try {
          const serviceClient = createServiceClient();
          await serviceClient.from("idempotency_keys").delete().eq("key", idempotencyKey);
        } catch {
          // ignore
        }
      }
      throw err;
    }
  };
}
