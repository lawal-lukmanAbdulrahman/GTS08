"use client";

import { FLAG_REASON_LABELS, FLAG_STATUS_LABELS, formatWAT, type FlagReason, type FlagStatus } from "@gts/utils";

export interface MyFlag {
  id: string;
  reason: FlagReason;
  note: string | null;
  status: FlagStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  product: { name: string } | null;
}

interface Props {
  flags: MyFlag[];
  loading?: boolean;
  error?: string | null;
}

const BADGE: Record<FlagStatus, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  in_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  dismissed: "bg-gray-100 text-gray-600 dark:bg-[#242424] dark:text-gray-400",
};

/** The product flags this staff member has raised, and what the admin said back. */
export default function MyFlags({ flags, loading, error }: Props) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }
  if (loading && flags.length === 0) return <p className="text-sm text-gray-500">Loading flags...</p>;
  if (flags.length === 0) return <p className="text-sm text-gray-500">You haven&apos;t flagged anything yet.</p>;

  return (
    <ul className="divide-y divide-gray-100 dark:divide-[#262626] rounded-[8px] border border-gray-200 dark:border-[#262626]">
      {flags.map((flag) => (
        <li key={flag.id} className="px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {flag.product?.name ?? "Removed product"} <span className="font-normal text-gray-500">· {FLAG_REASON_LABELS[flag.reason]}</span>
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE[flag.status]}`}>{FLAG_STATUS_LABELS[flag.status]}</span>
          </div>
          {flag.note && <p className="text-xs text-gray-600 dark:text-gray-300">{flag.note}</p>}
          {flag.resolution_note && (
            <p className="text-xs text-gray-600 dark:text-gray-300 border-l-2 border-[#EDCF5D] pl-2">Admin: {flag.resolution_note}</p>
          )}
          <p className="text-[11px] text-gray-400">{formatWAT(flag.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}
