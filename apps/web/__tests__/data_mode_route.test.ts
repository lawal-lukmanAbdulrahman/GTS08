// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdmin = vi.fn();
const mockRequireSuperAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireSuperAdmin: (...a: unknown[]) => mockRequireSuperAdmin(...a),
}));

const mockGetMode = vi.fn();
const mockInvalidate = vi.fn();
const updates: Array<{ table: string; values: unknown }> = [];
let updateError: { message: string } | null = null;
vi.mock("@gts/database", () => ({
  getDataMode: () => mockGetMode(),
  invalidateDataMode: () => mockInvalidate(),
  createServiceClient: () => ({
    from: (table: string) => ({
      update: (values: unknown) => {
        updates.push({ table, values });
        return { eq: () => Promise.resolve({ error: updateError }) };
      },
    }),
  }),
}));

const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({ logActivity: (...a: unknown[]) => mockLog(...a), clientIp: () => "1.2.3.4" }));

import { NextRequest } from "next/server";
import { GET, PUT } from "../app/api/v1/settings/data-mode/route";

const ADMIN = { ok: true, user: { id: "a1" }, isAdmin: true, isSuperAdmin: false };
const SUPER = { ...ADMIN, isSuperAdmin: true };
const put = (body: unknown) => PUT(new NextRequest("http://localhost/api/v1/settings/data-mode", { method: "PUT", body: JSON.stringify(body) }));
const get = () => GET(new NextRequest("http://localhost/api/v1/settings/data-mode"));

describe("/api/v1/settings/data-mode", () => {
  beforeEach(() => {
    updates.length = 0;
    updateError = null;
    mockGetMode.mockReset().mockResolvedValue("live");
    mockInvalidate.mockReset();
    mockLog.mockReset();
    mockRequireAdmin.mockReset().mockResolvedValue(ADMIN);
    mockRequireSuperAdmin.mockReset().mockResolvedValue(SUPER);
  });

  it("GET tells an admin the current mode", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ mode: "live", ready: true });
  });

  it("GET says isolation isn't ready until the migration is applied", async () => {
    mockGetMode.mockResolvedValue(null);
    expect((await (await get()).json()).data).toEqual({ mode: null, ready: false });
  });

  it("GET refuses a non-admin", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await get()).status).toBe(403);
  });

  it("PUT is for the super admin only", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireSuperAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ code: "SUPER_ADMIN_ONLY" }, { status: 403 }) });
    expect((await put({ mode: "test", confirm: true })).status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  it.each([{}, { mode: "staging", confirm: true }, { mode: 1, confirm: true }])("PUT rejects a bad mode %j", async (body) => {
    expect((await put(body)).status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("PUT needs an explicit confirmation", async () => {
    const res = await put({ mode: "test" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CONFIRMATION_REQUIRED");
    expect(updates).toHaveLength(0);
  });

  it("PUT refuses to switch before the migration is applied", async () => {
    mockGetMode.mockResolvedValue(null);
    const res = await put({ mode: "test", confirm: true });
    expect(res.status).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it("PUT switches the mode, refreshes this server's view, and audits it", async () => {
    const res = await put({ mode: "test", confirm: true });
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ table: "settings", values: expect.objectContaining({ data_mode: "test" }) }]);
    expect(mockInvalidate).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: "a1", action: "settings.data_mode", changes: { from: "live", to: "test" } }));
    expect((await res.json()).data).toEqual({ mode: "test", ready: true });
  });

  it("PUT to the mode already active changes nothing", async () => {
    const res = await put({ mode: "live", confirm: true });
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("PUT reports a database failure without leaking it", async () => {
    updateError = { message: 'relation "settings" secret detail' };
    const res = await put({ mode: "test", confirm: true });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret detail/);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
