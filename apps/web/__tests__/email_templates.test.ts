// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ticketReceivedEmail, ticketReplyEmail, orderStatusEmail, accountAccessEmail, flagUpdatedEmail, orderPaidEmail, passwordChangedEmail, posReceiptEmail, staffWelcomeEmail } from "../app/api/v1/_lib/email/templates";

const STORE = { name: "GTS Stores", address: "12 Marina, Lagos", phone: "0803 000 0000" };
const EVIL = `<img src=x onerror=alert(1)>"&'`;

describe("staffWelcomeEmail", () => {
  const base = { name: "Ada Obi", role: "cashier", email: "ada@gts.ng", signInUrl: "https://dash.gts.ng/login", store: STORE };

  it("welcomes them, says their role, and links to the sign-in page", () => {
    const m = staffWelcomeEmail(base);
    expect(m.subject).toMatch(/welcome/i);
    expect(m.html).toContain("Ada Obi");
    expect(m.html).toMatch(/cashier/i);
    expect(m.html).toContain('href="https://dash.gts.ng/login"');
    expect(m.text).toContain("https://dash.gts.ng/login");
  });

  it("includes the one-time password, and tells them it must be replaced, only when one is given", () => {
    const withPw = staffWelcomeEmail({ ...base, oneTimePassword: "Xy12abc!" });
    expect(withPw.html).toContain("Xy12abc!");
    expect(withPw.text).toContain("Xy12abc!");
    expect(withPw.html).toMatch(/choose your own|new password/i);
    const without = staffWelcomeEmail(base);
    expect(without.html).not.toMatch(/one-time password:/i);
    expect(without.html).toMatch(/your admin will give you/i);
  });

  it("escapes anything a person typed", () => {
    const m = staffWelcomeEmail({ ...base, name: EVIL, store: { ...STORE, name: EVIL } });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img");
  });
});

describe("passwordChangedEmail", () => {
  it("confirms the change without any password, and says who to tell if it wasn't them", () => {
    const m = passwordChangedEmail({ name: "Ada", whenText: "20 Sep 2026, 10:15 am", signInUrl: "https://dash.gts.ng/login", store: STORE });
    expect(m.subject).toMatch(/password/i);
    expect(m.html).toContain("20 Sep 2026, 10:15 am");
    expect(m.html).toMatch(/wasn.t you|did not make this change/i);
    expect(m.html).toContain("0803 000 0000");
    expect(m.html).not.toMatch(/password:/i);
  });
});

describe("posReceiptEmail", () => {
  const sale = {
    store: STORE,
    orderNumber: "GTS-202609-000123",
    dateText: "20 Sep 2026, 10:15 am",
    items: [
      { name: "Oxford Shirt", size: "L", color: "Black", quantity: 2, unitPrice: 1500000, lineTotal: 3000000 },
      { name: "Denim Jacket", size: null, color: null, quantity: 1, unitPrice: 4500000, lineTotal: 4500000 },
    ],
    subtotal: 7500000,
    discountAmount: 500000,
    total: 7000000,
    paymentMethod: "cash" as const,
    cashierName: "Chidinma",
  };

  it("is a proper itemised receipt", () => {
    const m = posReceiptEmail(sale);
    expect(m.subject).toContain("GTS-202609-000123");
    for (const s of ["Oxford Shirt", "L / Black", "Denim Jacket", "₦70,000", "₦75,000", "-₦5,000", "Cash", "Chidinma", "GTS Stores"]) expect(m.html, s).toContain(s);
    expect(m.text).toContain("₦70,000");
  });

  it("follows the handwritten receipt: header, Date, Receipt No, four-column table, thanks and website", () => {
    const m = posReceiptEmail(sale);
    for (const s of ["GTS Stores", "0803 000 0000", "Date:", "Receipt No:", "GTS-202609-000123", "Qty", "Description", "Unit price", "Amount", "₦15,000", "Thanks for your patronage.", "Order also: www.GTS08.com"]) expect(m.html, s).toContain(s);
    expect(m.text).toContain("Receipt No: GTS-202609-000123");
    expect(m.text).toContain("2 x Oxford Shirt (L / Black) @ ₦15,000 = ₦30,000");
    expect(m.text.split("\n").slice(-2)).toEqual(["Thanks for your patronage.", "Order also: www.GTS08.com"]);
  });

  it("uses the website from Store Details in the closing line", () => {
    const m = posReceiptEmail({ ...sale, store: { ...STORE, website: "https://www.gtswears.com/" } });
    expect(m.html).toContain("Order also: www.gtswears.com");
    expect(m.text.split("\n").at(-1)).toBe("Order also: www.gtswears.com");
  });

  it("falls back to the shop's own name and phone when Store Details has none", () => {
    const m = posReceiptEmail({ ...sale, store: { name: "" , phone: null } });
    expect(m.html).toContain("08148308129");
  });

  it("leaves out the discount row when there is none", () => {
    const m = posReceiptEmail({ ...sale, discountAmount: 0, total: 7500000 });
    expect(m.html).not.toMatch(/discount/i);
  });

  it("names card payments", () => {
    expect(posReceiptEmail({ ...sale, paymentMethod: "pos_terminal" }).html).toContain("Card");
  });

  it("escapes product names", () => {
    const m = posReceiptEmail({ ...sale, items: [{ ...sale.items[0]!, name: EVIL }] });
    expect(m.html).not.toContain("<img src=x");
  });
});

