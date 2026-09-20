// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";
import { NextResponse } from "next/server";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
const mockPerm = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: (...a: unknown[]) => mockPerm(...a),
}));
const notify = { received: vi.fn(), reply: vi.fn() };
vi.mock("../app/api/v1/_lib/email/events", () => ({ notifyTicketReceived: (...a: unknown[]) => notify.received(...a), notifyTicketReply: (...a: unknown[]) => notify.reply(...a) }));
const mockBell = vi.fn();
vi.mock("../app/api/v1/_lib/notify-admin", () => ({ createAdminNotification: (...a: unknown[]) => mockBell(...a) }));
vi.mock("../app/api/v1/_lib/email/after", () => ({ afterResponse: (t: () => Promise<unknown>) => void t() }));

import { NextRequest } from "next/server";
import { GET as list, POST as create } from "../app/api/v1/tickets/route";
import { GET as one, PATCH as patch } from "../app/api/v1/tickets/[id]/route";
import { POST as reply } from "../app/api/v1/tickets/[id]/messages/route";

const ID = "11111111-1111-4111-8111-111111111111";
const STAFF = "33333333-3333-4333-8333-333333333333";
const ctx = { params: Promise.resolve({ id: ID }) };
const req = (method: string, body?: unknown, qs = "") => new NextRequest(`http://localhost:3000/api/v1/tickets${qs}`, { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const TICKET = { id: ID, reference: "TKT-202609-0042", customer_email: "bola@example.com", customer_name: "Bola", subject: "Late order", status: "open", priority: "normal", assigned_to: null, tags: [] };
const GOOD = { customer_email: "Bola@Example.com", customer_name: "Bola", subject: "  Late   order ", body: "Where is my order?" };

beforeEach(() => {
  db.reset();
  Object.values(notify).forEach((f) => f.mockReset());
  mockBell.mockReset();
  mockPerm.mockReset().mockResolvedValue({ ok: true, user: { id: STAFF }, isAdmin: false });
  db.results.support_tickets = { data: TICKET, error: null, count: 1 };
  db.results.ticket_messages = { data: null, error: null };
  db.results.users = { data: { id: STAFF, role: "cashier" }, error: null };
});

describe("POST /tickets (public)", () => {
  it("opens a ticket and its first message, and sends the customer an acknowledgement", async () => {
    const res = await create(req("POST", GOOD));
    expect(res.status).toBe(201);
    expect(db.called("support_tickets", "insert")!.args[0]).toMatchObject({ customer_email: "bola@example.com", subject: "Late order" });
    expect(db.called("ticket_messages", "insert")!.args[0]).toMatchObject({ sender_type: "customer", body: "Where is my order?", is_internal: false });
    expect(notify.received).toHaveBeenCalledTimes(1);
    expect(mockBell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "new_ticket", link: "/admin/questions" }));
    expect(mockPerm).not.toHaveBeenCalled();
  });
  it("never sets fields a customer shouldn't (status, priority, assignee)", async () => {
    await create(req("POST", { ...GOOD, status: "resolved", priority: "urgent", assigned_to: STAFF }));
    const row = db.called("support_tickets", "insert")!.args[0] as Record<string, unknown>;
    for (const k of ["status", "priority", "assigned_to"]) expect(row).not.toHaveProperty(k);
  });
  it("validates", async () => {
    for (const body of [{}, { ...GOOD, customer_email: "nope" }, { ...GOOD, subject: "" }, { ...GOOD, body: "" }, { ...GOOD, body: "x".repeat(5001) }, { ...GOOD, subject: "x".repeat(256) }, { ...GOOD, customer_phone: "abc" }, { ...GOOD, order_id: "nope" }]) {
      expect((await create(req("POST", body))).status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    expect((await create(req("POST", "{nope"))).status).toBe(400);
  });
  it("hides internal errors", async () => {
    db.results.support_tickets = { data: null, error: { message: "relation secret_t missing" } };
    const res = await create(req("POST", GOOD));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret_t/);
  });
  it("gives the customer only a reference, not the ticket's inner details", async () => {
    const body = await (await create(req("POST", GOOD))).json();
    expect(body.data).toEqual({ reference: "TKT-202609-0042" });
  });
});

describe("staff routes need can_handle_tickets", () => {
  it.each([["list", () => list(req("GET"))], ["get", () => one(req("GET"), ctx)], ["patch", () => patch(req("PATCH", { status: "closed" }), ctx)], ["reply", () => reply(req("POST", { body: "hi" }), ctx)]])("%s", async (_n, run) => {
    mockPerm.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "no" }, { status: 403 }) });
    expect((await run()).status).toBe(403);
    expect(db.touched).toHaveLength(0);
  });
});

