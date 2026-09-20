import { describe, it, expect, vi, beforeEach } from "vitest";

const admin = { ok: true, user: { id: "a1", email: null }, role: "admin", isAdmin: true, isSuperAdmin: true, fullName: "A", phone: null, permissions: {} };
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: vi.fn(async () => admin),
  requirePosAccess: vi.fn(async () => admin),
  requirePosPermission: vi.fn(async () => admin),
}));

const dbTouched = vi.fn();
vi.mock("@gts/database", () => ({
  createServiceClient: () => ({
    from: (t: string) => {
      dbTouched(t);
      throw new Error("the database must not be reached for a malformed id");
    },
  }),
}));

import { NextRequest } from "next/server";
import { GET as receipt } from "../app/api/v1/pos/orders/[id]/receipt/route";
import { PUT as voidOrder } from "../app/api/v1/pos/orders/[id]/void/route";
import { POST as confirm } from "../app/api/v1/pos/whatsapp-orders/[ref]/confirm/route";
import { PUT as cancel } from "../app/api/v1/pos/whatsapp-orders/[ref]/cancel/route";
import { PATCH as updateFlag } from "../app/api/v1/flags/[id]/route";
import { GET as getUser, PATCH as patchUser } from "../app/api/v1/users/[id]/route";

const ctx = (v: string) => ({ params: Promise.resolve({ id: v, ref: v }) });
const req = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/v1/x", { method, body: body ? JSON.stringify(body) : undefined });
const BAD = ["abc", "x') or 1=1--", "123", "../../etc/passwd"];

describe("a malformed id in the URL is a clean 404, never a database error", () => {
  beforeEach(() => dbTouched.mockClear());

  const cases: Array<[string, (id: string) => Promise<Response>]> = [
    ["GET  /pos/orders/[id]/receipt", (id) => receipt(req("GET"), ctx(id))],
    ["PUT  /pos/orders/[id]/void", (id) => voidOrder(req("PUT", { reason: "x" }), ctx(id))],
    ["POST /pos/whatsapp-orders/[ref]/confirm", (id) => confirm(req("POST", { payment_method: "cash" }), ctx(id))],
    ["PUT  /pos/whatsapp-orders/[ref]/cancel", (id) => cancel(req("PUT", { reason: "x" }), ctx(id))],
    ["PATCH /flags/[id]", (id) => updateFlag(req("PATCH", { status: "in_review" }), ctx(id))],
    ["GET  /users/[id]", (id) => getUser(req("GET"), ctx(id))],
    ["PATCH /users/[id]", (id) => patchUser(req("PATCH", { is_blocked: false }), ctx(id))],
  ];

  for (const [name, call] of cases) {
    it.each(BAD)(`${name} with id %s`, async (id) => {
      const res = await call(id);
      expect(res.status).toBe(404);
      expect(dbTouched).not.toHaveBeenCalled();
    });
  }
});
