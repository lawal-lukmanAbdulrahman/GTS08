// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const db = makeDbStub();
vi.mock("@gts/database", () => ({ createServiceClient: () => db.client }));
vi.mock("@/lib/idempotency", () => ({ withIdempotency: (h: unknown) => h }));

const n = {
  welcome: vi.fn(), pw: vi.fn(), receipt: vi.fn(), paid: vi.fn(), flag: vi.fn(), access: vi.fn(),
};
vi.mock("../app/api/v1/_lib/email/events", () => ({
  notifyStaffWelcome: (...a: unknown[]) => n.welcome(...a),
  notifyPasswordChanged: (...a: unknown[]) => n.pw(...a),
  notifyPosReceipt: (...a: unknown[]) => n.receipt(...a),
  notifyOrderPaid: (...a: unknown[]) => n.paid(...a),
  notifyFlagUpdated: (...a: unknown[]) => n.flag(...a),
  notifyAccessChanged: (...a: unknown[]) => n.access(...a),
}));
const mockBell = vi.fn();
vi.mock("../app/api/v1/_lib/notify-admin", () => ({ createAdminNotification: (...a: unknown[]) => mockBell(...a) }));
vi.mock("../app/api/v1/_lib/email/after", () => ({ afterResponse: (task: () => Promise<unknown>) => void task() }));

const mockSuper = vi.fn();
const mockAdmin = vi.fn();
const mockStaff = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requireSuperAdmin: (...a: unknown[]) => mockSuper(...a),
  requireAdmin: (...a: unknown[]) => mockAdmin(...a),
  requireStaff: (...a: unknown[]) => mockStaff(...a),
}));
const mockPos = vi.fn();
vi.mock("../app/api/v1/pos/_lib/access", () => ({ requirePosAccess: (...a: unknown[]) => mockPos(...a), requirePosPermission: (...a: unknown[]) => mockPos(...a) }));
vi.mock("../app/api/v1/pos/_lib/inventory", () => ({ adjustAll: vi.fn().mockResolvedValue({ ok: true }), rollback: vi.fn() }));
vi.mock("../app/api/v1/pos/_lib/order-status", () => ({ transitionOrderStatus: vi.fn().mockResolvedValue(true) }));

import { NextRequest } from "next/server";
import crypto from "crypto";

