import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
const mockRequireAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", () => ({
  requirePosAccess: (...a: unknown[]) => mockRequirePosAccess(...a),
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}));

const mockLog = vi.fn();
vi.mock("../app/api/v1/_lib/activity", () => ({
  logActivity: (...a: unknown[]) => mockLog(...a),
  clientIp: () => "1.2.3.4",
}));

type Result = { data?: unknown; error?: unknown };
let results: Record<string, Result> = {};
const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const stub: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then" || prop === "single" || prop === "maybeSingle") {
              const r = results[table] ?? { data: [], error: null };
              if (prop === "then") return (resolve: (v: unknown) => void) => resolve(r);
              return () => Promise.resolve(r);
            }
            return (...args: unknown[]) => {
              calls.push({ table, method: prop, args });
              return stub;
            };
          },
        }
      );
      return stub;
    },
  }),
}));

import { NextRequest } from "next/server";
import { POST as raiseFlag, GET as myFlags } from "../app/api/v1/pos/flags/route";
import { GET as listFlags } from "../app/api/v1/flags/route";
import { PATCH as reviewFlag } from "../app/api/v1/flags/[id]/route";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const VARIANT = "22222222-2222-4222-8222-222222222222";
const CASHIER = { ok: true, user: { id: "u1", email: "ada@gts.ng" }, role: "cashier", isAdmin: false, fullName: "Ada", phone: null, permissions: {} };
const ADMIN = { ...CASHIER, user: { id: "boss", email: "boss@gts.ng" }, role: "admin", isAdmin: true };

