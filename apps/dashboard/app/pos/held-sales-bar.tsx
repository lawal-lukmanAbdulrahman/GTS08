"use client";

import { formatKobo } from "@gts/utils";
import type { HeldSale } from "./held-sales";

interface Props {
  sales: HeldSale[];
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
}

/** Sales parked while the cashier served someone else. */
export default function HeldSalesBar({ sales, onResume, onDiscard }: Props) {
  if (sales.length === 0) return null;
  return (
    <div className="px-6 py-3 border-b border-gray-200 dark:border-[#262626] bg-amber-50 dark:bg-amber-900/10 space-y-1.5">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Held sales ({sales.length})</p>
      <ul className="flex flex-wrap gap-2">
        {sales.map((sale) => {
          const units = sale.lines.reduce((n, l) => n + l.quantity, 0);
          const total = sale.lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
          const time = new Date(sale.heldAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
          return (
            <li key={sale.id} className="flex items-center gap-2 rounded-[8px] bg-white dark:bg-[#1C1C1C] border border-amber-200 dark:border-amber-900/40 px-3 py-1.5 text-sm">
              <span className="text-gray-700 dark:text-gray-200">
                {units} item{units === 1 ? "" : "s"} · <strong>{formatKobo(total)}</strong> · {time}
              </span>
              <button type="button" onClick={() => onResume(sale.id)} className="font-semibold text-gray-900 dark:text-white underline min-h-[32px]">
                Resume
              </button>
              <button type="button" onClick={() => onDiscard(sale.id)} className="text-gray-500 underline min-h-[32px]" aria-label="Discard held sale">
                Discard
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
