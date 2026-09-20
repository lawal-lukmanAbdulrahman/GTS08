// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockAdmin = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
}));

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { GET } from "../app/api/v1/live/summary/route";

const call = () => GET(new NextRequest("http://localhost:3000/api/v1/live/summary"));
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

beforeEach(() => {
  db.reset();
  mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
  db.results.orders = {
    data: [
      { status: "paid", channel: "online" },
      { status: "confirmed", channel: "online" },
      { status: "shipped", channel: "online" },
      { status: "pending_payment", channel: "whatsapp" },
      { status: "pending_payment", channel: "whatsapp" },
      { status: "pending_payment", channel: "online" },
    ],
    error: null,
  };
  db.results.product_flags = { data: [{ id: "f1" }, { id: "f2" }], error: null };
  db.results.inventory = {
    data: [
      { quantity: 3, reserved_quantity: 0, low_stock_threshold: 5 },
      { quantity: 10, reserved_quantity: 6, low_stock_threshold: 5 },
      { quantity: 50, reserved_quantity: 0, low_stock_threshold: 5 },
    ],
    error: null,
  };
  db.results.activity_logs = {
    data: [
      { actor_id: "u1", action: "pos.sale", created_at: minutesAgo(1), actor: { id: "u1", full_name: "Ada", role: "cashier" } },
      { actor_id: "u1", action: "auth.login", created_at: minutesAgo(5), actor: { id: "u1", full_name: "Ada", role: "cashier" } },
      { actor_id: "u2", action: "auth.logout", created_at: minutesAgo(2), actor: { id: "u2", full_name: "Bayo", role: "cashier" } },
      { actor_id: "u3", action: "pos.void", created_at: minutesAgo(3), actor: { id: "u3", full_name: "Chi", role: "cashier" } },
    ],
    error: null,
  };
});

describe("GET /api/v1/live/summary (the admin's live badge and to-do numbers)", () => {
  it("is for admins only", async () => {
    mockAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no", code: "FORBIDDEN" }, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });

  it("counts what needs attention from the real data", async () => {
    const { data } = await (await call()).json();
    expect(data.counts).toEqual({
      orders_to_ship: 2, // online orders that are paid or confirmed
      whatsapp_waiting: 2, // WhatsApp orders holding stock until paid
      open_flags: 2,
      low_stock: 2, // available (quantity - reserved) at or under the threshold
    });
  });

  it("lists who is on shift: the most recent action per person, skipping anyone who signed out", async () => {
    const { data } = await (await call()).json();
    expect(data.active_staff.map((s: { id: string }) => s.id)).toEqual(["u1", "u3"]);
    expect(data.active_staff[0]).toMatchObject({ id: "u1", full_name: "Ada", role: "cashier", last_action: "pos.sale" });
  });

  it("only looks at recent activity", async () => {
    await call();
    const gte = db.calls.activity_logs!.find((c) => c.method === "gte")!;
    expect(gte.args[0]).toBe("created_at");
    const cutoff = new Date(gte.args[1] as string).getTime();
    expect(Date.now() - cutoff).toBeGreaterThan(14 * 60_000);
    expect(Date.now() - cutoff).toBeLessThan(16 * 60_000);
  });

  it("is never cached, so the badge is live", async () => {
    expect((await call()).headers.get("Cache-Control")).toBe("no-store");
  });

  it("reports zero rather than failing when a table can't be read, and never echoes internal errors", async () => {
    db.results.product_flags = { data: null, error: { message: "relation secret does not exist" } };
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.counts.open_flags).toBe(0);
    expect(JSON.stringify(body)).not.toMatch(/secret/);
  });
});
