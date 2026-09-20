import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { putInventory } from "./inventory-api";

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("putInventory", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
    localStorage.setItem("gts_token", "tok1");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the staff token and the adjustment", async () => {
    fetchMock.mockReturnValue(reply(200, { data: {} }));
    const r = await putInventory("var-1", { adjustment_type: "add", quantity: 3, reason: "restock" });
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/inventory\/var-1$/);
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok1");
    expect(JSON.parse(init.body)).toEqual({ adjustment_type: "add", quantity: 3, reason: "restock" });
  });

  it("returns the server's reason when it refuses", async () => {
    fetchMock.mockReturnValue(reply(403, { error: "You don't have permission to manage inventory. Ask an admin to grant it." }));
    const r = await putInventory("v", { low_stock_threshold: 3 });
    expect(r).toEqual({ ok: false, message: "You don't have permission to manage inventory. Ask an admin to grant it." });
  });

  it("says the session expired on a 401", async () => {
    fetchMock.mockReturnValue(reply(401, { error: "Unauthorized" }));
    const r = await putInventory("v", { low_stock_threshold: 3 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/sign in again/i);
  });

  it("explains a conflict (the count changed underneath)", async () => {
    fetchMock.mockReturnValue(reply(409, { error: "The stock count changed while you were editing it. Reload and try again.", code: "INVENTORY_CHANGED" }));
    const r = await putInventory("v", { adjustment_type: "add", quantity: 1, reason: "x" });
    expect(!r.ok && r.message).toMatch(/changed/i);
  });

  it("copes with a non-JSON error and with being offline", async () => {
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response("<html>", { status: 502 })));
    expect((await putInventory("v", { low_stock_threshold: 1 })).ok).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const r = await putInventory("v", { low_stock_threshold: 1 });
    expect(!r.ok && r.message).toMatch(/reach the server/i);
  });
});
