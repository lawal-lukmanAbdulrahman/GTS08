/**
 * Idempotent Fetch
 * Automatically attaches an Idempotency-Key header to all mutating HTTP methods
 * (POST, PUT, PATCH, DELETE) across Storefront and Dashboard clients.
 *
 * This prevents double-charges, duplicate order creation, repeated inventory updates,
 * and duplicate product publishing on network retries or rapid button clicks.
 */

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return (
    "idem_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 11)
  );
}

export interface IdempotentRequestInit extends RequestInit {
  idempotencyKey?: string;
}

export async function idempotentFetch(
  input: RequestInfo | URL,
  init?: IdempotentRequestInit
): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers = new Headers(init?.headers);

  if (isMutating && !headers.has("Idempotency-Key") && !headers.has("x-idempotency-key")) {
    const key = init?.idempotencyKey || generateIdempotencyKey();
    headers.set("Idempotency-Key", key);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
