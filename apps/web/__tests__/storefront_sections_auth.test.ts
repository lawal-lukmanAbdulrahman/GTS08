import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));

const mockRequireAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}));

import { NextRequest, NextResponse } from "next/server";
import { GET, PUT } from "../app/api/v1/storefront/sections/route";

const SECTION = { id: "hero", name: "Hero", category: "Hero", enabled: true, order: 0 };
const put = (body: unknown, raw?: string) => PUT(new NextRequest("http://localhost:3000/api/v1/storefront/sections", { method: "PUT", body: raw ?? JSON.stringify(body) }));
const deny = (status: number) => ({ ok: false, response: NextResponse.json({ code: "X" }, { status }) });

describe("/storefront/sections", () => {
  beforeEach(() => {
    db.reset();
    mockRequireAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "a" }, isAdmin: true });
    db.results.content_slots = { data: null, error: null };
  });

  it("GET stays public (the storefront reads the layout)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it.each([401, 403])("PUT is refused with %s for a non-admin, and writes nothing", async (status) => {
    mockRequireAdmin.mockResolvedValue(deny(status));
    const res = await put({ sections: [SECTION] });
    expect(res.status).toBe(status);
    expect(db.touched).toHaveLength(0);
  });

  it("checks who is asking before it even reads the body", async () => {
    mockRequireAdmin.mockResolvedValue(deny(401));
    const res = await put(null, "{not json");
    expect(res.status).toBe(401);
  });

  it("an admin can save a valid layout", async () => {
    const res = await put({ sections: [SECTION], heroProductIds: ["samsung-fridge"] });
    expect(res.status).toBe(200);
    expect(db.called("content_slots", "upsert")).toBeTruthy();
  });

  it.each([
    ["no sections", {}],
    ["sections that aren't a list", { sections: "x" }],
    ["a section missing fields", { sections: [{ id: "hero" }] }],
    ["a section with the wrong types", { sections: [{ ...SECTION, enabled: "yes" }] }],
    ["hero ids that aren't strings", { sections: [SECTION], heroProductIds: [1, 2] }],
    ["too many sections", { sections: Array.from({ length: 60 }, (_, i) => ({ ...SECTION, id: `s${i}` })) }],
    ["an oversized name", { sections: [{ ...SECTION, name: "x".repeat(500) }] }],
  ])("rejects %s with a 400 and saves nothing", async (_n, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(db.called("content_slots", "upsert")).toBeUndefined();
  });

  it("tells the admin when saving to the database fails, instead of claiming success", async () => {
    db.results.content_slots = { data: null, error: { message: "boom" } };
    const res = await put({ sections: [SECTION] });
    expect(res.status).toBe(500);
  });
});
