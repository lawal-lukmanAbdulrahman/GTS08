import { describe, it, expect, vi, beforeEach } from "vitest";
import { demoLoginAvailable, signInToDemo, storeSignIn } from "./demo-login";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  document.cookie = "gts_access_token=; max-age=0; path=/";
});
const ok = (body: unknown) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
const SIGNED_IN = { session: { access_token: "at", refresh_token: "rt", expires_at: 9 }, user: { id: "d1", email: "demo@gts.ng", role: "admin", is_demo: true }, permissions: null };

describe("demoLoginAvailable", () => {
  it("is true only when the server offers the demo", async () => {
    ok({ data: { enabled: true } });
    expect(await demoLoginAvailable()).toBe(true);
    ok({ data: { enabled: false } });
    expect(await demoLoginAvailable()).toBe(false);
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await demoLoginAvailable()).toBe(false);
  });
});

describe("signInToDemo", () => {
  it("signs in and stores the session exactly like a normal sign-in", async () => {
    ok({ data: SIGNED_IN });
    expect(await signInToDemo()).toEqual({ ok: true, home: "/admin" });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/v1/auth/demo-login");
    expect(fetchMock.mock.calls[0]![1].method).toBe("POST");
    expect(localStorage.getItem("gts_token")).toBe("at");
    expect(JSON.parse(localStorage.getItem("gts_user")!)).toMatchObject({ is_demo: true });
    expect(document.cookie).toContain("gts_access_token=at");
    expect(document.cookie).toContain("gts_user_role=admin");
  });

  it("reports why it failed", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "The demo account hasn't been set up yet." }), { status: 503 }));
    expect(await signInToDemo()).toEqual({ ok: false, message: "The demo account hasn't been set up yet." });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await signInToDemo()).ok).toBe(false);
  });
});

describe("storeSignIn", () => {
  it("sends each role to its own screen", () => {
    expect(storeSignIn({ ...SIGNED_IN, user: { ...SIGNED_IN.user, role: "cashier" } })).toBe("/pos");
    expect(storeSignIn({ ...SIGNED_IN, user: { ...SIGNED_IN.user, role: "inventory_staff" } })).toBe("/inventory");
    expect(storeSignIn(SIGNED_IN)).toBe("/admin");
  });
});
