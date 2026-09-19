import { formatKobo, formatWAT } from "@gts/utils";
import type { ReceiptData, ReceiptItem } from "./receipt";

export type PaperSize = "58mm" | "80mm" | "a4";

export interface PaperSpec {
  label: string;
  /** Characters per line in the monospace grid. */
  chars: number;
  /** Printable width the character grid is stretched across. */
  contentWidthMm: number;
  /** CSS @page width ("A4" for sheet paper). */
  pageWidth: string;
  /** @page margin. Thermal rolls use 0: the printer supplies its own. */
  pageMargin: string;
  lineHeightMm: number;
}

const GLYPH_WIDTH_EM = 0.6; // advance width of a monospace glyph, in em
const LINE_HEIGHT = 1.25;

function spec(label: string, chars: number, contentWidthMm: number, pageWidth: string, pageMargin: string): PaperSpec {
  const fontMm = contentWidthMm / chars / GLYPH_WIDTH_EM;
  return {
    label,
    chars,
    contentWidthMm,
    pageWidth,
    pageMargin,
    lineHeightMm: Math.round(fontMm * LINE_HEIGHT * 1000) / 1000,
  };
}

export const PAPER_SIZES: Record<PaperSize, PaperSpec> = {
  "58mm": spec("58 mm roll", 32, 48, "58mm", "0"),
  "80mm": spec("80 mm roll", 48, 72, "80mm", "0"),
  a4: spec("A4 sheet", 64, 170, "A4", "20mm"),
};

function center(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function centerWrapped(text: string, width: number): string[] {
  return wrap(text, width).map((l) => center(l.trim(), width));
}

/** Word-wraps to `width`, hard-splitting any single word longer than a line. */
function wrap(text: string, width: number, indent = ""): string[] {
  const room = Math.max(1, width - indent.length);
  const out: string[] = [];
  let current = "";

  const flush = () => {
    if (current) out.push(indent + current);
    current = "";
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > room) {
      if (current) flush();
      out.push(indent + w.slice(0, room));
      w = w.slice(room);
    }
    if (!current) current = w;
    else if (current.length + 1 + w.length <= room) current += " " + w;
    else {
      flush();
      current = w;
    }
  }
  flush();
  return out.length ? out : [indent.trimEnd()];
}

/** `left` at the left edge, `right` flush right; if they can't share a line, `right` drops to its own line. */
function twoCol(left: string, right: string, width: number): string[] {
  if (left.length + 1 + right.length <= width) {
    return [left + " ".repeat(width - left.length - right.length) + right];
  }
  const leftLines = wrap(left, width);
  const rightLines = wrap(right, width - 2).map((l) => " ".repeat(Math.max(0, width - l.length)) + l);
  return [...leftLines, ...rightLines];
}

const PAYMENT_LABEL: Record<ReceiptData["paymentMethod"], string> = {
  cash: "Cash",
  pos_terminal: "Card Terminal",
};

const CHANNEL_LABEL: Record<NonNullable<ReceiptData["channel"]>, string> = {
  walk_in: "Walk-in",
  whatsapp: "WhatsApp",
};

function unitPriceOf(item: ReceiptItem): number {
  return item.unitPrice ?? Math.round(item.lineTotal / item.quantity);
}

/**
 * The receipt as fixed-width text lines for the given paper. This one
 * function drives both the on-screen preview and the printed page, so what
 * the cashier sees is what comes out of the printer.
 */