describe("ticket emails", () => {
  it("acknowledges a ticket with its reference, without repeating the customer's message", () => {
    const m = ticketReceivedEmail({ store: STORE, name: "Bola", reference: "TKT-202609-0042", subject: EVIL });
    expect(m.subject).toContain("TKT-202609-0042");
    expect(m.html).toContain("TKT-202609-0042");
    expect(m.html).not.toContain("<img src=x");
  });
  it("delivers a staff reply with the reference, escaped", () => {
    const m = ticketReplyEmail({ store: STORE, name: "Bola", reference: "TKT-1", subject: "Late order", reply: `Hi\n${EVIL}` });
    expect(m.subject).toContain("TKT-1");
    expect(m.html).toContain("Hi");
    expect(m.html).not.toContain("<img src=x");
    expect(m.text).toContain("Hi");
  });
});

describe("orderStatusEmail", () => {
  const base = { store: STORE, name: "Ngozi", orderNumber: "GTS-202609-000200", trackUrl: "https://gts.ng/track" };
  it("tells the customer in plain words what happened, for each step they care about", () => {
    expect(orderStatusEmail({ ...base, status: "confirmed" })!.subject).toMatch(/confirmed/i);
    expect(orderStatusEmail({ ...base, status: "shipped" })!.subject).toMatch(/on its way/i);
    expect(orderStatusEmail({ ...base, status: "delivered" })!.subject).toMatch(/delivered/i);
    expect(orderStatusEmail({ ...base, status: "cancelled" })!.subject).toMatch(/cancelled/i);
  });
  it("says nothing about steps that are internal", () => {
    expect(orderStatusEmail({ ...base, status: "processing" })).toBeNull();
  });
  it("gives the courier and tracking number when shipped, escaped", () => {
    const m = orderStatusEmail({ ...base, status: "shipped", carrierName: "GIG", trackingNumber: EVIL, trackingUrl: "https://t.example/1" })!;
    expect(m.html).toContain("GIG");
    expect(m.html).toContain('href="https://t.example/1"');
    expect(m.html).not.toContain("<img src=x");
    expect(m.text).toContain("GIG");
  });
  it("says a refund is being handled when a paid order is cancelled", () => {
    expect(orderStatusEmail({ ...base, status: "cancelled", paid: true })!.html).toMatch(/refund/i);
    expect(orderStatusEmail({ ...base, status: "cancelled", paid: false })!.html).not.toMatch(/refund/i);
  });
});

describe("orderPaidEmail closing lines", () => {
  it("ends with the thanks and the website like the shop's receipt", () => {
    const m = orderPaidEmail({ store: STORE, name: "Ngozi", orderNumber: "GTS-202609-000200", items: [{ name: "Standing Fan", quantity: 1, unitPrice: 3500000, lineTotal: 3500000 }], total: 3500000, trackUrl: "https://gts.ng/track" });
    expect(m.html).toContain("Thanks for your patronage.");
    expect(m.html).toContain("Order also: www.GTS08.com");
    expect(m.text).toContain("Order also: www.GTS08.com");
    expect(m.html).toContain("Unit price");
  });
});

describe("orderPaidEmail", () => {
  it("confirms the payment with the order number, items and a tracking link", () => {
    const m = orderPaidEmail({ store: STORE, name: "Ngozi", orderNumber: "GTS-202609-000200", items: [{ name: "Standing Fan", quantity: 1, lineTotal: 3500000 }], total: 3500000, trackUrl: "https://gts.ng/track" });
    expect(m.subject).toContain("GTS-202609-000200");
    expect(m.html).toContain("Standing Fan");
    expect(m.html).toContain("₦35,000");
    expect(m.html).toContain('href="https://gts.ng/track"');
  });
});

describe("flagUpdatedEmail", () => {
  it("tells the cashier what happened to their flag and what the admin said", () => {
    const m = flagUpdatedEmail({ store: STORE, name: "Ada", productName: "Oxford Shirt", status: "resolved", note: "Price fixed to ₦15,000" });
    expect(m.html).toContain("Oxford Shirt");
    expect(m.html).toMatch(/resolved/i);
    expect(m.html).toContain("Price fixed to ₦15,000");
  });
  it.each(["in_review", "dismissed"])("words %s sensibly", (status) => {
    expect(flagUpdatedEmail({ store: STORE, name: "A", productName: "P", status, note: null }).subject).toBeTruthy();
  });
  it("escapes the admin's note", () => {
    expect(flagUpdatedEmail({ store: STORE, name: "A", productName: "P", status: "resolved", note: EVIL }).html).not.toContain("<img src=x");
  });
});

describe("accountAccessEmail", () => {
  it("tells someone their access was suspended", () => {
    const m = accountAccessEmail({ store: STORE, name: "Ada", blocked: true });
    expect(m.subject).toMatch(/suspended/i);
    expect(m.html).toContain("0803 000 0000");
  });
  it("tells someone their access is back", () => {
    expect(accountAccessEmail({ store: STORE, name: "Ada", blocked: false, signInUrl: "https://dash.gts.ng/login" }).subject).toMatch(/restored/i);
  });
});
