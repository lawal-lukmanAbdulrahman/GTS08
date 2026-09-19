"use client";

import { useMemo, useState } from "react";
import { formatKobo } from "@gts/utils";
import type { CompletedSale } from "./pos-types";
import { buildWhatsAppShareUrl, type ReceiptData, type ReceiptStore } from "./receipt";
import { PAPER_SIZES, layoutReceipt, paperCss, type PaperSize } from "./receipt-layout";
import { loadPaperSize, savePaperSize } from "./receipt-paper";

interface ReceiptScreenProps {
  sale: CompletedSale;
  /** Header details from the admin's store settings; a bare "GTS" header if absent. */
  store?: ReceiptStore;
  onNewTransaction: () => void;
}

function toReceiptData(sale: CompletedSale, store?: ReceiptStore): ReceiptData {
  return {
    orderNumber: sale.orderNumber,
    items: sale.items.map((i) => ({
      name: i.productName,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.unitPrice * i.quantity,
    })),
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    cashierName: sale.cashierName,
    createdAt: sale.createdAt,
    channel: sale.channel,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    cashReceived: sale.cashReceived,
    duplicate: sale.duplicate,
    store,
  };
}

const PAPER_ORDER: PaperSize[] = ["58mm", "80mm", "a4"];

/**
 * gts_03_cashier_spec.md Part 5.3, extended (D001): a live preview of the
 * receipt at the chosen paper size, printed through the browser's print
 * dialog (so any installed receipt printer or an A4 printer works), or shared
 * to the customer over WhatsApp. The preview and the printed page come from
 * the same layout, so what's on screen is what prints.
 */
export default function ReceiptScreen({ sale, store, onNewTransaction }: ReceiptScreenProps) {
  const [paper, setPaper] = useState<PaperSize>(() => loadPaperSize());
  const receipt = useMemo(() => toReceiptData(sale, store), [sale, store]);
  const lines = useMemo(() => layoutReceipt(receipt, paper), [receipt, paper]);

  function choosePaper(next: PaperSize) {
    setPaper(next);
    savePaperSize(next);
  }

  function handleWhatsAppShare() {
    window.open(buildWhatsAppShareUrl(receipt, sale.customerPhone), "_blank");
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#1C1C1C] p-6 font-sans">
      <div className="mx-auto max-w-5xl grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr] items-start">
        <div className="no-print space-y-5">
          <div className="text-center md:text-left space-y-1">
            <div className="text-4xl text-emerald-600">✓</div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sale Complete!</h2>
            <p className="text-base text-gray-600 dark:text-gray-300">
              Order #{sale.orderNumber}
              <br />
              {formatKobo(sale.total)} — {sale.paymentMethod === "cash" ? "Cash" : "Card Terminal"}
            </p>
          </div>

          <div role="group" aria-label="Paper size" className="space-y-1.5">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Paper size</p>
            <div className="flex gap-2">
              {PAPER_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={paper === id}
                  onClick={() => choosePaper(id)}
                  className={`flex-1 py-2 rounded-[6px] text-sm font-semibold border transition-all ${
                    paper === id
                      ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]"
                      : "border-gray-200 dark:border-[#383838] text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {PAPER_SIZES[id].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose the paper loaded in your printer. In the print dialog, pick the receipt printer and turn
              off &quot;Headers and footers&quot;.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-base"
            >
              Print Receipt
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full py-2.5 rounded-[8px] bg-emerald-600 text-white font-bold text-base"
            >
              Share via WhatsApp
            </button>
            <button
              type="button"
              onClick={onNewTransaction}
              className="w-full py-2.5 rounded-[8px] border border-gray-200 dark:border-[#383838] text-base font-semibold text-gray-700 dark:text-gray-200"
            >
              New Transaction
            </button>
          </div>
        </div>

        <div className="receipt-preview overflow-x-auto" style={{ zoom: paper === "a4" ? 0.75 : 1 }}>
          <div className="inline-block bg-white text-black shadow-lg rounded-[4px] px-[5mm] py-[4mm] border border-gray-200">
            <pre className="receipt-sheet m-0">{lines.join("\n")}</pre>
          </div>
        </div>
      </div>

      <style>{paperCss(paper, lines.length)}</style>
    </div>
  );
}
