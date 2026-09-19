import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRequireStaff = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", () => ({
  requireStaff: (...args: unknown[]) => mockRequireStaff(...args),
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
            if (prop === "then") return (resolve: (v: unknown) => void) => resolve(results[table] ?? { data: [], error: null });
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
import { GET as getSales } from "../app/api/v1/staff/me/sales/route";
import { GET as getActivity } from "../app/api/v1/staff/me/activity/route";

const STAFF = { ok: true, user: { id: "u1", email: "ada@gts.ng" }, role: "cashier", isAdmin: false, fullName: "Ada", phone: null, permissions: {} };
const find = (table: string, method: string) => calls.find((c) => c.table === table && c.method === method);
const req = (path: string) => new NextRequest(`http://localhost:3000/api/v1/staff/me/${path}`);

const PAYMENT = (over: Record<string, unknown> = {}) => ({
  amount: 1000000,
  payment_method: "cash",
  created_at: "2026-09-19T09:00:00Z",
  order: { order_number: "GTS-1", channel: "walk_in", status: "completed", discount_amount: 0 },
  ...over,
});

beforeEach(() => {
  calls.length = 0;
  results = {};
  mockRequireStaff.mockReset();
  mockRequireStaff.mockResolvedValue(STAFF);
});
afterEach(() => vi.useRealTimers());

describe("GET /api/v1/staff/me/sales", () => {
  it("passes through a refusal", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireStaff.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no", code: "UNAUTHORIZED" }, { status: 401 }) });
    expect((await getSales(req("sales"))).status).toBe(401);
  });

  it("looks only at payments this staff member took, that succeeded, since the start of today in Lagos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T10:30:00Z"));
    await getSales(req("sales"));
    const eqs = calls.filter((c) => c.table === "transactions" && c.method === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["confirmed_by", "u1"]);
    expect(eqs).toContainEqual(["payment_status", "success"]);
    expect(find("transactions", "gte")?.args).toEqual(["created_at", "2026-09-18T23:00:00.000Z"]);
  });

  it("supports the last 7 and 30 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T10:30:00Z"));
    await getSales(req("sales?range=week"));
    expect(find("transactions", "gte")?.args[1]).toBe("2026-09-12T23:00:00.000Z");
    calls.length = 0;
    await getSales(req("sales?range=month"));
    expect(find("transactions", "gte")?.args[1]).toBe("2026-08-20T23:00:00.000Z");
  });

  it("rejects an unknown range", async () => {
    const res = await getSales(req("sales?range=forever"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_RANGE");
  });

  it("returns the summary and the most recent sales", async () => {
    results.transactions = {
      data: [
        PAYMENT({ amount: 2000000, payment_method: "pos_terminal", order: { order_number: "GTS-2", channel: "whatsapp", status: "completed", discount_amount: 0 } }),
        PAYMENT(),
        PAYMENT({ amount: 500000, order: { order_number: "GTS-3", channel: "walk_in", status: "voided", discount_amount: 0 } }),
      ],
      error: null,
    };
    const { data } = await (await getSales(req("sales"))).json();
    expect(data.range).toBe("today");
    expect(data.summary.sales).toEqual({ count: 2, total: 3000000, average: 1500000 });
    expect(data.summary.voided).toEqual({ count: 1, total: 500000 });
    expect(data.recent).toHaveLength(3);
    expect(data.recent[0]).toEqual({
      order_number: "GTS-2",
      channel: "whatsapp",
      status: "completed",
      payment_method: "pos_terminal",
      amount: 2000000,
      created_at: "2026-09-19T09:00:00Z",
    });
  });

  it("lists at most 20 recent sales", async () => {
    results.transactions = { data: Array.from({ length: 35 }, (_, i) => PAYMENT({ order: { order_number: `GTS-${i}`, channel: "walk_in", status: "completed", discount_amount: 0 } })), error: null };
    const { data } = await (await getSales(req("sales"))).json();
    expect(data.recent).toHaveLength(20);
    expect(data.summary.sales.count).toBe(35);
  });

  it("reports a database error", async () => {
    results.transactions = { data: null, error: { message: "boom" } };
    const res = await getSales(req("sales"));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/v1/staff/me/activity", () => {
  const ROWS = [
    { id: "a2", action: "pos.void", target_type: "order", target_id: "o1", changes: { reason: "x" }, created_at: "2026-09-19T10:00:00Z" },
    { id: "a1", action: "pos.sale", target_type: "order", target_id: "o1", changes: { total: 1 }, created_at: "2026-09-19T09:00:00Z" },
  ];

  it("shows only the caller's own activity, newest first", async () => {
    results.activity_logs = { data: ROWS, error: null };
    const { data } = await (await getActivity(req("activity"))).json();
    expect(data).toEqual(ROWS);
    expect(find("activity_logs", "eq")?.args).toEqual(["actor_id", "u1"]);
    expect(find("activity_logs", "order")?.args).toEqual(["created_at", { ascending: false }]);
  });

  it("never selects the IP address", async () => {
    await getActivity(req("activity"));
    expect(find("activity_logs", "select")?.args[0]).not.toMatch(/ip_address/);
  });

  it("defaults to 30 entries and caps at 100", async () => {
    await getActivity(req("activity"));
    expect(find("activity_logs", "limit")?.args[0]).toBe(30);
    calls.length = 0;
    await getActivity(req("activity?limit=5000"));
    expect(find("activity_logs", "limit")?.args[0]).toBe(100);
  });

  it("pages backwards with a 'before' cursor", async () => {
    await getActivity(req("activity?before=2026-09-19T09:00:00Z"));
    expect(find("activity_logs", "lt")?.args).toEqual(["created_at", "2026-09-19T09:00:00Z"]);
  });

  it("ignores a malformed cursor", async () => {
    await getActivity(req("activity?before=not-a-date"));
    expect(find("activity_logs", "lt")).toBeUndefined();
  });

  it("reports a database error", async () => {
    results.activity_logs = { data: null, error: { message: "boom" } };
    expect((await getActivity(req("activity"))).status).toBe(500);
  });
});
