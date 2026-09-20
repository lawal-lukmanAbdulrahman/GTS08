// @vitest-environment node
import { describe, it, expect } from "vitest";
import { accountAccessEmail, flagUpdatedEmail, orderPaidEmail, passwordChangedEmail, posReceiptEmail, staffWelcomeEmail } from "../app/api/v1/_lib/email/templates";

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
