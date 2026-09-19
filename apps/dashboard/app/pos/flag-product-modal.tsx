"use client";

import { useEffect, useState } from "react";
import { FLAG_NOTE_MAX, FLAG_REASONS, FLAG_REASON_LABELS, type FlagReason } from "@gts/utils";

export type FlagSubmitResult = { ok: true } | { ok: false; message: string };

interface Props {
  productName: string;
  onSubmit: (input: { reason: FlagReason; note: string }) => Promise<FlagSubmitResult>;
  onClose: () => void;
}

/** A cashier reports a problem with a product (wrong price, stock off, damaged, ...) for an admin to review. */
export default function FlagProductModal({ productName, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || status === "sending") return;

    const cleaned = note.replace(/\s+/g, " ").trim();
    if (reason === "other" && !cleaned) {
      setError("Tell us what's wrong.");
      return;
    }

    setStatus("sending");
    setError(null);
    const result = await onSubmit({ reason, note: cleaned });
    if (result.ok) setStatus("sent");
    else {
      setStatus("idle");
      setError(result.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="flag-title" className="w-full max-w-sm rounded-[12px] bg-white dark:bg-[#1C1C1C] p-5">
        {status === "sent" ? (
          <div className="space-y-4 text-center">
            <p className="text-3xl text-emerald-600">✓</p>
            <p id="flag-title" className="text-sm font-bold text-gray-900 dark:text-white">
              Thanks — flag sent
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">An admin will review the problem with {productName}. You can follow it on your profile.</p>
            <button type="button" onClick={onClose} className="w-full py-2.5 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={send} noValidate className="space-y-4">
            <div>
              <h2 id="flag-title" className="text-base font-bold text-gray-900 dark:text-white">
                Flag a problem
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{productName}</p>
            </div>

            <div role="radiogroup" aria-label="What's wrong?" className="grid grid-cols-1 gap-1.5">
              {FLAG_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  aria-label={FLAG_REASON_LABELS[r]}
                  onClick={() => {
                    setReason(r);
                    setError(null);
                  }}
                  className={`text-left px-3 py-2 rounded-[6px] text-xs font-semibold border ${
                    reason === r ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101]" : "border-gray-200 dark:border-[#383838] text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {FLAG_REASON_LABELS[r]}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label htmlFor="flag-note" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                Note {reason === "other" ? "(required)" : "(optional)"}
              </label>
              <textarea
                id="flag-note"
                rows={3}
                maxLength={FLAG_NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent"
              />
              <p className="text-[11px] text-gray-400 text-right">{note.length}/{FLAG_NOTE_MAX}</p>
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-[8px] border border-gray-200 dark:border-[#383838] text-sm font-semibold text-gray-700 dark:text-gray-200">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!reason || status === "sending"}
                className="flex-1 py-2.5 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === "sending" ? "Sending..." : "Send flag"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
