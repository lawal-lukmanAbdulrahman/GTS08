"use client";

import { formatKobo, formatWAT } from "@gts/utils";
import type { SalesRangeId, SalesRecordView, Tally } from "../../lib/staff-types";

interface Props {
  range: SalesRangeId;
  onRangeChange: (range: SalesRangeId) => void;
  record: SalesRecordView | null;
  loading?: boolean;
  error?: string | null;
}

const RANGES: Array<{ id: SalesRangeId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "Last 30 days" },
];

const METHOD_LABEL: Record<string, string> = { cash: "Cash", pos_terminal: "Card" };
const CHANNEL_LABEL: Record<string, string> = { walk_in: "Walk-in", whatsapp: "WhatsApp" };

function Stat({ id, label, tally, money = true }: { id: string; label: string; tally: Tally; money?: boolean }) {
  return (
    <div data-testid={`stat-${id}`} className="rounded-[8px] border border-gray-200 dark:border-[#262626] p-3">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{money ? formatKobo(tally.total) : tally.count}</p>
      <p className="text-[11px] text-gray-400">{money ? `${tally.count} sale${tally.count === 1 ? "" : "s"}` : formatKobo(tally.total)}</p>
    </div>
  );
}

/** A staff member's sales: totals by payment method and channel, voids, discounts, and the latest sales. */
export default function SalesPanel({ range, onRangeChange, record, loading, error }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={range === r.id}
            onClick={() => onRangeChange(r.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              range === r.id ? "bg-[#EDCF5D] text-[#010101]" : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {!error && loading && !record && <p className="text-sm text-gray-500">Loading sales...</p>}

      {record && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div data-testid="stat-sales" className="col-span-2 rounded-[8px] bg-[#EDCF5D]/20 border border-[#EDCF5D]/60 p-3">
              <p className="text-[11px] text-gray-600 dark:text-gray-300">Total sales</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(record.summary.sales.total)}</p>
              <p className="text-[11px] text-gray-500">
                {record.summary.sales.count} sale{record.summary.sales.count === 1 ? "" : "s"} · {formatKobo(record.summary.sales.average)} average
              </p>
            </div>
            <Stat id="cash" label={METHOD_LABEL.cash!} tally={record.summary.by_payment_method.cash} />
            <Stat id="card" label={METHOD_LABEL.pos_terminal!} tally={record.summary.by_payment_method.pos_terminal} />
            <Stat id="walk_in" label={CHANNEL_LABEL.walk_in!} tally={record.summary.by_channel.walk_in} money={false} />
            <Stat id="whatsapp" label={CHANNEL_LABEL.whatsapp!} tally={record.summary.by_channel.whatsapp} />
            <Stat id="voided" label="Voided" tally={record.summary.voided} money={false} />
            <Stat id="discounts" label="Discounts given" tally={record.summary.discounts_given} />
          </div>

          {record.recent.length === 0 ? (
            <p className="text-sm text-gray-500">No sales in this period.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-[#262626] rounded-[8px] border border-gray-200 dark:border-[#262626]">
              {record.recent.map((sale) => (
                <li key={`${sale.order_number}-${sale.created_at}`} className="px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {sale.order_number}
                      {sale.status === "voided" && (
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-[#242424] dark:text-gray-400">
                          Voided
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {CHANNEL_LABEL[sale.channel] ?? sale.channel} · {METHOD_LABEL[sale.payment_method] ?? sale.payment_method} · {formatWAT(sale.created_at)}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${sale.status === "voided" ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}>
                    {formatKobo(sale.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
