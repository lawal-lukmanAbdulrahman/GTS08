import { formatKobo, formatWAT, receiptBrand } from "@gts/utils";

export interface ReceiptItem {
  name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPrice?: number; // kobo; derived from lineTotal / quantity when absent
  lineTotal: number; // kobo
}

export interface ReceiptStore {
  name: string;
  address?: string;
  phone?: string;
}

export interface ReceiptData {
  orderNumber: string;
  items: ReceiptItem[];
  subtotal: number; // kobo
  discountAmount: number; // kobo
  total: number; // kobo
  paymentMethod: "cash" | "pos_terminal";
  cashierName: string;
  createdAt: string; // ISO
  channel?: "walk_in" | "whatsapp";
  customerName?: string;
  customerPhone?: string;
  cashReceived?: number; // kobo, cash payments only
  duplicate?: boolean; // a reprint, not the original
  store?: ReceiptStore;
}

const PAYMENT_METHOD_LABEL: Record<ReceiptData["paymentMethod"], string> = {
  cash: "Cash",
  pos_terminal: "Card Terminal",
};

function unitPriceOf(item: ReceiptItem): number {
  return item.unitPrice ?? Math.round(item.lineTotal / item.quantity);
}

function itemLine(item: ReceiptItem): string {
  const variant = [item.size, item.color].filter(Boolean).join(" / ");
  const label = variant ? `${item.name} (${variant})` : item.name;
  return `${item.quantity} x ${label} @ ${formatKobo(unitPriceOf(item))} = ${formatKobo(item.lineTotal)}`;
}

/**
 * Plain-text receipt for the WhatsApp share link, in the shop's handwritten
 * order. Plain text (not HTML) so it renders cleanly inside a WhatsApp message.
 */
export function buildReceiptText(receipt: ReceiptData): string {
  const brand = receiptBrand({ name: receipt.store?.name, phone: receipt.store?.phone });
  const lines = [
    brand.name.toUpperCase(),
    brand.phone,
    ...(receipt.duplicate ? ["*** DUPLICATE ***"] : []),
    "",
    `Date: ${formatWAT(receipt.createdAt)}`,
    `Receipt No: ${receipt.orderNumber}`,
    "",
    "Qty x Description @ Unit price = Amount",
    ...receipt.items.map(itemLine),
    "",
  ];

  if (receipt.discountAmount > 0) {
    lines.push(`Subtotal: ${formatKobo(receipt.subtotal)}`, `Discount: -${formatKobo(receipt.discountAmount)}`);
  }

  lines.push(
    `Total -> ${formatKobo(receipt.total)}`,
    `Payment: ${PAYMENT_METHOD_LABEL[receipt.paymentMethod]}`,
    `Served by: ${receipt.cashierName}`,
    "",
    brand.thanks,
    brand.orderAlso
  );

  return lines.join("\n");
}

function normalizePhoneForWaMe(phone: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, "");
  return digitsOnly.replace(/^0+/, "234"); // Nigerian local format -> international
}

/**
 * A "Share via WhatsApp" wa.me deep link — opens WhatsApp with the receipt
 * pre-filled, no WhatsApp Business API integration required (D001).
 */
export function buildWhatsAppShareUrl(receipt: ReceiptData, phone?: string): string {
  const text = encodeURIComponent(buildReceiptText(receipt));
  const target = phone ? normalizePhoneForWaMe(phone) : "";
  return `https://wa.me/${target}?text=${text}`;
}
