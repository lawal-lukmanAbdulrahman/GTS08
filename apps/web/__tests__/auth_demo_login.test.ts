// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { currentDataModeOverride } from "../../../packages/database/src/data-scope";

vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));
const logged: Array<{ entry: unknown; mode: string | undefined }> = [];
vi.mock("../app/api/v1/_lib/activity", () => ({
  logActivity: async (_c: unknown, entry: unknown) => { logged.push({ entry, mode: currentDataModeOverride() }); },
  clientIp: (r: { headers: Headers }) => r.headers.get("x-forwarded-for"),
}));

let demoRow: { data: unknown; error: unknown };
let permissions: { data: unknown; error: unknown };
const generateLink = vi.fn();
const verifyOtp = vi.fn();
const tableCalls: Array<{ table: string; method: string; args: unknown[] }> = [];
vi.mock("@gts/database", async () => {
  const scope = await import("../../../packages/database/src/data-scope");
  return {
    runWithDataMode: scope.runWithDataMode,
    createServerClient: async () => ({ auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a) } }),
    createServiceClient: () => ({
      auth: { admin: { generateLink: (...a: unknown[]) => generateLink(...a) } },
      from: (table: string) => {
        const stub: any = new Proxy({}, {
          get(_t, prop: string) {
            return (...args: unknown[]) => {
              tableCalls.push({ table, method: prop, args });
              if (prop === "maybeSingle") return Promise.resolve(table === "users" ? demoRow : permissions);
              return stub;
            };
          },
        });
        return stub;
      },
    }),
  };
});

import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/v1/auth/demo-login/route";

const DEMO = { id: "d1", email: "demo@gts.ng", full_name: "Demo Admin", role: "admin", is_demo: true, is_blocked: false };
let ip = 0;
const post = () => POST(new NextRequest("http://localhost/api/v1/auth/demo-login", { method: "POST", headers: { "x-forwarded-for": `10.0.0.${++ip}` } }));

beforeEach(() => {
  process.env.DEMO_LOGIN_ENABLED = "true";
  logged.length = 0;
  tableCalls.length = 0;
  demoRow = { data: DEMO, error: null };
  permissions = { data: { can_process_pos: true }, error: null };
  generateLink.mockReset().mockResolvedValue({ data: { properties: { hashed_token: "h" } }, error: null });
  verifyOtp.mockReset().mockResolvedValue({ data: { session: { access_token: "at", refresh_token: "rt", expires_at: 9 }, user: { id: "d1" } }, error: null });
});
afterEach(() => { delete process.env.DEMO_LOGIN_ENABLED; });

describe("GET /auth/demo-login", () => {
  it("says whether the demo sign-in is offered", async () => {
    expect((await (await GET()).json()).data).toEqual({ enabled: true });
    process.env.DEMO_LOGIN_ENABLED = "false";
    expect((await (await GET()).json()).data).toEqual({ enabled: false });
    delete process.env.DEMO_LOGIN_ENABLED;
    expect((await (await GET()).json()).data).toEqual({ enabled: false });
  });
});

describe("POST /auth/demo-login", () => {
  it("signs straight into the demo account, with no password, and returns a session like a normal sign-in", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.session).toEqual({ access_token: "at", refresh_token: "rt", expires_at: 9 });
    expect(data.user).toMatchObject({ email: "demo@gts.ng", role: "admin", is_demo: true });
    expect(data.permissions).toEqual({ can_process_pos: true });
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "demo@gts.ng" });
    expect(tableCalls.find((c) => c.table === "users" && c.method === "eq")!.args).toEqual(["is_demo", true]);
  });

  it("records the sign-in in the demo account's own trail, not the live one", async () => {
    await post();
    expect(logged).toEqual([{ entry: expect.objectContaining({ actorId: "d1", action: "auth.login", changes: { via: "demo_button" } }), mode: "test" }]);
  });

  it("is refused when the demo sign-in is switched off", async () => {
    process.env.DEMO_LOGIN_ENABLED = "false";
    expect((await post()).status).toBe(404);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("says so when no demo account has been set up", async () => {
    demoRow = { data: null, error: null };
    const res = await post();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("DEMO_NOT_SET_UP");
  });

  it("limits how often one address can use it", async () => {
    const same = () => POST(new NextRequest("http://localhost/api/v1/auth/demo-login", { method: "POST", headers: { "x-forwarded-for": "203.0.113.50" } }));
    for (let i = 0; i < 10; i++) expect((await same()).status).toBe(200);
    expect((await same()).status).toBe(429);
  });

  it("does not describe internal failures", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "secret detail" } });
    const res = await post();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret detail/);
  });
});
