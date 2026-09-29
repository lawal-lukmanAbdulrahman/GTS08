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
import { AdminTopStrip } from "../admin/sidebar-context";
import { downloadReceiptPdf } from "./receipt-pdf";

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
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#F8F7F4] dark:bg-[#1C1C1C] p-3 sm:p-5 font-sans space-y-3 overflow-hidden">
      {/* Top Strip with Breadcrumbs and Sidebar Toggle */}
      <div className="no-print shrink-0">
        <AdminTopStrip
          breadcrumbs={[
            { label: "POS Terminal", href: "/pos" },
            { label: `Receipt #${sale.orderNumber}` },
          ]}
        />
      </div>

      <div className="w-full max-w-[1600px] mx-auto grid gap-6 lg:grid-cols-[22rem_1fr] flex-1 min-h-0 overflow-hidden items-stretch">
        {/* Left Action Panel (independent scroll) */}
        <div className="no-print space-y-4 h-full overflow-y-auto pr-1 [scrollbar-width:thin]">
          {/* Back to POS Button */}
          <button
            type="button"
            onClick={onNewTransaction}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#252525] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors cursor-pointer shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Back to POS</span>
          </button>

          <div className="text-center md:text-left space-y-1">
            <div className="text-3xl text-emerald-600">✓</div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sale Complete!</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Order #{sale.orderNumber}
              <br />
              {formatKobo(sale.total)} — {sale.paymentMethod === "cash" ? "Cash" : "Card Terminal"}
            </p>
          </div>

          <div role="group" aria-label="Paper size" className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Paper size</p>
            <div className="flex gap-2">
              {PAPER_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={paper === id}
                  onClick={() => choosePaper(id)}
                  className={`flex-1 py-1.5 rounded-[6px] text-xs font-semibold border transition-all cursor-pointer ${
                    paper === id
                      ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]"
                      : "border-gray-200 dark:border-[#383838] text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {PAPER_SIZES[id].label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Choose the paper loaded in your printer. In the print dialog, pick the receipt printer and turn
              off &quot;Headers and footers&quot;.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-[8px] bg-[#EDCF5D] hover:bg-[#e2c34d] text-[#010101] font-bold text-sm transition-all cursor-pointer shadow-xs"
            >
              Print Receipt
            </button>
            <button
              type="button"
              onClick={() => downloadReceiptPdf(receipt)}
              className="w-full py-2.5 rounded-[8px] border border-gray-300 dark:border-[#383838] bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-200 font-bold text-sm hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Download Receipt (PDF)</span>
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full py-2.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all cursor-pointer shadow-xs"
            >
              Share via WhatsApp
            </button>
            <button
              type="button"
              onClick={onNewTransaction}
              className="w-full py-2.5 rounded-[8px] border border-gray-200 dark:border-[#383838] text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#252525] transition-all cursor-pointer"
            >
              New Transaction
            </button>
          </div>
        </div>

        {/* Right Side: Large, Centered, Fully Arranged Receipt Preview (independent scroll) */}
        <div
          className="receipt-preview w-full h-full overflow-y-auto bg-gray-100/70 dark:bg-[#141414] p-4 sm:p-8 rounded-[16px] border border-gray-200 dark:border-[#282828] shadow-inner flex justify-center items-start [scrollbar-width:thin]"
          style={{ zoom: paper === "a4" ? 0.75 : 1 }}
        >
          <div
            className={`bg-white text-black shadow-2xl rounded-[8px] p-6 sm:p-8 border border-gray-200 w-full transition-all flex flex-col items-center ${
              paper === "58mm" ? "max-w-[380px]" : paper === "80mm" ? "max-w-[490px]" : "max-w-[760px]"
            }`}
          >
            <pre className="receipt-sheet m-0 font-mono leading-relaxed whitespace-pre font-medium w-full text-left overflow-x-auto">
              {lines.join("\n")}
            </pre>
          </div>
        </div>
      </div>

      <style>{paperCss(paper, lines.length)}</style>
    </div>
  );
}
