"use client";

import { useState } from "react";

interface Props {
  name: string;
  onRemove: () => Promise<{ ok: true } | { ok: false; message: string }>;
  onRemoved: () => void;
}

/** The super admin removes a staff member for good: the login stops working, their history keeps their name. */
export default function RemoveStaff({ name, onRemove, onRemoved }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    const r = await onRemove();
    setBusy(false);
    if (r.ok) onRemoved();
    else {
      setError(r.message);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {name} can&apos;t sign in again and disappears from the staff list. The sales and logs they made stay on record under their name. This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-gray-200 dark:border-[#383838]">
              Keep {name}
            </button>
            <button type="button" onClick={() => void remove()} disabled={busy} className="px-3 py-1.5 text-xs font-bold rounded-[6px] bg-red-600 text-white disabled:opacity-50">
              {busy ? "Removing..." : "Yes, remove"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="px-3.5 py-1.5 text-xs font-bold rounded-[6px] border border-red-300 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
          Remove {name}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
