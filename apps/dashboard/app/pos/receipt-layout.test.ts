import { describe, it, expect } from "vitest";
import {
  PAPER_SIZES,
  layoutReceipt,
  paperCss,
  parseWhatsAppContact,
  renderReceiptText,
  type PaperSize,
} from "./receipt-layout";
import { formatWAT } from "@gts/utils";
import type { ReceiptData } from "./receipt";

const PAPERS = Object.keys(PAPER_SIZES) as PaperSize[];

const BASE: ReceiptData = {
  orderNumber: "GTS-202609-000143",
  items: [
    { name: "GTS Oxford Shirt", size: "L", color: "Black", quantity: 2, unitPrice: 1500000, lineTotal: 3000000 },
    { name: "Denim Jacket", size: null, color: null, quantity: 1, unitPrice: 4500000, lineTotal: 4500000 },
  ],
  subtotal: 7500000,
  discountAmount: 500000,
  total: 7000000,
  paymentMethod: "cash",
  cashierName: "Chidinma O.",
  createdAt: "2026-06-15T10:30:00.000Z",
  channel: "walk_in",
  cashReceived: 10000000,
  store: { name: "GTS", address: "12 Allen Avenue, Ikeja, Lagos", phone: "0803 123 4567" },
};

function line(lines: string[], startsWith: string): string {
  const found = lines.find((l) => l.trimStart().startsWith(startsWith));
  if (!found) throw new Error(`no line starting with "${startsWith}" in:\n${lines.join("\n")}`);
  return found;
}

