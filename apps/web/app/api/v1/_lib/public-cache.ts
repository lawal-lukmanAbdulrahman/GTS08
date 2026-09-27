/**
 * The Cache-Control for answers that used to be kept by the shared cache (CDN).
 *
 * They can't be any more: the same URL now answers with demo data for the demo
 * account and live data for everyone else, and the CDN keys its cache on the
 * URL alone, so it would serve one the other's answer (it did: the demo store
 * showed the cached, empty live catalogue). Every call site goes through here,
 * so shared caching can come back in one place if answers are ever keyed per
 * data set.
 */
export async function publicCache(_value: string): Promise<string> {
  return "private, no-store";
}
