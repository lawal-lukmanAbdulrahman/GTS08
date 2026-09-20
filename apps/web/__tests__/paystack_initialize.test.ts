// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initializePayment } from "../app/api/v1/_lib/paystack";

const ARGS = { email: "buyer@example.com", amountKobo: 3250000, reference: "gts_abc", callbackUrl: "https://gts.ng/checkout/complete", metadata: { order_number: "GTS-1" } };

describe("initializePayment (asks Paystack for the page the customer pays on)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.PAYSTACK_SECRET_KEY = "sk_test_123";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  it("sends the exact amount in kobo and our reference, signed with the secret key", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/x", reference: "gts_abc" } }), { status: 200 }));
    const out = await initializePayment(ARGS);
    expect(out).toEqual({ ok: true, authorizationUrl: "https://checkout.paystack.com/x" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer sk_test_123" });
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ email: "buyer@example.com", amount: 3250000, reference: "gts_abc", currency: "NGN", callback_url: "https://gts.ng/checkout/complete" });
  });

  it("says it isn't configured, without calling out, when there is no secret key", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    expect(await initializePayment(ARGS)).toEqual({ ok: false, reason: "NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a refusal or an unreachable Paystack as a failure, never throwing", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: false, message: "Invalid key" }), { status: 401 }));
    expect(await initializePayment(ARGS)).toEqual({ ok: false, reason: "REJECTED" });
    fetchMock.mockRejectedValue(new TypeError("network"));
    expect(await initializePayment(ARGS)).toEqual({ ok: false, reason: "UNREACHABLE" });
  });

  it("refuses a response with no payment page", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: true, data: {} }), { status: 200 }));
    expect(await initializePayment(ARGS)).toEqual({ ok: false, reason: "REJECTED" });
  });

  it("only accepts an https payment page from Paystack", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: true, data: { authorization_url: "javascript:alert(1)" } }), { status: 200 }));
    expect(await initializePayment(ARGS)).toEqual({ ok: false, reason: "REJECTED" });
  });
});
