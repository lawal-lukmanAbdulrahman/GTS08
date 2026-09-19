import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePosAccess = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({
  requirePosAccess: (...args: unknown[]) => mockRequirePosAccess(...args),
}));

let result: { data: unknown; error: unknown } = { data: [], error: null };
const log: Array<{ method: string; args: unknown[] }> = [];
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    from: () => {
      const stub: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
            return (...args: unknown[]) => {
              log.push({ method: prop, args });
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
import { GET } from "../app/api/v1/pos/categories/route";

const req = () => new NextRequest("http://localhost:3000/api/v1/pos/categories");

describe("GET /api/v1/pos/categories", () => {
  beforeEach(() => {
    log.length = 0;
    mockRequirePosAccess.mockReset();
    mockRequirePosAccess.mockResolvedValue({ ok: true, user: { id: "u1", email: null }, role: "cashier" });
    result = {
      data: [
        { id: "c1", name: "Appliances", slug: "appliances" },
        { id: "c2", name: "Fashion", slug: "fashion" },
      ],
      error: null,
    };
  });

  it("returns 403 when the caller lacks POS access", async () => {
    const { NextResponse } = await import("next/server");
    mockRequirePosAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "denied", code: "POS_ACCESS_DENIED" }, { status: 403 }),
    });
    expect((await GET(req())).status).toBe(403);
  });

  it("lists only active top-level categories, in display order", async () => {
    const res = await GET(req());
    expect((await res.json()).data).toHaveLength(2);
    expect(log.find((c) => c.method === "eq" && c.args[0] === "is_active")?.args[1]).toBe(true);
    expect(log.some((c) => c.method === "is" && c.args[0] === "parent_id" && c.args[1] === null)).toBe(true);
    expect(log.some((c) => c.method === "order" && c.args[0] === "sort_order")).toBe(true);
  });

  it("returns only the fields the tabs need", async () => {
    await GET(req());
    expect(log.find((c) => c.method === "select")?.args[0]).toBe("id, name, slug");
  });

  it("reports a database error", async () => {
    result = { data: null, error: { message: "boom" } };
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("DATABASE_ERROR");
  });
});
