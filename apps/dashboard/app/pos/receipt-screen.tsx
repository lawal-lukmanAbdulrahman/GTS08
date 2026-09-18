"use client";

import { formatKobo } from "@gts/utils";
import type { CompletedSale } from "./pos-types";
import { buildWhatsAppShareUrl, type ReceiptData } from "./receipt";

interface ReceiptScreenProps {
  sale: CompletedSale;
  onNewTransaction: () => void;
}

function toReceiptData(sale: CompletedSale): ReceiptData {
  return {
    orderNumber: sale.orderNumber,
    items: sale.items.map((i) => ({
      name: i.productName,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      lineTotal: i.unitPrice * i.quantity,
    })),
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    cashierName: sale.cashierName,
    createdAt: sale.createdAt,
  };
}

/**
 * gts_03_cashier_spec.md Part 5.3. The printable receipt below is a
 * @media-print styled block; "Print Receipt" opens the OS print dialog
 * (which can target any printer, including a thermal one, already set up on
 * the till's device) rather than a direct hardware integration (D001).
 */
export default function ReceiptScreen({ sale, onNewTransaction }: ReceiptScreenProps) {
  const receipt = toReceiptData(sale);

  function handlePrint() {
    window.print();
  }

  function handleWhatsAppShare() {
    window.open(buildWhatsAppShareUrl(receipt), "_blank");
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="no-print space-y-4 max-w-sm w-full">
        <div className="text-5xl">✓</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sale Complete!</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Order #{sale.orderNumber}
          <br />
          {formatKobo(sale.total)} — {sale.paymentMethod === "cash" ? "Cash" : "Card Terminal"}
        </p>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-2.5 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm"
          >
            Print Receipt
          </button>
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full py-2.5 rounded-[8px] bg-emerald-600 text-white font-bold text-sm"
          >
            Share via WhatsApp
          </button>
          <button
            type="button"
            onClick={onNewTransaction}
            className="w-full py-2.5 rounded-[8px] border border-gray-200 dark:border-[#383838] text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            New Transaction
          </button>
        </div>
      </div>

      <div className="print-only hidden">
        <h1>GTS</h1>
        <p>Order {receipt.orderNumber}</p>
        <p>{new Date(receipt.createdAt).toLocaleString("en-NG")}</p>
        <hr />
        {receipt.items.map((item, idx) => (
          <p key={idx}>
            {item.quantity} x {item.name}
            {item.size || item.color ? ` (${[item.size, item.color].filter(Boolean).join(" / ")})` : ""} —{" "}
            {formatKobo(item.lineTotal)}
          </p>
        ))}
        <hr />
        <p>Subtotal: {formatKobo(receipt.subtotal)}</p>
        {receipt.discountAmount > 0 && <p>Discount: -{formatKobo(receipt.discountAmount)}</p>}
        <p>Total: {formatKobo(receipt.total)}</p>
        <p>Payment: {receipt.paymentMethod === "cash" ? "Cash" : "Card Terminal"}</p>
        <p>Served by: {receipt.cashierName}</p>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-only,
          .print-only * {
            visibility: visible;
            display: block !important;
          }
          .print-only {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
