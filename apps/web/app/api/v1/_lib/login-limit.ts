import { consume, createRateLimitStore, type ConsumeResult } from "@gts/utils";

const store = createRateLimitStore({
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/** Password attempts allowed per account per minute, from anywhere. */
export const LOGIN_ATTEMPTS_PER_MINUTE = 8;

/** Counts one attempt against this account. Targeted guessing is stopped here; the edge only caps each address. */
export function countLoginAttempt(email: string): Promise<ConsumeResult> {
  return consume(store, [{ key: `rl:login-account:${email.trim().toLowerCase()}`, limit: LOGIN_ATTEMPTS_PER_MINUTE, windowMs: 60_000, tier: "auth" }]);
}