describe.each(PAPERS)("layoutReceipt on %s paper", (paper) => {
  const width = PAPER_SIZES[paper].chars;

  it("never lets any line exceed the paper's character width", () => {
    const lines = layoutReceipt(BASE, paper);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(width);
  });

  it("centres the store name and draws full-width rules", () => {
    const lines = layoutReceipt(BASE, paper);
    const header = lines.find((l) => l.trim() === "GTS")!;
    expect(header.length - header.trimStart().length).toBe(Math.floor((width - 3) / 2));
    expect(lines.some((l) => l === "=".repeat(width))).toBe(true);
    expect(lines.some((l) => l === "-".repeat(width))).toBe(true);
  });

  it("puts the total on a full-width row with the amount flush right", () => {
    const total = line(layoutReceipt(BASE, paper), "TOTAL");
    expect(total.length).toBe(width);
    expect(total.endsWith("₦70,000")).toBe(true);
  });

  it("shows order number, date, channel and cashier", () => {
    const text = renderReceiptText(BASE, paper);
    expect(text).toContain("GTS-202609-000143");
    expect(text).toContain(formatWAT(BASE.createdAt));
    expect(text).toContain("Walk-in");
    expect(text).toContain("Chidinma O.");
  });

  it("lays each item out as name, variant, then qty x unit price with the line total flush right", () => {
    const lines = layoutReceipt(BASE, paper);
    const nameIdx = lines.findIndex((l) => l.startsWith("GTS Oxford Shirt"));
    expect(nameIdx).toBeGreaterThan(-1);
    expect(lines[nameIdx + 1]).toBe("  L / Black");
    const qty = lines[nameIdx + 2]!;
    expect(qty.startsWith("  2 x ₦15,000")).toBe(true);
    expect(qty.endsWith("₦30,000")).toBe(true);
    expect(qty.length).toBe(width);
  });

  it("omits the variant line for items without size or colour", () => {
    const lines = layoutReceipt(BASE, paper);
    const idx = lines.findIndex((l) => l.startsWith("Denim Jacket"));
    expect(lines[idx + 1]!.startsWith("  1 x ₦45,000")).toBe(true);
  });

  it("wraps a long product name on word boundaries without losing any text", () => {
    const name = "Samsung Bespoke 4-Door French Door Refrigerator with Water Dispenser";
    const lines = layoutReceipt(
      { ...BASE, items: [{ name, size: null, color: null, quantity: 1, unitPrice: 250000000, lineTotal: 250000000 }] },
      paper
    );
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(width);
    const words = lines
      .filter((l) => !l.startsWith("  1 x") && /Samsung|Bespoke|Door|French|Refrigerator|Water|Dispenser|with|4-Door/.test(l))
      .join(" ")
      .split(/\s+/)
      .filter(Boolean);
    expect(words.join(" ")).toBe(name);
  });

  it("hard-splits a single word that is longer than the paper", () => {
    const name = "Q".repeat(width + 10);
    const lines = layoutReceipt(
      { ...BASE, items: [{ name, size: null, color: null, quantity: 1, unitPrice: 100, lineTotal: 100 }] },
      paper
    );
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(width);
    expect(lines.join("").split("Q").length - 1).toBe(width + 10);
  });

  it("fits seven-figure amounts on the narrowest paper", () => {
    const big = { name: "Haier Fridge", size: null, color: null, quantity: 3, unitPrice: 125000000, lineTotal: 375000000 };
    const lines = layoutReceipt(
      { ...BASE, items: [big], subtotal: 375000000, discountAmount: 0, total: 375000000, cashReceived: undefined },
      paper
    );
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(width);
    expect(line(lines, "TOTAL").endsWith("₦3,750,000")).toBe(true);
  });

  it("shows a discount line only when a discount was applied", () => {
    expect(line(layoutReceipt(BASE, paper), "Discount").endsWith("-₦5,000")).toBe(true);
    const none = layoutReceipt({ ...BASE, discountAmount: 0, total: 7500000 }, paper);
    expect(none.some((l) => /discount/i.test(l))).toBe(false);
  });

  it("shows cash received and change only for cash payments", () => {
    const cash = layoutReceipt(BASE, paper);
    expect(line(cash, "Cash received").endsWith("₦100,000")).toBe(true);
    expect(line(cash, "Change").endsWith("₦30,000")).toBe(true);

    const card = layoutReceipt({ ...BASE, paymentMethod: "pos_terminal", cashReceived: undefined }, paper);
    expect(card.some((l) => /cash received|change/i.test(l))).toBe(false);
    expect(line(card, "Payment").includes("Card Terminal") || card.join("\n").includes("Card Terminal")).toBe(true);
  });

  it("never shows negative change if the customer paid short", () => {
    const short = layoutReceipt({ ...BASE, cashReceived: 5000000 }, paper);
    expect(short.some((l) => /change/i.test(l))).toBe(false);
  });

  it("shows the customer for WhatsApp orders only", () => {
    const wa = renderReceiptText(
      { ...BASE, channel: "whatsapp", customerName: "Ngozi A.", customerPhone: "08099998888" },
      paper
    );
    expect(wa).toContain("Ngozi A.");
    expect(wa).toContain("08099998888");
    expect(wa).toContain("WhatsApp");

    expect(renderReceiptText(BASE, paper)).not.toContain("Ngozi");
  });

  it("prints store address and phone only when configured", () => {
    const withStore = renderReceiptText(BASE, paper);
    expect(withStore).toContain("Allen Avenue");
    expect(withStore).toContain("0803 123 4567");

    const bare = renderReceiptText({ ...BASE, store: { name: "GTS" } }, paper);
    expect(bare).not.toContain("Allen Avenue");
    expect(bare).not.toMatch(/Tel:/);
  });

  it("stays within width for a 60-line order", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      name: `Product number ${i + 1} with a fairly long descriptive name`,
      size: "XL",
      color: "Charcoal Grey",
      quantity: (i % 4) + 1,
      unitPrice: 1234500,
      lineTotal: 1234500 * ((i % 4) + 1),
    }));
    const lines = layoutReceipt({ ...BASE, items }, paper);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(width);
    expect(lines.length).toBeGreaterThan(180);
  });

  it("ends with a thank-you footer", () => {
    const lines = layoutReceipt(BASE, paper);
    expect(lines.join("\n")).toMatch(/thank you/i);
  });
});

