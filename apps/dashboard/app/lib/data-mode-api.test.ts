import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadDataMode } from "./data-mode-api";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("gts_token", "tok");
});
const reply = (status: number, body: unknown) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("loadDataMode", () => {
  it("reads which data this account sees, with the staff token", async () => {
    reply(200, { data: { mode: "test" } });
    expect(await loadDataMode()).toEqual({ ok: true, mode: "test" });
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("Authorization")).toBe("Bearer tok");
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/v1/settings/data-mode");
  });
  it("gives a message when the request fails", async () => {
    reply(403, { error: "Admins only." });
    expect(await loadDataMode()).toEqual({ ok: false, message: "Admins only." });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await loadDataMode()).ok).toBe(false);
  });
});
