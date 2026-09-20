export type InitializeResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; reason: "NOT_CONFIGURED" | "REJECTED" | "UNREACHABLE" };

const INITIALIZE_URL = "https://api.paystack.co/transaction/initialize";
const TIMEOUT_MS = 10_000;

/**
 * Starts a payment with Paystack and returns the page the customer pays on.
 * The amount is in kobo and comes from the order the server priced. Paying
 * doesn't mark anything paid: only the signed webhook does that.
 */
export async function initializePayment(o: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) return { ok: false, reason: "NOT_CONFIGURED" };

  let res: Response;
  try {
    res = await fetch(INITIALIZE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: o.email,
        amount: o.amountKobo,
        currency: "NGN",
        reference: o.reference,
        callback_url: o.callbackUrl,
        metadata: o.metadata,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "UNREACHABLE" };
  }

  const body = (await res.json().catch(() => null)) as { status?: boolean; data?: { authorization_url?: string } } | null;
  const url = body?.data?.authorization_url;
  if (!res.ok || !body?.status || typeof url !== "string" || !/^https:\/\//i.test(url)) return { ok: false, reason: "REJECTED" };
  return { ok: true, authorizationUrl: url };
}
