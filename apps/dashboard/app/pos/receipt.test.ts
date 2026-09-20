import { describe, it, expect } from "vitest";
import { buildReceiptText, buildWhatsAppShareUrl, type ReceiptData } from "./receipt";

const SAMPLE_RECEIPT: ReceiptData = {
  orderNumber: "GTS-202609-000143",
  items: [
    { name: "GTS Oxford Shirt", size: "L", color: "Black", quantity: 2, lineTotal: 3000000 },
    { name: "Denim Jacket", size: null, color: null, quantity: 1, lineTotal: 4500000 },
  ],
  subtotal: 7500000,
  discountAmount: 500000,
  total: 7000000,
  paymentMethod: "cash",
  cashierName: "Chidinma O.",
  createdAt: "2026-06-15T10:30:00.000Z",
};

describe("buildReceiptText (spec Part 5.3: printable / shareable receipt)", () => {
  it("includes the order number, every item, and the final total in Naira", () => {
    const text = buildReceiptText(SAMPLE_RECEIPT);
    expect(text).toContain("GTS-202609-000143");
    expect(text).toContain("GTS Oxford Shirt");
    expect(text).toContain("Denim Jacket");
    expect(text).toContain("₦70,000");
  });

  it("shows size/color only when the item has them", () => {
    const text = buildReceiptText(SAMPLE_RECEIPT);
    expect(text).toContain("L / Black");
    expect(text).not.toMatch(/Denim Jacket.*\//);
  });

  it("shows the discount line only when a discount was applied", () => {
    const withDiscount = buildReceiptText(SAMPLE_RECEIPT);
    expect(withDiscount).toContain("₦5,000");

    const withoutDiscount = buildReceiptText({ ...SAMPLE_RECEIPT, discountAmount: 0 });
    expect(withoutDiscount).not.toMatch(/discount/i);
  });

  it("follows the handwritten receipt: name, phone, date, receipt no, total arrow, thanks, website", () => {
    const lines = buildReceiptText(SAMPLE_RECEIPT).split("\n");
    expect(lines[0]).toBe("GTS WEARS");
    expect(lines[1]).toBe("08148308129");
    expect(lines.some((l) => l.startsWith("Date: "))).toBe(true);
    expect(lines).toContain("Receipt No: GTS-202609-000143");
    expect(lines).toContain("Total -> ₦70,000");
    expect(lines.at(-2)).toBe("Thanks for your patronage.");
    expect(lines.at(-1)).toBe("Order also: www.GTS08.com");
  });

  it("uses the website from Store Details", () => {
    const text = buildReceiptText({ ...SAMPLE_RECEIPT, store: { name: "GTS", website: "gtswears.com" } });
    expect(text.split("\n").at(-1)).toBe("Order also: gtswears.com");
  });

  it("lists each item as qty, description, unit price and amount", () => {
    const text = buildReceiptText(SAMPLE_RECEIPT);
    expect(text).toContain("2 x GTS Oxford Shirt (L / Black) @ ₦15,000 = ₦30,000");
    expect(text).toContain("1 x Denim Jacket @ ₦45,000 = ₦45,000");
  });

  it("uses the store name and phone from settings when given, and marks a reprint", () => {
    const text = buildReceiptText({ ...SAMPLE_RECEIPT, duplicate: true, store: { name: "Acme", phone: "0801 000 1111" } });
    expect(text.split("\n").slice(0, 3)).toEqual(["ACME", "0801 000 1111", "*** DUPLICATE ***"]);
  });

  it("names the cashier and payment method", () => {
    const text = buildReceiptText(SAMPLE_RECEIPT);
    expect(text).toContain("Chidinma O.");
    expect(text).toMatch(/cash/i);
  });
});

describe("buildWhatsAppShareUrl (spec: receipt sent via WhatsApp)", () => {
  it("builds a wa.me link with the receipt text URL-encoded", () => {
    const url = buildWhatsAppShareUrl(SAMPLE_RECEIPT);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const encoded = url.replace("https://wa.me/?text=", "");
    expect(decodeURIComponent(encoded)).toContain("GTS-202609-000143");
  });

  it("targets a specific phone number when one is given", () => {
    const url = buildWhatsAppShareUrl(SAMPLE_RECEIPT, "2348031234567");
    expect(url.startsWith("https://wa.me/2348031234567?text=")).toBe(true);
  });

  it("strips a leading + or leading zeros from the phone number", () => {
    const url = buildWhatsAppShareUrl(SAMPLE_RECEIPT, "+234-803-123-4567");
    expect(url.startsWith("https://wa.me/2348031234567?text=")).toBe(true);
  });
});

describe("buildReceiptText for a reprint", () => {
  it("says DUPLICATE so the shared copy can't pass as the original", () => {
    expect(buildReceiptText({ ...SAMPLE_RECEIPT, duplicate: true })).toContain("DUPLICATE");
    expect(buildReceiptText(SAMPLE_RECEIPT)).not.toContain("DUPLICATE");
  });
});