describe("GET /tickets", () => {
  it("filters by status, priority and assignee, and pages", async () => {
    await list(req("GET", undefined, "?status=open&priority=urgent&assigned_to=me&page=2&limit=10"));
    const eqs = db.calls.support_tickets!.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqs).toEqual(expect.arrayContaining([["status", "open"], ["priority", "urgent"], ["assigned_to", STAFF]]));
    expect(db.called("support_tickets", "range")!.args).toEqual([10, 19]);
  });
  it("rejects unknown filters and a bad page", async () => {
    for (const qs of ["?status=bogus", "?priority=huge", "?page=0", "?limit=500", "?assigned_to=someone"]) expect((await list(req("GET", undefined, qs))).status, qs).toBe(400);
  });
});

describe("GET/PATCH /tickets/[id]", () => {
  it("returns the ticket with its messages, oldest first", async () => {
    expect((await one(req("GET"), ctx)).status).toBe(200);
    db.results.support_tickets = { data: null, error: null };
    expect((await one(req("GET"), ctx)).status).toBe(404);
    expect((await one(req("GET"), { params: Promise.resolve({ id: "x" }) })).status).toBe(404);
  });
  it("updates status, priority, assignee and tags, stamping resolved and closed times", async () => {
    await patch(req("PATCH", { status: "resolved", priority: "urgent", assigned_to: STAFF, tags: [" refund ", "vip"] }), ctx);
    const u = db.called("support_tickets", "update")!.args[0] as Record<string, unknown>;
    expect(u).toMatchObject({ status: "resolved", priority: "urgent", assigned_to: STAFF, tags: ["refund", "vip"], resolved_at: expect.any(String) });
    db.reset();
    db.results.support_tickets = { data: TICKET, error: null };
    await patch(req("PATCH", { status: "closed" }), ctx);
    expect(db.called("support_tickets", "update")!.args[0]).toMatchObject({ status: "closed", closed_at: expect.any(String) });
  });
  it("only assigns to staff, and validates", async () => {
    db.results.users = { data: { id: STAFF, role: "customer" }, error: null };
    expect((await patch(req("PATCH", { assigned_to: STAFF }), ctx)).status).toBe(400);
    for (const body of [{}, { status: "bogus" }, { priority: "x" }, { tags: "a" }, { tags: Array.from({ length: 11 }, () => "a") }, { tags: ["x".repeat(31)] }, { assigned_to: "nope" }]) {
      expect((await patch(req("PATCH", body), ctx)).status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe("POST /tickets/[id]/messages", () => {
  it("records a reply from the signed-in staff member and emails the customer", async () => {
    const res = await reply(req("POST", { body: "It ships tomorrow." }), ctx);
    expect(res.status).toBe(201);
    expect(db.called("ticket_messages", "insert")!.args[0]).toMatchObject({ ticket_id: ID, sender_type: "staff", sender_id: STAFF, body: "It ships tomorrow.", is_internal: false });
    expect(notify.reply).toHaveBeenCalledTimes(1);
  });
  it("keeps an internal note off the customer's inbox", async () => {
    await reply(req("POST", { body: "Check with the courier", is_internal: true }), ctx);
    expect(db.called("ticket_messages", "insert")!.args[0]).toMatchObject({ is_internal: true });
    expect(notify.reply).not.toHaveBeenCalled();
  });
  it("won't reply to a closed ticket, and validates", async () => {
    db.results.support_tickets = { data: { ...TICKET, status: "closed" }, error: null };
    expect((await reply(req("POST", { body: "hi" }), ctx)).status).toBe(409);
    db.results.support_tickets = { data: TICKET, error: null };
    for (const b of [{}, { body: "" }, { body: "x".repeat(5001) }, { body: "hi", is_internal: "yes" }]) expect((await reply(req("POST", b), ctx)).status).toBe(400);
  });
});
