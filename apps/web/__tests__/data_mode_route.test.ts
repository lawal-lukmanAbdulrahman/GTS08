// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}));

import { NextRequest } from "next/server";
import * as route from "../app/api/v1/settings/data-mode/route";

const get = () => route.GET(new NextRequest("http://localhost/api/v1/settings/data-mode"));

describe("GET /api/v1/settings/data-mode", () => {
  beforeEach(() => mockRequireAdmin.mockReset());

  it("tells the demo account it is seeing demo data", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: "d" }, isAdmin: true, isDemo: true });
    expect((await (await get()).json()).data).toEqual({ mode: "test" });
  });

  it("tells everyone else they are seeing the live shop", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: "a" }, isAdmin: true, isDemo: false });
    expect((await (await get()).json()).data).toEqual({ mode: "live" });
  });

  it("refuses a non-admin", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await get()).status).toBe(403);
  });

  it("no longer has a shop-wide switch: what you see depends on the account", () => {
    expect("PUT" in route).toBe(false);
  });
});
