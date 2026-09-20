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

  it("opens with the shop name and phone, centred, like the handwritten receipt", () => {
    const lines = layoutReceipt(BASE, paper);
    expect(lines[0]!.trim()).toBe("GTS");
    expect(lines[0]!.length - lines[0]!.trimStart().length).toBe(Math.floor((width - 3) / 2));
    expect(lines.some((l) => l.trim() === "0803 123 4567")).toBe(true);
    expect(lines.some((l) => l === "-".repeat(width))).toBe(true);
  });

  it("puts Date and Receipt No before the table, in that order", () => {
    const lines = layoutReceipt(BASE, paper);
    const date = lines.findIndex((l) => l.startsWith("Date:"));
    const no = lines.findIndex((l) => l.startsWith("Receipt No:"));
    const table = lines.findIndex((l) => l.startsWith("Qty"));
    expect(date).toBeGreaterThan(-1);
    expect(no).toBe(date + 1);
    expect(table).toBeGreaterThan(no);
    expect(lines[no]).toContain("GTS-202609-000143");
  });

  it("draws the total with an arrow to a flush-right amount", () => {
    const total = line(layoutReceipt(BASE, paper), "Total");
    expect(total.length).toBe(width);
    expect(total).toMatch(/^Total -+> +₦70,000$/);
  });

  it("shows receipt number, date and cashier", () => {
    const text = renderReceiptText(BASE, paper);
    expect(text).toContain("GTS-202609-000143");
    expect(text).toContain(formatWAT(BASE.createdAt));
    expect(text).toContain("Chidinma O.");
  });

  it("lists each item with Qty, Description, Unit price and Amount", () => {
    const lines = layoutReceipt(BASE, paper);
    const header = line(lines, "Qty");
    if (width >= 48) {
      expect(header).toMatch(/^Qty\s+Description\s+Unit price\s+Amount$/);
      const row = lines.find((l) => l.startsWith("2   GTS Oxford Shirt"))!;
      expect(row).toBeDefined();
      expect(row.length).toBe(width);
      const idx = lines.indexOf(row);
      expect((row + lines[idx + 1]).replace(/\s+/g, " ")).toContain("(L / Black)");
      expect(row).toContain("₦15,000");
      expect(row.endsWith("₦30,000")).toBe(true);
    } else {
      expect(header).toBe("Qty Description");
      const idx = lines.findIndex((l) => l.startsWith("2   GTS Oxford Shirt"));
      expect(idx).toBeGreaterThan(-1);
      const priceRow = lines.slice(idx).find((l) => l.includes("@ ₦15,000"))!;
      expect(priceRow.startsWith("    @ ₦15,000")).toBe(true);
      expect(priceRow.endsWith("₦30,000")).toBe(true);
      expect(priceRow.length).toBe(width);
    }
  });

  it("omits the variant for items without size or colour", () => {
    const lines = layoutReceipt(BASE, paper);
    const jacket = lines.find((l) => l.startsWith("1   Denim Jacket"))!;
    expect(jacket).toBeDefined();
    expect(jacket).not.toContain("(");
  });

  it("wraps a long product name on word boundaries without losing any text", () => {
    const name = "Samsung Bespoke 4-Door French Door Refrigerator with Water Dispenser";
    const lines = layoutReceipt(
      { ...BASE, items: [{ name, size: null, color: null, quantity: 1, unitPrice: 250000000, lineTotal: 250000000 }] },
      paper
    );
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(width);
    const start = lines.findIndex((l) => l.startsWith("1   Samsung"));
    expect(start).toBeGreaterThan(-1);
    const descEnd = width >= 48 ? width - 26 : width;
    const words = lines
      .slice(start)
      .filter((l) => !l.includes("@ ₦") || l.startsWith("1   "))
      .slice(0, 6)
      .map((l) => l.slice(4, descEnd))
      .join(" ")
      .split(/\s+/)
      .filter((w) => name.split(" ").includes(w));
    expect(words.join(" ")).toBe(name);
  });

  it("hard-splits a single word that is longer than the paper", () => {
    const name = "Z".repeat(width + 10);
    const lines = layoutReceipt(
      { ...BASE, items: [{ name, size: null, color: null, quantity: 1, unitPrice: 100, lineTotal: 100 }] },
      paper
    );
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(width);
    expect(lines.join("").split("Z").length - 1).toBe(width + 10);
  });

  it("fits seven-figure amounts on the narrowest paper", () => {
    const big = { name: "Haier Fridge", size: null, color: null, quantity: 3, unitPrice: 125000000, lineTotal: 375000000 };
    const lines = layoutReceipt(
      { ...BASE, items: [big], subtotal: 375000000, discountAmount: 0, total: 375000000, cashReceived: undefined },
      paper
    );
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(width);
    expect(line(lines, "Total").endsWith("₦3,750,000")).toBe(true);
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

  it("prints the store address only when configured, and the shop's own phone if none is set", () => {
    const withStore = renderReceiptText(BASE, paper);
    expect(withStore).toContain("Allen Avenue");
    expect(withStore).toContain("0803 123 4567");

    const bare = renderReceiptText({ ...BASE, store: { name: "GTS" } }, paper);
    expect(bare).not.toContain("Allen Avenue");
    expect(bare).toContain("08148308129");
    expect(renderReceiptText({ ...BASE, store: undefined }, paper)).toContain("GTS WEARS");
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
    expect(lines.length).toBeGreaterThan(150);
  });

  it("ends with the thanks and the website, as the handwritten receipt does", () => {
    const lines = layoutReceipt(BASE, paper).filter((l) => l.trim());
    expect(lines.at(-2)!.trim()).toBe("Thanks for your patronage.");
    expect(lines.at(-1)!.trim()).toBe("Order also: www.GTS08.com");
  });
});

describe("paper sizes compared", () => {
  it("defines the three supported sizes", () => {
    expect(PAPERS).toEqual(["58mm", "80mm", "a4"]);
  });

  it("never uses fewer lines on narrower paper for the same receipt", () => {
    const item = { name: "Samsung Bespoke 4-Door French Door Refrigerator", size: null, color: null, quantity: 1, unitPrice: 250000000, lineTotal: 250000000 };
    const data = { ...BASE, items: [item] };
    const n58 = layoutReceipt(data, "58mm").length;
    const n80 = layoutReceipt(data, "80mm").length;
    const nA4 = layoutReceipt(data, "a4").length;
    expect(n58).toBeGreaterThanOrEqual(n80);
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
  it("is marked DUPLICATE, above the items", () => {
    const lines = layoutReceipt({ ...BASE, duplicate: true }, paper);
    const mark = lines.findIndex((l) => l.includes("DUPLICATE"));
    expect(mark).toBeGreaterThan(-1);
    expect(mark).toBeLessThan(lines.findIndex((l) => l.startsWith("Qty")));
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