const post = (body: unknown) => new NextRequest("http://localhost:3000/api/v1/pos/flags", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const find = (table: string, method: string) => calls.find((c) => c.table === table && c.method === method);
const refuse = async (code = "POS_ACCESS_DENIED") => {
  const { NextResponse } = await import("next/server");
  return { ok: false, response: NextResponse.json({ error: "no", code }, { status: 403 }) };
};

beforeEach(() => {
  calls.length = 0;
  results = {};
  mockLog.mockReset();
  mockRequirePosAccess.mockReset();
  mockRequireAdmin.mockReset();
  mockRequirePosAccess.mockResolvedValue(CASHIER);
  mockRequireAdmin.mockResolvedValue(ADMIN);
});

describe("POST /api/v1/pos/flags (a cashier raises a product flag)", () => {
  beforeEach(() => {
    results.products = { data: { id: PRODUCT, name: "Air Fryer" }, error: null };
    results.product_variants = { data: { id: VARIANT }, error: null };
    results.product_flags = { data: { id: "bd19836d-db62-411c-85ab-251ccaca5645", product_id: PRODUCT, reason: "wrong_price", status: "open", created_at: "2026-09-19T09:00:00Z" }, error: null };
  });

  it("passes through a refusal without touching the database", async () => {
    mockRequirePosAccess.mockResolvedValue(await refuse());
    expect((await raiseFlag(post({ product_id: PRODUCT, reason: "wrong_price" }))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("rejects invalid JSON", async () => {
    expect((await raiseFlag(post("{nope"))).status).toBe(400);
  });

  it("rejects an invalid flag with field errors", async () => {
    const res = await raiseFlag(post({ product_id: "x", reason: "because" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.details).sort()).toEqual(["product_id", "reason"]);
    expect(find("product_flags", "insert")).toBeUndefined();
  });

  it("returns 404 for a product that doesn't exist", async () => {
    results.products = { data: null, error: null };
    const res = await raiseFlag(post({ product_id: PRODUCT, reason: "wrong_price" }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects a variant that doesn't belong to that product", async () => {
    results.product_variants = { data: null, error: null };
    const res = await raiseFlag(post({ product_id: PRODUCT, variant_id: VARIANT, reason: "damaged" }));
    expect(res.status).toBe(400);
    expect((await res.json()).details.variant_id).toBeDefined();
    expect(find("product_variants", "eq")).toBeDefined();
  });

  it("raises the flag in the cashier's own name", async () => {
    const res = await raiseFlag(post({ product_id: PRODUCT, variant_id: VARIANT, reason: "wrong_price", note: "Shelf says ₦80,000" }));
    expect(res.status).toBe(201);
    expect(find("product_flags", "insert")?.args[0]).toEqual({
      product_id: PRODUCT,
      variant_id: VARIANT,
      raised_by: "u1",
      reason: "wrong_price",
      note: "Shelf says ₦80,000",
    });
  });

  it("can't be raised in someone else's name", async () => {
    await raiseFlag(post({ product_id: PRODUCT, reason: "wrong_price", raised_by: "someone-else", status: "resolved" }));
    const written = find("product_flags", "insert")!.args[0] as Record<string, unknown>;
    expect(written.raised_by).toBe("u1");
    expect(written).not.toHaveProperty("status");
  });

  it("refuses a duplicate of a flag that's still open", async () => {
    results.product_flags = { data: null, error: { code: "23505", message: "duplicate key" } };
    const res = await raiseFlag(post({ product_id: PRODUCT, reason: "wrong_price" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("FLAG_ALREADY_OPEN");
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("reports any other database error", async () => {
    results.product_flags = { data: null, error: { code: "XX000", message: "boom" } };
    expect((await raiseFlag(post({ product_id: PRODUCT, reason: "wrong_price" }))).status).toBe(500);
  });

  it("records the flag in the audit log", async () => {
    await raiseFlag(post({ product_id: PRODUCT, reason: "wrong_price" }));
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "u1",
        action: "product_flag.raise",
        targetType: "product_flag",
        targetId: "bd19836d-db62-411c-85ab-251ccaca5645",
        changes: { product_id: PRODUCT, reason: "wrong_price" },
      })
    );
  });
});

describe("GET /api/v1/pos/flags (my flags)", () => {
  it("passes through a refusal", async () => {
    mockRequirePosAccess.mockResolvedValue(await refuse());
    expect((await myFlags(new NextRequest("http://localhost:3000/api/v1/pos/flags"))).status).toBe(403);
  });

  it("lists only the caller's flags, newest first, with the product's name and any resolution note", async () => {
    results.product_flags = { data: [{ id: "bd19836d-db62-411c-85ab-251ccaca5645", reason: "damaged", status: "resolved", resolution_note: "Replaced", product: { name: "Air Fryer" } }], error: null };
    const res = await myFlags(new NextRequest("http://localhost:3000/api/v1/pos/flags"));
    expect((await res.json()).data).toHaveLength(1);
    expect(find("product_flags", "eq")?.args).toEqual(["raised_by", "u1"]);
    expect(find("product_flags", "order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(find("product_flags", "select")?.args[0]).toMatch(/resolution_note/);
    expect(find("product_flags", "select")?.args[0]).toMatch(/product:products\(name\)/);
  });
});

describe("GET /api/v1/flags (admin review queue)", () => {
  const listReq = (q = "") => new NextRequest(`http://localhost:3000/api/v1/flags${q}`);

  it("is admin-only", async () => {
    mockRequireAdmin.mockResolvedValue(await refuse("FORBIDDEN"));
    expect((await listFlags(listReq())).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("shows open flags by default, with who raised them", async () => {
    results.product_flags = {
      data: [{ id: "bd19836d-db62-411c-85ab-251ccaca5645", status: "open", reason: "wrong_price", product: { id: PRODUCT, name: "Air Fryer" }, raiser: { full_name: "Ada", email: "ada@gts.ng" } }],
      error: null,
    };
    const { data } = await (await listFlags(listReq())).json();
    expect(data.flags).toHaveLength(1);
    expect(calls.find((c) => c.method === "eq" && c.args[0] === "status")?.args[1]).toBe("open");
  });

  it("resolves the two foreign keys to users explicitly (raised_by vs resolved_by)", async () => {
    await listFlags(listReq());
    expect(find("product_flags", "select")?.args[0]).toMatch(/users!product_flags_raised_by_fkey/);
  });

  it("can show every status", async () => {
    await listFlags(listReq("?status=all"));
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status")).toBe(false);
  });

  it("rejects an unknown status filter", async () => {
    expect((await listFlags(listReq("?status=weird"))).status).toBe(400);
  });

  it("counts flags by status for the nav badge", async () => {
    results.product_flags = { data: [{ status: "open" }, { status: "open" }, { status: "resolved" }], error: null };
    const { data } = await (await listFlags(listReq("?status=all"))).json();
    expect(data.counts).toEqual({ open: 2, in_review: 0, resolved: 1, dismissed: 0 });
  });
});

describe("PATCH /api/v1/flags/:id (admin reviews a flag)", () => {
  const patch = (body: unknown) => new NextRequest("http://localhost:3000/api/v1/flags/f1", { method: "PATCH", body: JSON.stringify(body) });
  const ctx = { params: Promise.resolve({ id: "bd19836d-db62-411c-85ab-251ccaca5645" }) };

  beforeEach(() => {
    results.product_flags = { data: { id: "bd19836d-db62-411c-85ab-251ccaca5645", status: "resolved", resolution_note: "Price fixed" }, error: null };
  });

  it("is admin-only", async () => {
    mockRequireAdmin.mockResolvedValue(await refuse("FORBIDDEN"));
    expect((await reviewFlag(patch({ status: "in_review" }), ctx)).status).toBe(403);
    expect(find("product_flags", "update")).toBeUndefined();
  });

  it("requires a note to resolve", async () => {
    const res = await reviewFlag(patch({ status: "resolved" }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).details.resolution_note).toBeDefined();
  });

  it("stamps who resolved it and when", async () => {
    await reviewFlag(patch({ status: "resolved", resolution_note: "Price fixed" }), ctx);
    const written = find("product_flags", "update")!.args[0] as Record<string, unknown>;
    expect(written).toMatchObject({ status: "resolved", resolution_note: "Price fixed", resolved_by: "boss" });
    expect(typeof written.resolved_at).toBe("string");
  });

  it("clears the resolution stamp when a flag is reopened", async () => {
    await reviewFlag(patch({ status: "open" }), ctx);
    expect(find("product_flags", "update")!.args[0]).toMatchObject({ status: "open", resolved_by: null, resolved_at: null });
  });

  it("returns 404 for a flag that doesn't exist", async () => {
    results.product_flags = { data: null, error: null };
    expect((await reviewFlag(patch({ status: "in_review" }), ctx)).status).toBe(404);
  });

  it("records the review in the audit log", async () => {
    await reviewFlag(patch({ status: "resolved", resolution_note: "Price fixed" }), ctx);
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: "boss", action: "product_flag.update", targetId: "bd19836d-db62-411c-85ab-251ccaca5645", changes: { status: "resolved" } })
    );
  });
});
