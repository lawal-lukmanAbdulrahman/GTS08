import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSignOut = vi.fn();
vi.mock("./session", async (importActual) => ({
  ...(await importActual<typeof import("./session")>()),
  signOut: (...a: unknown[]) => mockSignOut(...a),
}));

import { apiCall } from "./staff-api";

const reply = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("apiCall", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    mockSignOut.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
    localStorage.setItem("gts_token", "tok123");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the staff bearer token to the API", async () => {
    fetchMock.mockReturnValue(reply(200, { data: { hello: 1 } }));
    const r = await apiCall<{ hello: number }>("/staff/me");
    expect(r).toEqual({ ok: true, status: 200, data: { hello: 1 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/v1/staff/me");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("sends a JSON body with the right header", async () => {
    fetchMock.mockReturnValue(reply(200, { data: {} }));
    await apiCall("/pos/orders", { method: "POST", json: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
  });

  it("returns the server's message, code and field details on a failure", async () => {
    fetchMock.mockReturnValue(reply(400, { error: "Fix it", code: "VALIDATION_ERROR", details: { phone: "bad" } }));
    expect(await apiCall("/staff/me", { method: "PATCH", json: {} })).toEqual({
      ok: false,
      status: 400,
      message: "Fix it",
      code: "VALIDATION_ERROR",
      details: { phone: "bad" },
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("signs out (without a pointless server call) when the session has expired", async () => {
    fetchMock.mockReturnValue(reply(401, { error: "Unauthorized", code: "UNAUTHORIZED" }));
    const r = await apiCall("/staff/me");
    expect(r.ok).toBe(false);
    expect(mockSignOut).toHaveBeenCalledWith({ reason: "expired", revoke: false });
  });

  it("signs a blocked account out and says why", async () => {
    fetchMock.mockReturnValue(reply(403, { error: "Your account access has been suspended.", code: "ACCOUNT_BLOCKED" }));
    await apiCall("/pos/products/search");
    expect(mockSignOut).toHaveBeenCalledWith({ reason: "blocked", revoke: false });
  });

  it("does NOT sign out for an ordinary permission refusal", async () => {
    fetchMock.mockReturnValue(reply(403, { error: "no", code: "PERMISSION_DENIED" }));
    const r = await apiCall("/pos/orders/x/void", { method: "PUT", json: {} });
    expect(r).toMatchObject({ ok: false, status: 403, code: "PERMISSION_DENIED" });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("does NOT sign out for a wrong current password (a 400, not a 401)", async () => {
    fetchMock.mockReturnValue(reply(400, { error: "Your current password is incorrect.", code: "CURRENT_PASSWORD_INCORRECT" }));
    await apiCall("/staff/me/password", { method: "POST", json: {} });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("reports the server being unreachable without signing anyone out", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const r = await apiCall("/staff/me");
    expect(r).toMatchObject({ ok: false, status: 0 });
    if (!r.ok) expect(r.message).toMatch(/reach the server/i);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("copes with a response that isn't JSON", async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response("<html>oops</html>", { status: 502 })));
    const r = await apiCall("/staff/me");
    expect(r).toMatchObject({ ok: false, status: 502 });
  });
});
