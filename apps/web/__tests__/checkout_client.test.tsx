import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { toCheckoutLines } from "../app/(storefront)/_lib/checkout-client";
import { useCheckoutQuote } from "../app/(storefront)/_lib/use-checkout-quote";
import { usePaymentStatus } from "../app/(storefront)/_lib/use-payment-status";

const cart = [
  { product: { id: "oxford-shirt", priceNum: 1 } as never, size: "M", color: "black", quantity: 2 },
  { product: { id: "toaster", priceNum: 9 } as never, size: "", color: "", quantity: 1 },
];

describe("toCheckoutLines", () => {
  it("sends only what to buy and how many, never a price", () => {
    expect(toCheckoutLines(cart)).toEqual([
      { product_slug: "oxford-shirt", size: "M", color: "black", quantity: 2 },
      { product_slug: "toaster", size: undefined, color: undefined, quantity: 1 },
    ]);
    expect(JSON.stringify(toCheckoutLines(cart))).not.toMatch(/price/i);
  });
});

describe("useCheckoutQuote", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const okQuote = { data: { lines: [], subtotal: 3100000, delivery_fees: { door: 150000, pickup: 110000, express: 450000 }, all_available: true } };

  it("asks the server what the cart costs and returns its numbers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(okQuote), { status: 200 }));
    const { result } = renderHook(() => useCheckoutQuote(cart));
    await waitFor(() => expect(result.current.quote?.subtotal).toBe(3100000));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).items).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("reports the server's message when items are unavailable, and no quote", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Some items in your cart are no longer available.", code: "ITEM_UNAVAILABLE" }), { status: 400 }));
    const { result } = renderHook(() => useCheckoutQuote(cart));
    await waitFor(() => expect(result.current.error).toMatch(/no longer available/));
    expect(result.current.quote).toBeNull();
  });

  it("does nothing for an empty cart", () => {
    const { result } = renderHook(() => useCheckoutQuote([]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.quote).toBeNull();
  });

  it("reports an unreachable server", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { result } = renderHook(() => useCheckoutQuote(cart));
    await waitFor(() => expect(result.current.error).toMatch(/couldn't check/i));
  });
});

describe("usePaymentStatus (waits for the webhook, not for the redirect)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const reply = (paid: boolean) => new Response(JSON.stringify({ data: { order_number: "GTS-1", paid, total: 100, items: [] } }), { status: 200 });
  const REF = "gts_11111111-1111-4111-8111-111111111111";

  it("keeps checking while unpaid and stops once paid", async () => {
    fetchMock.mockResolvedValueOnce(reply(false)).mockResolvedValueOnce(reply(false)).mockResolvedValue(reply(true));
    const { result } = renderHook(() => usePaymentStatus(REF, { intervalMs: 1000, giveUpAfterMs: 60_000 }));
    await waitFor(() => expect(result.current.state).toBe("waiting"));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await waitFor(() => expect(result.current.state).toBe("paid"));
    const calls = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(result.current.order?.order_number).toBe("GTS-1");
  });

  it("gives up waiting after a while and says it's still pending, rather than claiming success", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(false)));
    const { result } = renderHook(() => usePaymentStatus(REF, { intervalMs: 1000, giveUpAfterMs: 5000 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    await waitFor(() => expect(result.current.state).toBe("pending"));
  });

  it("reports a missing or unknown reference", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "nf", code: "NOT_FOUND" }), { status: 404 }));
    const { result } = renderHook(() => usePaymentStatus(REF, { intervalMs: 1000, giveUpAfterMs: 5000 }));
    await waitFor(() => expect(result.current.state).toBe("not_found"));
    const none = renderHook(() => usePaymentStatus(null));
    expect(none.result.current.state).toBe("not_found");
  });
});
