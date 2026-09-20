"use client";

import { useState } from "react";
import { validatePhoneNumber } from "@gts/utils";

export type PhoneSaveResult =
  | { ok: true; phone: string | null }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

interface Props {
  initialPhone: string | null;
  onSave: (phone: string) => Promise<PhoneSaveResult>;
}

/** A staff member edits their own phone number (the only contact detail they may change). */
export default function PhoneForm({ initialPhone, onSave }: Props) {
  const [saved, setSaved] = useState(initialPhone ?? "");
  const [value, setValue] = useState(initialPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const dirty = value !== saved;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || status === "saving") return;

    const check = validatePhoneNumber(value);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setStatus("saving");
    setError(null);
    const result = await onSave(check.value ?? "");
    if (result.ok) {
      const next = result.phone ?? "";
      setSaved(next);
      setValue(next);
      setStatus("saved");
    } else {
      setStatus("idle");
      setError(result.fieldErrors?.phone ?? result.message);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 max-w-sm">
      <div className="space-y-1">
        <label htmlFor="profile-phone" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Phone number
        </label>
        <input
          id="profile-phone"
          type="tel"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
            setError(null);
          }}
          aria-invalid={!!error}
          className={`w-full px-3 py-2 text-sm rounded-[6px] border bg-white dark:bg-[#1C1C1C] ${
            error ? "border-red-500" : "border-gray-200 dark:border-[#383838]"
          }`}
        />
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Your email and role are managed by an admin.</p>
        )}
      </div>
      {status === "saved" && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
          Phone number saved.
        </p>
      )}
      <button
        type="submit"
        disabled={!dirty || status === "saving"}
        className="px-4 py-2 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "saving" ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
