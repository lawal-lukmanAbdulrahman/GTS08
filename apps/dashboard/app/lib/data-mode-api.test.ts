import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadDataMode, switchDataMode } from "./data-mode-api";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("gts_token", "tok");
});
const reply = (status: number, body: unknown) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("loadDataMode", () => {
  it("reads the mode with the staff token", async () => {
    reply(200, { data: { mode: "test", ready: true } });
    expect(await loadDataMode()).toEqual({ ok: true, mode: "test", ready: true });
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("Authorization")).toBe("Bearer tok");
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/settings\/data-mode$/);
  });
  it("reports isolation as not ready before the migration", async () => {
    reply(200, { data: { mode: null, ready: false } });
    expect(await loadDataMode()).toEqual({ ok: true, mode: null, ready: false });
  });
  it("gives a message when the request fails", async () => {
    reply(403, { error: "Admins only." });
    expect(await loadDataMode()).toEqual({ ok: false, message: "Admins only." });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await loadDataMode()).ok).toBe(false);
  });
});

describe("switchDataMode", () => {
  it("asks for the switch with an explicit confirmation", async () => {
    reply(200, { data: { mode: "live", ready: true } });
    expect(await switchDataMode("live")).toEqual({ ok: true, mode: "live" });
    const init = fetchMock.mock.calls[0]![1];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ mode: "live", confirm: true });
  });
  it("surfaces the reason it was refused", async () => {
    reply(403, { error: "Only the super admin can do this.", code: "SUPER_ADMIN_ONLY" });
    expect(await switchDataMode("test")).toEqual({ ok: false, message: "Only the super admin can do this." });
  });
});
