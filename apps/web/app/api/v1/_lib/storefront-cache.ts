/**
 * Storefront In-Memory High-Performance SWR (Stale-While-Revalidate) Cache
 *
 * Provides sub-millisecond retrieval of ranked products (Trending, Bestselling, Hero, For You),
 * with non-blocking background revalidation so users never wait on heavy database queries.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  staleAt: number;
  revalidating: boolean;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightPromises = new Map<string, Promise<any>>();

// Slug to UUID cache for lightning-fast analytics event ingestion
export const slugToUuidCache = new Map<string, string>();

/**
 * Get cached data or compute it, returning stale data immediately during background revalidation.
 *
 * @param key Unique cache key
 * @param ttlSeconds Seconds until the entry becomes stale (background refresh)
 * @param computeFn Async function that computes/fetches the fresh data
 * @param swrSeconds Seconds to allow serving stale data while background refresh completes
 */
export async function getOrComputeCached<T>(
  key: string,
  ttlSeconds: number,
  computeFn: () => Promise<T>,
  swrSeconds = 300
): Promise<T> {
  const now = Date.now();
  const entry = memoryCache.get(key);

  if (entry) {
    // 1. Fresh hit: instant return (< 1ms)
    if (now < entry.expiresAt) {
      return entry.data;
    }

    // 2. Stale hit (within SWR window): return stale data instantly and trigger background refresh
    if (now < entry.staleAt) {
      if (!entry.revalidating) {
        entry.revalidating = true;
        void computeFn()
          .then((fresh) => {
            memoryCache.set(key, {
              data: fresh,
              timestamp: Date.now(),
              expiresAt: Date.now() + ttlSeconds * 1000,
              staleAt: Date.now() + (ttlSeconds + swrSeconds) * 1000,
              revalidating: false,
            });
          })
          .catch((err) => {
            console.error(`[cache] Background revalidation failed for ${key}:`, err);
            entry.revalidating = false;
          });
      }
      return entry.data;
    }
  }

  // 3. Cache miss or completely expired: dedup concurrent in-flight requests
  const existingPromise = inFlightPromises.get(key);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const computePromise = (async () => {
    try {
      const fresh = await computeFn();
      memoryCache.set(key, {
        data: fresh,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlSeconds * 1000,
        staleAt: Date.now() + (ttlSeconds + swrSeconds) * 1000,
        revalidating: false,
      });
      return fresh;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, computePromise);
  return computePromise;
}

/**
 * Manually invalidate a cache key or prefix
 */
export function invalidateCache(keyOrPrefix: string) {
  for (const key of memoryCache.keys()) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      memoryCache.delete(key);
    }
  }
}
