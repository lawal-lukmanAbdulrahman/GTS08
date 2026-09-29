"use client";

import { useState } from "react";
import { formatKobo, formatWAT, parseWhatsAppContact } from "@gts/utils";
import type { SaleRecordItem } from "./sale-excel-service";
import { fetchAndDownloadReceipt, fetchAndPrintReceipt } from "../../pos/receipt-pdf";
import { buildWhatsAppShareUrl, type ReceiptData } from "../../pos/receipt";

interface SaleInfoDrawerProps {
  sale: SaleRecordItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SaleInfoDrawer({ sale, isOpen, onClose }: SaleInfoDrawerProps) {
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  if (!isOpen || !sale) return null;

  const contact = sale.channel === "whatsapp" ? parseWhatsAppContact(sale.internal_notes) : null;
  const customerName = contact?.name || sale.customer?.full_name || (sale.channel === "walk_in" ? "Walk-in Guest" : "Customer");
  const customerPhone = contact?.phone || sale.customer?.phone || null;
  const customerEmail = sale.customer?.email || null;

  const handleDownload = async () => {
    setDownloading(true);
    setReceiptError(null);
    const result = await fetchAndDownloadReceipt(sale.id);
    if (!result.ok) {
      setReceiptError(result.message);
    }
    setDownloading(false);
  };

  const handlePrint = async () => {
    setPrinting(true);
    setReceiptError(null);
    const result = await fetchAndPrintReceipt(sale.id);
    if (!result.ok) {
      setReceiptError(result.message);
    }
    setPrinting(false);
  };

  const handleWhatsAppShare = () => {
    const receiptData: ReceiptData = {
      orderNumber: sale.order_number,
      items: (sale.items || []).map((i) => ({
        name: i.product_snapshot?.name || "Item",
        size: i.product_snapshot?.size || null,
        color: i.product_snapshot?.color || null,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        lineTotal: i.line_total,
      })),
      subtotal: sale.subtotal || sale.total,
      discountAmount: sale.discount_amount || 0,
      total: sale.total,
      paymentMethod: (sale.payment_method === "pos_terminal" ? "pos_terminal" : "cash") as "cash" | "pos_terminal",
      cashierName: sale.cashier_name || "GTS Staff",
      createdAt: sale.created_at,
      channel: sale.channel === "whatsapp" ? "whatsapp" : "walk_in",
      customerName: customerName,
      customerPhone: customerPhone || undefined,
    };
    window.open(buildWhatsAppShareUrl(receiptData, customerPhone || undefined), "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-12">
        <div className="w-screen max-w-2xl bg-white dark:bg-[#161616] border-l border-gray-200 dark:border-[#262626] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#242424] flex items-center justify-between bg-white dark:bg-[#161616] sticky top-0 z-20">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                {sale.order_number}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  sale.channel === "walk_in"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    : sale.channel === "whatsapp"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                }`}
              >
                {sale.channel === "walk_in" ? "Walk-in" : sale.channel === "whatsapp" ? "WhatsApp" : "Storefront"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {sale.payment_status?.toUpperCase() === "PAID" || sale.status === "completed" || sale.status === "collected" ? "Paid" : sale.status}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#222] transition-colors cursor-pointer text-lg font-bold"
              aria-label="Close drawer"
            >
              &times;
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {receiptError && (
              <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs font-medium text-red-600 dark:text-red-400">
                {receiptError}
              </div>
            )}

            {/* Quick Actions (Receipt & Share) */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1E1E1E] border border-gray-200/80 dark:border-[#2C2C2C] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  Receipt & Documents
                </span>
                <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
                  {formatWAT(sale.created_at)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {/* Download Receipt PDF */}
                <button
                  type="button"
                  disabled={downloading}
                  onClick={handleDownload}
                  className="flex-1 min-w-[130px] py-2 px-3 rounded-lg text-xs font-bold border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2F2F2F] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {downloading ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  )}
                  <span>Download Receipt</span>
                </button>

                {/* Print Receipt */}
                <button
                  type="button"
                  disabled={printing}
                  onClick={handlePrint}
                  className="flex-1 min-w-[130px] py-2 px-3 rounded-lg text-xs font-bold bg-[#EDCF5D] hover:bg-[#e2c34d] text-[#010101] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {printing ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.076-.672-2.03-1.27-2.829m13.05 0c-.598.799-1.03 1.753-1.27 2.829m-10.51 0a24.25 24.25 0 0110.51 0m-10.51 0L4.5 18.75m15 0l-1.72-4.921M8.25 9.75h7.5M8.25 6.75h7.5M6 18.75h12M6 18.75a2.25 2.25 0 01-2.25-2.25V9.75a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25 2.25" />
                    </svg>
                  )}
                  <span>Print Receipt</span>
                </button>

                {/* WhatsApp Share (for WhatsApp sales or customer with phone) */}
                {(sale.channel === "whatsapp" || customerPhone) && (
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    className="w-full sm:w-auto py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.874-1.006l.732-1.755A7.838 7.838 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    <span>Share via WhatsApp</span>
                  </button>
                )}
              </div>
            </div>

            {/* Customer Information Card */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1A1A1A] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Customer Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 dark:text-gray-500 block">Name</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {customerName}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 dark:text-gray-500 block">Phone</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    {customerPhone || "—"}
                  </span>
                </div>

                {customerEmail && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-400 dark:text-gray-500 block">Email</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {customerEmail}
                    </span>
                  </div>
                )}

                {sale.internal_notes && (
                  <div className="sm:col-span-2 pt-1 border-t border-gray-100 dark:border-[#262626]">
                    <span className="text-gray-400 dark:text-gray-500 block">Internal Notes</span>
                    <p className="text-gray-700 dark:text-gray-300 font-mono text-[11px] mt-0.5">
                      {sale.internal_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Transaction Details */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1A1A1A] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                Payment Details
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 dark:text-gray-500 block">Method</span>
                  <span className="font-semibold text-gray-900 dark:text-white capitalize">
                    {sale.payment_method === "pos_terminal"
                      ? "Card Terminal (POS)"
                      : sale.payment_method === "cash"
                      ? "Cash"
                      : sale.payment_method || "Online"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 dark:text-gray-500 block">Status</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                    {sale.payment_status || "Paid"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 dark:text-gray-500 block">Processed By</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {sale.cashier_name || "GTS Staff"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 dark:text-gray-500 block">Date & Time</span>
                  <span className="font-mono text-gray-800 dark:text-gray-200">
                    {formatWAT(sale.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Purchased Items Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Purchased Items ({sale.items?.reduce((n, i) => n + i.quantity, 0) || 0})
              </h3>

              <div className="rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-[#1F1F1F] text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-[#262626]">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-2 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#242424]">
                    {sale.items && sale.items.length > 0 ? (
                      sale.items.map((item) => {
                        const variant = [item.product_snapshot?.size, item.product_snapshot?.color].filter(Boolean).join(" / ");
                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-[#202020]">
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {item.product_snapshot?.name || "Product Item"}
                              </p>
                              {variant && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                                  {variant}
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono font-medium text-gray-800 dark:text-gray-200">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-gray-600 dark:text-gray-300">
                              {formatKobo(item.unit_price)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                              {formatKobo(item.line_total)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                          No item records available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#262626] space-y-2">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span className="font-mono">{formatKobo(sale.subtotal || sale.total)}</span>
              </div>
              {sale.discount_amount && sale.discount_amount > 0 ? (
                <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono">-{formatKobo(sale.discount_amount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-[#2C2C2C]">
                <span>Total Amount</span>
                <span className="font-mono text-base">{formatKobo(sale.total)}</span>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t border-gray-100 dark:border-[#242424] bg-gray-50 dark:bg-[#191919] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-[#383838] bg-white dark:bg-[#222] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2B2B2B] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