export function layoutReceipt(receipt: ReceiptData, paper: PaperSize): string[] {
  const width = PAPER_SIZES[paper].chars;
  const heavy = "=".repeat(width);
  const light = "-".repeat(width);
  const lines: string[] = [];

  const store = receipt.store ?? { name: "GTS" };
  lines.push(...centerWrapped(store.name.toUpperCase(), width));
  if (store.address) lines.push(...centerWrapped(store.address, width));
  if (store.phone) lines.push(...centerWrapped(`Tel: ${store.phone}`, width));
  lines.push(heavy);
  lines.push(center("SALES RECEIPT", width));
  lines.push(light);

  lines.push(...twoCol("Order:", receipt.orderNumber, width));
  lines.push(...twoCol("Date:", formatWAT(receipt.createdAt), width));
  lines.push(...twoCol("Channel:", CHANNEL_LABEL[receipt.channel ?? "walk_in"], width));
  lines.push(...twoCol("Cashier:", receipt.cashierName, width));
  if (receipt.channel === "whatsapp") {
    if (receipt.customerName) lines.push(...twoCol("Customer:", receipt.customerName, width));
    if (receipt.customerPhone) lines.push(...twoCol("Phone:", receipt.customerPhone, width));
  }
  lines.push(light);

  lines.push(...twoCol("ITEM", "AMOUNT", width));
  lines.push(light);
  for (const item of receipt.items) {
    lines.push(...wrap(item.name, width));
    const variant = [item.size, item.color].filter(Boolean).join(" / ");
    if (variant) lines.push(...wrap(variant, width, "  "));
    lines.push(...twoCol(`  ${item.quantity} x ${formatKobo(unitPriceOf(item))}`, formatKobo(item.lineTotal), width));
  }
  lines.push(light);

  lines.push(...twoCol("Subtotal", formatKobo(receipt.subtotal), width));
  if (receipt.discountAmount > 0) {
    lines.push(...twoCol("Discount", `-${formatKobo(receipt.discountAmount)}`, width));
  }
  lines.push(...twoCol("TOTAL", formatKobo(receipt.total), width));
  lines.push(light);

  lines.push(...twoCol("Payment", PAYMENT_LABEL[receipt.paymentMethod], width));
  if (receipt.paymentMethod === "cash" && receipt.cashReceived !== undefined) {
    lines.push(...twoCol("Cash received", formatKobo(receipt.cashReceived), width));
    const change = receipt.cashReceived - receipt.total;
    if (change > 0) lines.push(...twoCol("Change", formatKobo(change), width));
  }

  lines.push(heavy);
  lines.push(...centerWrapped("Thank you for shopping at GTS!", width));
  lines.push(...centerWrapped("Keep this receipt for returns.", width));

  return lines;
}

export function renderReceiptText(receipt: ReceiptData, paper: PaperSize): string {
  return layoutReceipt(receipt, paper).join("\n");
}

/**
 * Print CSS for the chosen paper. Thermal rolls get a page exactly as tall as
 * the receipt so the browser doesn't paginate or leave a metre of blank paper;
 * A4 uses the normal page. The font is sized so `chars` glyphs span exactly
 * `contentWidthMm`, which is what makes the text layout line up when printed.
 */
export function paperCss(paper: PaperSize, lineCount: number): string {
  const s = PAPER_SIZES[paper];
  const pageSize =
    s.pageWidth === "A4"
      ? "A4"
      : `${s.pageWidth} ${Math.ceil((lineCount * s.lineHeightMm + 6) * 10) / 10}mm`;

  return `
@page { size: ${pageSize}; margin: ${s.pageMargin}; }
.receipt-sheet {
  width: ${s.contentWidthMm}mm;
  font-family: "Courier New", Courier, ui-monospace, monospace;
  font-size: calc(${s.contentWidthMm}mm / ${s.chars} / ${GLYPH_WIDTH_EM});
  line-height: ${LINE_HEIGHT};
  white-space: pre;
}
@media print {
  .receipt-preview { zoom: 1 !important; }
  body * { visibility: hidden; }
  .receipt-sheet, .receipt-sheet * { visibility: visible; }
  .receipt-sheet { position: absolute; left: 0; right: 0; top: 0; margin: 0 auto; padding: 3mm 0; color: #000; background: #fff; }
}`;
}

export { parseWhatsAppContact } from "@gts/utils";
