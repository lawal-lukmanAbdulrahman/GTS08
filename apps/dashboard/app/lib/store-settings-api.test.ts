import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadStoreDetails, saveStoreDetails, toReceiptStore } from "./store-settings-api";

const STORE = {
  store_name: "GTS",
  store_address: "12 Allen Avenue, Ikeja, Lagos",
  support_phone: "0803 123 4567",
  whatsapp_number: null,
  support_email: "hello@gts.ng",
};

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("store settings API client", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe("loadStoreDetails", () => {
    it("returns the store details", async () => {
      fetchMock.mockReturnValue(reply(200, { data: STORE }));
      expect(await loadStoreDetails()).toEqual({ ok: true, data: STORE });
      expect(fetchMock.mock.calls[0]![0]).toMatch(/\/api\/v1\/settings$/);
    });

    it("reports a server error with its message", async () => {
      fetchMock.mockReturnValue(reply(500, { error: "boom", code: "DATABASE_ERROR" }));
      expect(await loadStoreDetails()).toEqual({ ok: false, message: "boom" });
    });

    it("reports the server being unreachable", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      const r = await loadStoreDetails();
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/reach the server/i);
    });
  });

  describe("saveStoreDetails", () => {
    it("PATCHes with the staff bearer token and returns the saved details", async () => {
      localStorage.setItem("gts_token", "tok123");
      fetchMock.mockReturnValue(reply(200, { data: STORE }));
      const r = await saveStoreDetails(STORE);
      expect(r).toEqual({ ok: true, saved: STORE });

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toMatch(/\/api\/v1\/settings$/);
      expect(init.method).toBe("PATCH");
      expect(init.headers.Authorization).toBe("Bearer tok123");
      expect(JSON.parse(init.body)).toEqual(STORE);
    });

    it("passes on the server's warning, e.g. that the website couldn't be saved yet", async () => {
      fetchMock.mockReturnValue(reply(200, { data: STORE, warning: "The website couldn't be saved yet." }));
      expect(await saveStoreDetails(STORE)).toEqual({ ok: true, saved: STORE, warning: "The website couldn't be saved yet." });
    });

    it("maps server validation errors onto their fields", async () => {
      fetchMock.mockReturnValue(
        reply(400, {
          error: "Some store details are invalid.",
          code: "VALIDATION_ERROR",
          details: { support_phone: "Phone number can only contain digits." },
        })
      );
      const r = await saveStoreDetails(STORE);
      expect(r).toEqual({
        ok: false,
        message: "Some store details are invalid.",
        fieldErrors: { support_phone: "Phone number can only contain digits." },
      });
    });

    it("explains a permission failure", async () => {
      fetchMock.mockReturnValue(reply(403, { error: "Only admins can change store settings.", code: "FORBIDDEN" }));
      const r = await saveStoreDetails(STORE);
      expect(r).toMatchObject({ ok: false, message: "Only admins can change store settings." });
    });

    it("tells an expired session to sign in again", async () => {
      fetchMock.mockReturnValue(reply(401, { error: "Unauthorized", code: "UNAUTHORIZED" }));
      const r = await saveStoreDetails(STORE);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/sign in again/i);
    });

    it("reports the server being unreachable", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      const r = await saveStoreDetails(STORE);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/reach the server/i);
    });
  });

  describe("toReceiptStore", () => {
    it("maps settings to the receipt header", () => {
      expect(toReceiptStore(STORE)).toEqual({
        name: "GTS",
        address: "12 Allen Avenue, Ikeja, Lagos",
        phone: "0803 123 4567",
      });
    });

    it("omits unset address and phone", () => {
      expect(toReceiptStore({ ...STORE, store_address: null, support_phone: null })).toEqual({
        name: "GTS",
        address: undefined,
        phone: undefined,
      });
    });

    it("falls back to a bare 'GTS' header when settings couldn't be loaded, so a receipt can always print", () => {
      expect(toReceiptStore(null)).toEqual({ name: "GTS" });
    });
  });
});