describe("paper sizes compared", () => {
  it("defines the three supported sizes", () => {
    expect(PAPERS).toEqual(["58mm", "80mm", "a4"]);
  });

  it("uses more lines on narrower paper for the same receipt", () => {
    const item = { name: "Samsung Bespoke 4-Door French Door Refrigerator", size: null, color: null, quantity: 1, unitPrice: 250000000, lineTotal: 250000000 };
    const data = { ...BASE, items: [item] };
    const n58 = layoutReceipt(data, "58mm").length;
    const n80 = layoutReceipt(data, "80mm").length;
    const nA4 = layoutReceipt(data, "a4").length;
    expect(n58).toBeGreaterThan(n80);
    expect(n80).toBeGreaterThanOrEqual(nA4);
  });

  it("gives each size a distinct character width, narrowest first", () => {
    expect(PAPER_SIZES["58mm"].chars).toBeLessThan(PAPER_SIZES["80mm"].chars);
    expect(PAPER_SIZES["80mm"].chars).toBeLessThan(PAPER_SIZES["a4"].chars);
  });
});

describe("paperCss (printer page setup)", () => {
  it("sets a 58mm wide page whose height fits every line, so a roll printer doesn't paginate", () => {
    const css = paperCss("58mm", 40);
    const match = css.match(/@page\s*{[^}]*size:\s*58mm\s+(\d+(?:\.\d+)?)mm/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(40 * PAPER_SIZES["58mm"].lineHeightMm);
  });

  it("sets an 80mm wide page that grows with the receipt length", () => {
    const short = Number(paperCss("80mm", 20).match(/size:\s*80mm\s+(\d+(?:\.\d+)?)mm/)![1]);
    const long = Number(paperCss("80mm", 80).match(/size:\s*80mm\s+(\d+(?:\.\d+)?)mm/)![1]);
    expect(long).toBeGreaterThan(short);
  });

  it("uses the standard A4 page for sheet printers", () => {
    expect(paperCss("a4", 40)).toMatch(/@page\s*{[^}]*size:\s*A4/);
  });

  it("sizes the font so the character grid exactly fills the printable width", () => {
    for (const paper of PAPERS) {
      const spec = PAPER_SIZES[paper];
      const css = paperCss(paper, 30);
      expect(css).toContain(`${spec.contentWidthMm}mm`);
      expect(css).toContain(`/ ${spec.chars} /`);
    }
  });

  it("resets any on-screen preview zoom when printing so the printed size stays exact", () => {
    for (const paper of PAPERS) {
      expect(paperCss(paper, 10)).toMatch(/@media print\s*{[^]*\.receipt-preview\s*{\s*zoom:\s*1\s*!important/);
    }
  });

  it("leaves no page margin on thermal rolls (the paper's own margin is the printer's)", () => {
    expect(paperCss("58mm", 10)).toMatch(/margin:\s*0/);
    expect(paperCss("80mm", 10)).toMatch(/margin:\s*0/);
  });
});

describe("parseWhatsAppContact", () => {
  it("extracts name and phone from the order's contact note", () => {
    expect(parseWhatsAppContact("WhatsApp customer: Ngozi A. (08099998888)")).toEqual({
      name: "Ngozi A.",
      phone: "08099998888",
    });
  });

  it("ignores any cancellation text appended later", () => {
    expect(parseWhatsAppContact("WhatsApp customer: Ngozi A. (08099998888)\nCancelled: x")).toEqual({
      name: "Ngozi A.",
      phone: "08099998888",
    });
  });

  it("returns null when the note isn't a WhatsApp contact note", () => {
    expect(parseWhatsAppContact("customer changed mind")).toBeNull();
    expect(parseWhatsAppContact(null)).toBeNull();
  });
});

describe.each(PAPERS)("a reprinted receipt on %s paper", (paper) => {
  it("is marked DUPLICATE, right under the title", () => {
    const lines = layoutReceipt({ ...BASE, duplicate: true }, paper);
    const title = lines.findIndex((l) => l.includes("SALES RECEIPT"));
    expect(lines[title + 1]).toContain("DUPLICATE");
  });

  it("carries no marker on the original", () => {
    expect(layoutReceipt(BASE, paper).join("\n")).not.toContain("DUPLICATE");
  });

  it("still fits the paper width", () => {
    const width = PAPER_SIZES[paper].chars;
    for (const line of layoutReceipt({ ...BASE, duplicate: true }, paper)) {
      expect(line.length).toBeLessThanOrEqual(width);
    }
  });
});
