import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authFetch, authHeader, goToPasswordChange, clearSession, getSessionUser, reauthenticate, signOut, signOutMessage } from "./session";

function setCookie(name: string) {
  document.cookie = `${name}=x; path=/`;
}
const hasCookie = (name: string) => document.cookie.split("; ").some((c) => c.startsWith(`${name}=`));

describe("session", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { signed_out: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
    setCookie("gts_access_token");
    setCookie("gts_user_role");
  });
  afterEach(() => vi.unstubAllGlobals());

  describe("getSessionUser", () => {
    it("reads the signed-in user saved at login", () => {
      localStorage.setItem("gts_user", JSON.stringify({ id: "u1", email: "ada@gts.ng", full_name: "Ada", role: "cashier" }));
      expect(getSessionUser()).toMatchObject({ id: "u1", full_name: "Ada", role: "cashier" });
    });
    it("is null when nobody is signed in", () => {
      expect(getSessionUser()).toBeNull();
    });
    it("is null (not a crash) when the saved value is corrupted", () => {
      localStorage.setItem("gts_user", "{not json");
      expect(getSessionUser()).toBeNull();
    });
  });

  describe("clearSession", () => {
    it("removes the token, the saved user and both cookies the middleware reads", () => {
      localStorage.setItem("gts_token", "tok");
      localStorage.setItem("gts_user", "{}");
      clearSession();
      expect(localStorage.getItem("gts_token")).toBeNull();
      expect(localStorage.getItem("gts_user")).toBeNull();
      expect(hasCookie("gts_access_token")).toBe(false);
      expect(hasCookie("gts_user_role")).toBe(false);
    });

    it("leaves unrelated storage alone (e.g. the receipt paper choice)", () => {
      localStorage.setItem("gts_receipt_paper", "58mm");
      clearSession();
      expect(localStorage.getItem("gts_receipt_paper")).toBe("58mm");
    });
  });

  describe("signOut", () => {
    it("tells the server to revoke this session, using the token, before clearing it", async () => {
      localStorage.setItem("gts_token", "tok123");
      const navigate = vi.fn();
      await signOut({ navigate });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toMatch(/\/api\/v1\/auth\/logout$/);
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer tok123");
      expect(localStorage.getItem("gts_token")).toBeNull();
    });

    it("sends the user to the login page", async () => {
      const navigate = vi.fn();
      await signOut({ navigate });
      expect(navigate).toHaveBeenCalledWith("/login");
    });

    it("tells the login page why, so it can explain", async () => {
      const navigate = vi.fn();
      await signOut({ navigate, reason: "blocked" });
      expect(navigate).toHaveBeenCalledWith("/login?reason=blocked");
    });

    it("still clears the session and navigates if the server can't be reached", async () => {
      localStorage.setItem("gts_token", "tok");
      fetchMock.mockRejectedValue(new TypeError("network"));
      const navigate = vi.fn();
      await signOut({ navigate });
      expect(localStorage.getItem("gts_token")).toBeNull();
      expect(navigate).toHaveBeenCalledWith("/login");
    });

    it("doesn't call the server for a session that's already gone (expired/blocked)", async () => {
      const navigate = vi.fn();
      await signOut({ navigate, reason: "expired", revoke: false });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith("/login?reason=expired");
    });
  });
});

describe("signOutMessage", () => {
  it("explains a suspended account", () => {
    expect(signOutMessage("blocked")).toMatch(/suspended/i);
  });
  it("explains an expired session", () => {
    expect(signOutMessage("expired")).toMatch(/expired.*sign in again/i);
  });
  it("explains an idle sign-out", () => {
    expect(signOutMessage("idle")).toMatch(/inactiv/i);
  });
  it("says nothing for a normal sign-out or an unknown reason", () => {
    expect(signOutMessage(null)).toBeNull();
    expect(signOutMessage("whatever")).toBeNull();
  });
});

describe("reauthenticate (unlocking an idle till)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("checks the password against the login endpoint for the signed-in account", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { session: { access_token: "fresh" }, user: { id: "u1" } } }), { status: 200 }));
    const r = await reauthenticate("ada@gts.ng", "Secret123!");
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(init.body)).toEqual({ email: "ada@gts.ng", password: "Secret123!" });
  });

  it("swaps in the fresh session token", async () => {
    localStorage.setItem("gts_token", "old");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { session: { access_token: "fresh" }, user: {} } }), { status: 200 }));
    await reauthenticate("ada@gts.ng", "Secret123!");
    expect(localStorage.getItem("gts_token")).toBe("fresh");
    expect(document.cookie).toContain("gts_access_token=fresh");
  });

  it("refuses a wrong password and leaves the existing session untouched", async () => {
    localStorage.setItem("gts_token", "old");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Invalid email address or password.", code: "UNAUTHORIZED" }), { status: 401 }));
    const r = await reauthenticate("ada@gts.ng", "wrong");
    expect(r).toEqual({ ok: false, message: "That password isn't right. Try again." });
    expect(localStorage.getItem("gts_token")).toBe("old");
  });

  it("reports a suspended account", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "suspended", code: "FORBIDDEN" }), { status: 403 }));
    const r = await reauthenticate("ada@gts.ng", "x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/suspended/i);
  });

  it("reports the server being unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));
    const r = await reauthenticate("ada@gts.ng", "x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/reach the server/i);
  });
});

describe("clearSession also clears parked sales", () => {
  it("removes every held-sales key", () => {
    localStorage.setItem("gts_held_sales:a", "[]");
    localStorage.setItem("gts_held_sales:b", "[]");
    localStorage.setItem("unrelated", "keep");
    clearSession();
    expect(localStorage.getItem("gts_held_sales:a")).toBeNull();
    expect(localStorage.getItem("gts_held_sales:b")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
});

describe("authFetch", () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("adds the bearer token and keeps the caller's other headers and options", async () => {
    localStorage.setItem("gts_token", "tok9");
    await authFetch("/api/v1/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/x");
    expect(init.method).toBe("POST");
    const h = new Headers(init.headers);
    expect(h.get("authorization")).toBe("Bearer tok9");
    expect(h.get("content-type")).toBe("application/json");
  });

  it("sends no Authorization header when signed out", async () => {
    await authFetch("/api/v1/x");
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).has("authorization")).toBe(false);
  });

  it("does not overwrite an Authorization header the caller chose", async () => {
    localStorage.setItem("gts_token", "tok9");
    await authFetch("/api/v1/x", { headers: { Authorization: "Bearer other" } });
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("authorization")).toBe("Bearer other");
  });
});

describe("authHeader", () => {
  beforeEach(() => localStorage.clear());
  it("is the bearer header when signed in, and empty when not", () => {
    expect(authHeader()).toEqual({});
    localStorage.setItem("gts_token", "t1");
    expect(authHeader()).toEqual({ Authorization: "Bearer t1" });
  });
});

describe("goToPasswordChange", () => {
  it("navigates to the profile", () => {
    const navigate = vi.fn();
    goToPasswordChange(navigate);
    expect(navigate).toHaveBeenCalledWith("/profile");
  });
});