const post = (url: string, body: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost:3000${url}`, { method: "POST", body: JSON.stringify(body), headers });
const V1 = "11111111-1111-4111-8111-111111111111";

describe("welcome email when the super admin adds someone", () => {
  const SUPER = { ok: true, user: { id: "boss" }, isSuperAdmin: true, isAdmin: true };
  const create = async (extra: Record<string, unknown> = {}) => {
    const { POST } = await import("../app/api/v1/users/staff/route");
    return POST(post("/api/v1/users/staff", { email: "ada@example.com", full_name: "Ada Obi", role: "cashier", ...extra }));
  };
  beforeEach(() => {
    vi.resetModules();
    Object.values(n).forEach((f) => f.mockReset().mockResolvedValue({ ok: true, id: "em_1" }));
    mockSuper.mockReset().mockResolvedValue(SUPER);
    db.reset();
    (db.client as any).auth = { admin: { createUser: async () => ({ data: { user: { id: "new-1" } }, error: null }), deleteUser: async () => ({ error: null }) } };
  });

  it("emails the new person and tells the admin it went", async () => {
    const res = await create();
    expect(n.welcome).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: "Ada Obi", role: "cashier", email: "ada@example.com" }));
    expect((await res.json()).data.email_delivery).toEqual({ sent: true, skipped: false });
  });

  it("puts the one-time password in the email only when the admin asked for that", async () => {
    await create();
    expect(n.welcome.mock.calls[0]![1].oneTimePassword).toBeUndefined();
    const res = await create({ email_credentials: true });
    const { data } = await res.json();
    expect(n.welcome.mock.calls[1]![1].oneTimePassword).toBe(data.temporary_password);
  });

  it("only a real boolean true counts (not the string 'true')", async () => {
    await create({ email_credentials: "true" });
    expect(n.welcome.mock.calls[0]![1].oneTimePassword).toBeUndefined();
  });

  it("still creates the account and says so when email can't be sent", async () => {
    n.welcome.mockResolvedValue({ ok: false, skipped: true, reason: "Email is not configured." });
    const res = await create({ email_credentials: true });
    expect(res.status).toBe(201);
    expect((await res.json()).data.email_delivery).toEqual({ sent: false, skipped: true });
  });
});

describe("password-changed notice", () => {
  it("is sent after a successful change to the account's own address", async () => {
    vi.resetModules();
    Object.values(n).forEach((f) => f.mockReset());
    mockStaff.mockReset().mockResolvedValue({ ok: true, user: { id: "u1", email: "ada@gts.ng" }, fullName: "Ada", mustChangePassword: false });
    (db.client as any).auth = { signInWithPassword: async () => ({ data: { user: { id: "u1" } }, error: null }), admin: { updateUserById: async () => ({ error: null }) } };
    db.reset();
    const { POST } = await import("../app/api/v1/staff/me/password/route");
    const res = await POST(post("/api/v1/staff/me/password", { current_password: "OldPass123!", new_password: "NewPass456!", confirm_password: "NewPass456!" }));
    expect(res.status).toBe(200);
    expect(n.pw).toHaveBeenCalledWith(expect.anything(), { name: "Ada", email: "ada@gts.ng" });
  });

  it("is not sent when the change failed", async () => {
    vi.resetModules();
    Object.values(n).forEach((f) => f.mockReset());
    (db.client as any).auth = { signInWithPassword: async () => ({ data: { user: null }, error: { message: "bad" } }), admin: { updateUserById: async () => ({ error: null }) } };
    const { POST } = await import("../app/api/v1/staff/me/password/route");
    await POST(post("/api/v1/staff/me/password", { current_password: "wrong", new_password: "NewPass456!", confirm_password: "NewPass456!" }));
    expect(n.pw).not.toHaveBeenCalled();
  });
});

describe("Paystack payment confirmation email", () => {
  it("goes to the customer once, only when the payment is really applied", async () => {
    vi.resetModules();
    Object.values(n).forEach((f) => f.mockReset());
    mockBell.mockReset();
    process.env.PAYSTACK_SECRET_KEY = "sk_test_email_hook";
    db.reset();
    db.results.webhook_events = { data: { id: "e1", processed: false }, error: null };
    db.results.transactions = { data: { order_id: "order-1" }, error: null };
    db.results.orders = { data: { id: "order-1", status: "pending_payment", total: 5000000 }, error: null };
    db.results.order_items = { data: [{ variant_id: V1, quantity: 1 }], error: null };
    const raw = JSON.stringify({ event: "charge.success", data: { id: 9, reference: "ref-1", amount: 5000000, currency: "NGN" } });
    const sig = crypto.createHmac("sha512", "sk_test_email_hook").update(raw).digest("hex");
    const { POST } = await import("../app/api/v1/webhooks/paystack/route");
    const res = await POST(new NextRequest("http://localhost:3000/api/v1/webhooks/paystack", { method: "POST", body: raw, headers: { "x-paystack-signature": sig } }));
    expect(res.status).toBe(200);
    expect(n.paid).toHaveBeenCalledWith(expect.anything(), "order-1");
    expect(mockBell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "new_order", link: "/admin/orders" }));
  });

  it("is not sent for a payment of the wrong amount", async () => {
    vi.resetModules();
    Object.values(n).forEach((f) => f.mockReset());
    db.reset();
    db.results.webhook_events = { data: { id: "e1", processed: false }, error: null };
    db.results.transactions = { data: { order_id: "order-1" }, error: null };
    db.results.orders = { data: { id: "order-1", status: "pending_payment", total: 5000000 }, error: null };
    const raw = JSON.stringify({ event: "charge.success", data: { id: 9, reference: "ref-2", amount: 100, currency: "NGN" } });
    const sig = crypto.createHmac("sha512", "sk_test_email_hook").update(raw).digest("hex");
    const { POST } = await import("../app/api/v1/webhooks/paystack/route");
    await POST(new NextRequest("http://localhost:3000/api/v1/webhooks/paystack", { method: "POST", body: raw, headers: { "x-paystack-signature": sig } }));
    expect(n.paid).not.toHaveBeenCalled();
    expect(mockBell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "payment_failed" }));
  });
});

describe("flag update email", () => {
  it("tells the person who raised it, when an admin changes it", async () => {
    vi.resetModules();
    Object.values(n).forEach((f) => f.mockReset());
    mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
    db.reset();
    db.results.product_flags = { data: { id: V1, status: "resolved", resolution_note: "Fixed", resolved_at: "x" }, error: null };
    const { PATCH } = await import("../app/api/v1/flags/[id]/route");
    const res = await PATCH(new NextRequest("http://localhost:3000/api/v1/flags/x", { method: "PATCH", body: JSON.stringify({ status: "resolved", resolution_note: "Fixed" }) }), { params: Promise.resolve({ id: V1 }) });
    expect(res.status).toBe(200);
    expect(n.flag).toHaveBeenCalledWith(expect.anything(), V1, "resolved", "Fixed");
  });
});

describe("access email", () => {
  const TARGET = { id: V1, email: "ada@x.co", full_name: "Ada", role: "cashier", is_blocked: false, created_at: "x", phone: null, employee_permissions: null };
  const patch = async (body: unknown, target = TARGET) => {
    vi.resetModules();
    Object.values(n).forEach((f) => f.mockReset());
    mockAdmin.mockReset().mockResolvedValue({ ok: true, user: { id: "admin-1" }, isAdmin: true });
    db.reset();
    db.results.users = { data: target, error: null };
    db.results.employee_permissions = { data: {}, error: null };
    const { PATCH } = await import("../app/api/v1/users/[id]/route");
    return PATCH(new NextRequest("http://localhost:3000/api/v1/users/x", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: V1 }) });
  };

  it("says so when someone is blocked, and when they're restored", async () => {
    expect((await patch({ is_blocked: true })).status).toBe(200);
    expect(n.access).toHaveBeenCalledWith(expect.anything(), V1, true);
    await patch({ is_blocked: false }, { ...TARGET, is_blocked: true });
    expect(n.access).toHaveBeenCalledWith(expect.anything(), V1, false);
  });

  it("says nothing when the status didn't actually change, or only permissions changed", async () => {
    await patch({ is_blocked: false });
    await patch({ permissions: { can_void_orders: true } });
    expect(n.access).not.toHaveBeenCalled();
  });
});
