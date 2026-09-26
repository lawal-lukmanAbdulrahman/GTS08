// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeDbStub } from "./_helpers/db-stub";

const mockSend = vi.fn();
vi.mock("../app/api/v1/_lib/email/send", () => ({ sendEmail: (...a: unknown[]) => mockSend(...a) }));

import { notifyCustomerWelcome, notifyPasswordReset, notifyAccessChanged, notifyFlagUpdated, notifyOrderPaid, notifyPasswordChanged, notifyPosReceipt, notifyStaffWelcome } from "../app/api/v1/_lib/email/events";

const db = makeDbStub();
const sent = () => mockSend.mock.calls.map((c) => c[0]) as Array<{ to: string; subject: string; html: string; text: string }>;

beforeEach(() => {
  db.reset();
  mockSend.mockReset().mockResolvedValue({ ok: true, id: "em_1" });
  db.results.settings = { data: { store_name: "GTS Stores", store_address: "12 Marina", support_phone: "0803 000 0000" }, error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://dash.gts.ng";
  process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://gts.ng";
});

describe("notifyStaffWelcome", () => {
  it("emails the new person, with the password only if asked", async () => {
    await notifyStaffWelcome(db.client, { name: "Ada", role: "cashier", email: "ada@gts.ng", oneTimePassword: "Xy12abc!" });
    expect(sent()[0]!.to).toBe("ada@gts.ng");
    expect(sent()[0]!.html).toContain("Xy12abc!");
    expect(sent()[0]!.html).toContain("https://dash.gts.ng/login");
    await notifyStaffWelcome(db.client, { name: "Ada", role: "cashier", email: "ada@gts.ng" });
    expect(sent()[1]!.html).not.toContain("Xy12abc!");
  });

  it("returns whether it was sent, so the admin can be told", async () => {
    expect(await notifyStaffWelcome(db.client, { name: "A", role: "cashier", email: "a@b.co" })).toMatchObject({ ok: true });
    mockSend.mockResolvedValue({ ok: false, skipped: true, reason: "Email is not configured." });
    expect(await notifyStaffWelcome(db.client, { name: "A", role: "cashier", email: "a@b.co" })).toMatchObject({ ok: false, skipped: true });
  });

  it("uses the shop's real details when settings load, and a plain name when they don't", async () => {
    await notifyStaffWelcome(db.client, { name: "A", role: "cashier", email: "a@b.co" });
    expect(sent()[0]!.html).toContain("GTS Stores");
    db.results.settings = { data: null, error: { message: "down" } };
    await notifyStaffWelcome(db.client, { name: "A", role: "cashier", email: "a@b.co" });
    expect(sent()[1]!.html).toContain("GTS");
  });
});

describe("the website in receipts", () => {
  const sale = { to: "c@example.com", orderNumber: "GTS-1", createdAt: "2026-09-20T09:15:00Z", items: [{ name: "Shirt", size: null, color: null, quantity: 1, unitPrice: 1000, lineTotal: 1000 }], subtotal: 1000, discountAmount: 0, total: 1000, paymentMethod: "cash" as const, cashierName: "Ada" };

  it("comes from Store Details", async () => {
    db.results.settings = { data: { store_name: "GTS", store_address: null, support_phone: null, store_website: "gtswears.com" }, error: null };
    await notifyPosReceipt(db.client, sale);
    expect(sent()[0]!.text).toContain("Order also: gtswears.com");
  });

  it("falls back to the default when the database doesn't have the column yet", async () => {
    let calls = 0;
    db.results.settings = () => (++calls === 1 ? { data: null, error: { message: "column settings.store_website does not exist" } } : { data: { store_name: "GTS Stores", store_address: null, support_phone: null }, error: null });
    await notifyPosReceipt(db.client, sale);
    expect(sent()[0]!.text).toContain("GTS Stores");
    expect(sent()[0]!.text).toContain("Order also: www.GTS08.com");
  });
});

describe("notifyPasswordChanged", () => {
  it("sends a security notice to the account's own address", async () => {
    await notifyPasswordChanged(db.client, { name: "Ada", email: "ada@gts.ng" });
    expect(sent()[0]!.to).toBe("ada@gts.ng");
    expect(sent()[0]!.subject).toMatch(/password was changed/i);
  });
  it("does nothing without an address", async () => {
    await notifyPasswordChanged(db.client, { name: "Ada", email: null });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("notifyPosReceipt", () => {
  const sale = { to: "cust@example.com", orderNumber: "GTS-202609-000001", createdAt: "2026-09-20T09:15:00Z", items: [{ name: "Shirt", size: "L", color: null, quantity: 1, unitPrice: 1000, lineTotal: 1000 }], subtotal: 1000, discountAmount: 0, total: 1000, paymentMethod: "cash" as const, cashierName: "Ada" };
  it("sends the itemised receipt to the customer", async () => {
    await notifyPosReceipt(db.client, sale);
    expect(sent()[0]!.to).toBe("cust@example.com");
    expect(sent()[0]!.subject).toContain("GTS-202609-000001");
  });
  it("skips a missing address", async () => {
    await notifyPosReceipt(db.client, { ...sale, to: "" });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("notifyOrderPaid", () => {
  it("emails the customer who paid, with their items", async () => {
    db.results.orders = { data: { order_number: "GTS-202609-000200", total: 3500000, customer: { email: "ngozi@example.com", full_name: "Ngozi" }, items: [{ quantity: 1, line_total: 3500000, product_snapshot: { name: "Standing Fan" } }] }, error: null };
    await notifyOrderPaid(db.client, "order-1");
    expect(sent()[0]!.to).toBe("ngozi@example.com");
    expect(sent()[0]!.html).toContain("Standing Fan");
    expect(sent()[0]!.html).toContain("https://gts.ng/track");
  });
  it("does nothing for an order with no customer email (walk-ins, WhatsApp)", async () => {
    db.results.orders = { data: { order_number: "X", total: 1, customer: null, items: [] }, error: null };
    await notifyOrderPaid(db.client, "order-1");
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("notifyFlagUpdated", () => {
  it("tells the person who raised the flag what happened", async () => {
    db.results.product_flags = { data: { raiser: { email: "ada@gts.ng", full_name: "Ada" }, product: { name: "Oxford Shirt" } }, error: null };
    await notifyFlagUpdated(db.client, "flag-1", "resolved", "Fixed");
    expect(sent()[0]!.to).toBe("ada@gts.ng");
    expect(sent()[0]!.html).toContain("Fixed");
  });
  it("does nothing if the raiser is gone", async () => {
    db.results.product_flags = { data: { raiser: null, product: { name: "P" } }, error: null };
    await notifyFlagUpdated(db.client, "flag-1", "resolved", null);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("notifyAccessChanged", () => {
  it("tells someone their access was suspended or restored", async () => {
    db.results.users = { data: { email: "ada@gts.ng", full_name: "Ada" }, error: null };
    await notifyAccessChanged(db.client, "u1", true);
    await notifyAccessChanged(db.client, "u1", false);
    expect(sent()[0]!.subject).toMatch(/suspended/i);
    expect(sent()[1]!.subject).toMatch(/restored/i);
  });
});

describe("every notifier is safe", () => {
  it("never throws, even when the database and the sender both fail", async () => {
    mockSend.mockRejectedValue(new Error("boom"));
    db.results.settings = { data: null, error: { message: "down" } };
    db.results.orders = { data: null, error: { message: "down" } };
    db.results.product_flags = { data: null, error: { message: "down" } };
    db.results.users = { data: null, error: { message: "down" } };
    await expect(notifyStaffWelcome(db.client, { name: "A", role: "cashier", email: "a@b.co" })).resolves.toBeDefined();
    await expect(notifyOrderPaid(db.client, "o")).resolves.toBeUndefined();
    await expect(notifyFlagUpdated(db.client, "f", "resolved", null)).resolves.toBeUndefined();
    await expect(notifyAccessChanged(db.client, "u", true)).resolves.toBeUndefined();
    await expect(notifyPasswordChanged(db.client, { name: "A", email: "a@b.co" })).resolves.toBeUndefined();
  });
});

describe("notifyCustomerWelcome", () => {
  it("welcomes a new shopper with a link to the storefront", async () => {
    await notifyCustomerWelcome(db.client, { name: "Ada", email: "ada@example.com" });
    expect(sent()[0]!.to).toBe("ada@example.com");
    expect(sent()[0]!.html).toContain("https://gts.ng");
  });

  it("sends the welcome only once per address, even if registration is retried", async () => {
    await notifyCustomerWelcome(db.client, { name: "Ada", email: "Ada@Example.com" });
    expect((mockSend.mock.calls[0]![0] as { idempotencyKey?: string }).idempotencyKey).toBe("welcome/ada@example.com");
  });

  it("never throws if sending fails", async () => {
    mockSend.mockRejectedValue(new Error("boom"));
    await expect(notifyCustomerWelcome(db.client, { name: "A", email: "a@b.co" })).resolves.toBeUndefined();
  });
});

describe("notifyPasswordReset", () => {
  it("sends the link to the person who asked, and returns whether it went", async () => {
    const r = await notifyPasswordReset(db.client, { name: "Ada", email: "ada@example.com", resetUrl: "https://gts.ng/reset-password?token=t" });
    expect(r).toMatchObject({ ok: true });
    expect(sent()[0]!.to).toBe("ada@example.com");
    expect(sent()[0]!.html).toContain("reset-password?token=t");
  });

  it("does not use an idempotency key: a second request must send a fresh link", async () => {
    await notifyPasswordReset(db.client, { name: "A", email: "a@b.co", resetUrl: "https://gts.ng/reset-password?token=t" });
    expect((mockSend.mock.calls[0]![0] as { idempotencyKey?: string }).idempotencyKey).toBeUndefined();
  });
});

describe("delivery keys", () => {
  it("marks the payment confirmation with its order, so a webhook retry can't send it twice", async () => {
    db.results.orders = { data: { order_number: "GTS-1", total: 1000, customer: { email: "c@example.com", full_name: "C" }, items: [] }, error: null };
    await notifyOrderPaid(db.client, "order-uuid-1");
    expect((mockSend.mock.calls[0]![0] as { idempotencyKey?: string }).idempotencyKey).toBe("order-paid/order-uuid-1");
  });
});
