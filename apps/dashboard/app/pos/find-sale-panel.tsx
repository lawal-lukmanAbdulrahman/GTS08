"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatKobo, formatWAT } from "@gts/utils";

export interface FoundSale {
  id: string;
  order_number: string;
  channel: "walk_in" | "whatsapp";
  status: string;
  total: number;
  created_at: string;
}

export interface SaleQuery {
  q: string;
  from: string;
  to: string;
}

type SearchResult = { ok: true; data: FoundSale[] } | { ok: false; message: string };

interface Props {
  onSearch: (query: SaleQuery) => Promise<SearchResult>;
  onReprint: (orderId: string) => void;
  reprintError?: string | null;
  onClose: () => void;
}

const CHANNEL = { walk_in: "Walk-in", whatsapp: "WhatsApp" } as const;
const FIELD = "w-full px-3 py-2 text-base rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent";
const LABEL = "block text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1";

/** Look up a past sale by order number and/or date, to reprint its receipt for a returning customer. */
export default function FindSalePanel({ onSearch, onReprint, reprintError, onClose }: Props) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sales, setSales] = useState<FoundSale[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (query: SaleQuery) => {
      setLoading(true);
      setError(null);
      const result = await onSearch(query);
      if (result.ok) setSales(result.data);
      else setError(result.message);
      setLoading(false);
    },
    [onSearch]
  );

  // The list of recent sales, once on open (the parent may hand us a new onSearch every render).
  const loadedRecent = useRef(false);
  useEffect(() => {
    if (loadedRecent.current) return;
    loadedRecent.current = true;
    void search({ q: "", from: "", to: "" });
  }, [search]);

  const message = error ?? reprintError ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#1C1C1C] overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Find a sale</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-w-[44px] min-h-[44px] text-2xl text-gray-400">
            &times;
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search({ q: q.trim(), from, to });
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="find-q" className={LABEL}>Order number</label>
            <input id="find-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 000123" className={FIELD} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="find-from" className={LABEL}>From</label>
              <input id="find-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label htmlFor="find-to" className={LABEL}>To</label>
              <input id="find-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={FIELD} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 text-base font-bold rounded-[8px] bg-[#EDCF5D] text-[#010101] disabled:opacity-60">
            Search
          </button>
        </form>

        {message && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {message}
          </p>
        )}

        {loading && !sales ? (
          <p className="text-base text-gray-500">Loading sales...</p>
        ) : sales && sales.length === 0 ? (
          <p className="text-base text-gray-500">No sales found.</p>
        ) : (
          <ul className="space-y-2">
            {(sales ?? []).map((sale) => (
              <li key={sale.id} className="rounded-[8px] border border-gray-200 dark:border-[#262626] p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{sale.order_number}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatWAT(sale.created_at)} · {CHANNEL[sale.channel]}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-gray-900 dark:text-white">{formatKobo(sale.total)}</p>
                  {sale.status === "completed" ? (
                    <button type="button" onClick={() => onReprint(sale.id)} className="text-sm font-semibold underline min-h-[44px]">
                      Reprint
                    </button>
                  ) : (
                    <span className="text-sm text-gray-500 capitalize">{sale.status}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
