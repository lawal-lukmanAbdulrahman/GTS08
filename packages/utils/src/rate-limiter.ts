/**
 * In-Memory Sliding-Window Token-Bucket Rate Limiter
 * Provides edge-speed, serverless-friendly rate limiting for Next.js middleware and API routes.
 *
 * Implements RFC 6585 "429 Too Many Requests" standards with:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 * - Retry-After
 */

export interface RateLimitOptions {
  /**
   * Maximum allowed requests within the time window.
   */
  limit: number;

  /**
   * Time window in milliseconds (e.g. 60_000 for 1 minute).
   */
  windowMs: number;
}

export interface RateLimitResult {
  /**
   * Whether the request is permitted.
   */
  allowed: boolean;

  /**
   * The maximum request ceiling configured for this tier.
   */
  limit: number;

  /**
   * The remaining allowed requests in the current window.
   */
  remaining: number;

  /**
   * Unix timestamp (in seconds) when the window resets.
   */
  resetTime: number;

  /**
   * Number of seconds the client must wait before retrying (if blocked).
   */
  retryAfterSeconds: number;
}

interface WindowRecord {
  timestamps: number[];
  lastPruned: number;
}

// Map of key -> timestamp array representing requests in window
const rateLimitStore = new Map<string, WindowRecord>();
const MAX_TRACKED_KEYS = 10000;

/**
 * Periodically or lazily cleans up expired keys to prevent memory leaks
 */
function pruneStore(now: number, windowMs: number) {
  if (rateLimitStore.size > MAX_TRACKED_KEYS) {
    for (const [key, record] of rateLimitStore.entries()) {
      if (now - record.lastPruned > windowMs * 2) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Checks and consumes a token from the rate limit bucket for a given identifier
 *
 * @param key Unique key, e.g. "ip:192.168.1.1:auth" or "user:usr_123:orders"
 * @param options Rate limit window and quota configuration
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowMs || 60_000;
  const limit = options.limit || 60;
  const windowStart = now - windowMs;

  pruneStore(now, windowMs);

  let record = rateLimitStore.get(key);
  if (!record) {
    record = {
      timestamps: [],
      lastPruned: now,
    };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps to only retain those inside the current sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
  record.lastPruned = now;

  const currentCount = record.timestamps.length;

  if (currentCount >= limit) {
    // Breached rate limit
    const oldestTimestamp = record.timestamps[0] || windowStart;
    const resetTimeMs = oldestTimestamp + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));
    const resetTimeSec = Math.ceil(resetTimeMs / 1000);

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTime: resetTimeSec,
      retryAfterSeconds,
    };
  }

  // Allowed: Record this request
  record.timestamps.push(now);
  const remaining = limit - record.timestamps.length;
  const resetTimeSec = Math.ceil((now + windowMs) / 1000);

  return {
    allowed: true,
    limit,
    remaining,
    resetTime: resetTimeSec,
    retryAfterSeconds: 0,
  };
}

/**
 * Resets a rate limit bucket (useful for testing or manual unlocks)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Clears the entire rate limit store (useful for automated testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
