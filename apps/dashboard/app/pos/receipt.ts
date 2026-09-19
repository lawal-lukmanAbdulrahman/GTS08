import { formatKobo, formatWAT } from "@gts/utils";

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

function itemLine(item: ReceiptItem): string {
  const variant = [item.size, item.color].filter(Boolean).join(" / ");
  const label = variant ? `${item.name} (${variant})` : item.name;
  return `${item.quantity} x ${label} — ${formatKobo(item.lineTotal)}`;
}

/**
 * Plain-text receipt shared by both the print view (spec Part 5.3) and the
 * WhatsApp share link. Kept as plain text (not HTML) so it renders cleanly
 * inside a WhatsApp message body.
 */
export function buildReceiptText(receipt: ReceiptData): string {
  const lines = [
    "GTS",
    ...(receipt.duplicate ? ["*** DUPLICATE ***"] : []),
    `Order ${receipt.orderNumber}`,
    formatWAT(receipt.createdAt),
    "",
    ...receipt.items.map(itemLine),
    "",
    `Subtotal: ${formatKobo(receipt.subtotal)}`,
  ];

  if (receipt.discountAmount > 0) {
    lines.push(`Discount: -${formatKobo(receipt.discountAmount)}`);
  }

  lines.push(
    `Total: ${formatKobo(receipt.total)}`,
    `Payment: ${PAYMENT_METHOD_LABEL[receipt.paymentMethod]}`,
    `Served by: ${receipt.cashierName}`,
    "",
    "Thank you for shopping with GTS!"
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
