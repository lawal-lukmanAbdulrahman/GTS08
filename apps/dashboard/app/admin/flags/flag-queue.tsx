"use client";

import { useState } from "react";
import {
  FLAG_NOTE_MAX,
  FLAG_REASON_LABELS,
  FLAG_STATUSES,
  FLAG_STATUS_LABELS,
  formatWAT,
  type FlagReason,
  type FlagStatus,
} from "@gts/utils";

export interface QueueFlag {
  id: string;
  reason: FlagReason;
  note: string | null;
  status: FlagStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  product: { id: string; name: string } | null;
  raiser: { full_name: string | null; email: string | null } | null;
}

export type UpdateResult = { ok: true } | { ok: false; message: string };

interface Props {
  flags: QueueFlag[];
  counts: Record<FlagStatus, number>;
  status: FlagStatus;
  onStatusChange: (status: FlagStatus) => void;
  onUpdate: (id: string, update: { status: FlagStatus; resolution_note: string | null }) => Promise<UpdateResult>;
  loading?: boolean;
  error?: string | null;
}

const BUTTON = "px-3 py-1.5 text-xs font-semibold rounded-[6px]";

/** The admin's review queue of product flags raised by cashiers. */
export default function FlagQueue({ flags, counts, status, onStatusChange, onUpdate, loading, error }: Props) {
  const [closing, setClosing] = useState<{ id: string; as: "resolved" | "dismissed" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  async function send(id: string, next: FlagStatus, resolution: string | null) {
    setBusy(true);
    setUpdateError(null);
    const result = await onUpdate(id, { status: next, resolution_note: resolution });
    setBusy(false);
    if (!result.ok) {
      setUpdateError(result.message);
      return false;
    }
    setClosing(null);
    setNote("");
    return true;
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex flex-wrap gap-2">
        {FLAG_STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={status === s}
            onClick={() => onStatusChange(s)}
            className={`${BUTTON} ${status === s ? "bg-[#EDCF5D] text-[#010101]" : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300"}`}
          >
            {FLAG_STATUS_LABELS[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {(error || updateError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error ?? updateError}
        </p>
      )}

      {loading && flags.length === 0 ? (
        <p className="text-sm text-gray-500">Loading flags...</p>
      ) : flags.length === 0 && !error ? (
        <p className="text-sm text-gray-500">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {flags.map((flag) => (
            <li key={flag.id} className="rounded-[10px] border border-gray-200 dark:border-[#262626] p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{flag.product?.name ?? "Removed product"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {FLAG_REASON_LABELS[flag.reason]} · raised by {flag.raiser?.full_name ?? flag.raiser?.email ?? "unknown"} · {formatWAT(flag.created_at)}
                  </p>
                </div>
              </div>
              {flag.note && <p className="text-sm text-gray-700 dark:text-gray-200">{flag.note}</p>}
              {flag.resolution_note && (
                <p className="text-xs text-gray-600 dark:text-gray-300 border-l-2 border-[#EDCF5D] pl-2">Admin: {flag.resolution_note}</p>
              )}

              {closing?.id === flag.id ? (
                <div className="space-y-2 pt-1">
                  <label htmlFor={`note-${flag.id}`} className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Note for the cashier
                  </label>
                  <textarea
                    id={`note-${flag.id}`}
                    value={note}
                    maxLength={FLAG_NOTE_MAX}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setClosing(null);
                        setNote("");
                        setUpdateError(null);
                      }}
                      className={`${BUTTON} border border-gray-200 dark:border-[#383838]`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!note.trim() || busy}
                      onClick={() => send(flag.id, closing.as, note)}
                      className={`${BUTTON} bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#010101] disabled:opacity-40`}
                    >
                      {closing.as === "resolved" ? "Confirm resolve" : "Confirm dismiss"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {flag.status === "open" && (
                    <button type="button" disabled={busy} onClick={() => send(flag.id, "in_review", null)} className={`${BUTTON} bg-gray-100 dark:bg-[#242424]`}>
                      Start review
                    </button>
                  )}
                  {(flag.status === "open" || flag.status === "in_review") && (
                    <>
                      <button type="button" onClick={() => setClosing({ id: flag.id, as: "resolved" })} className={`${BUTTON} bg-emerald-600 text-white`}>
                        Resolve
                      </button>
                      <button type="button" onClick={() => setClosing({ id: flag.id, as: "dismissed" })} className={`${BUTTON} border border-gray-200 dark:border-[#383838]`}>
                        Dismiss
                      </button>
                    </>
                  )}
                  {(flag.status === "resolved" || flag.status === "dismissed") && (
                    <button type="button" disabled={busy} onClick={() => send(flag.id, "open", null)} className={`${BUTTON} border border-gray-200 dark:border-[#383838]`}>
                      Reopen
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
