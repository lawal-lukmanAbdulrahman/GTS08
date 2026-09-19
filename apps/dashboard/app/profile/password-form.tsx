"use client";

import { useState } from "react";
import { validatePasswordChange } from "@gts/utils";

export interface PasswordChangeInput {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export type PasswordChangeOutcome =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

interface Props {
  onSubmit: (input: PasswordChangeInput) => Promise<PasswordChangeOutcome>;
}

const FIELDS: Array<{ key: keyof PasswordChangeInput; label: string }> = [
  { key: "current_password", label: "Current password" },
  { key: "new_password", label: "New password" },
  { key: "confirm_password", label: "Confirm new password" },
];

const EMPTY: PasswordChangeInput = { current_password: "", new_password: "", confirm_password: "" };

/** Change your own password: current + new + confirm (employee spec Part 8). */
export default function PasswordForm({ onSubmit }: Props) {
  const [values, setValues] = useState<PasswordChangeInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  function change(key: keyof PasswordChangeInput, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus("idle");
    setFormError(null);
    setErrors((e) => {
      const { [key]: _gone, ...rest } = e;
      return rest;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "saving") return;

    const check = validatePasswordChange({ current: values.current_password, next: values.new_password, confirm: values.confirm_password });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }

    setStatus("saving");
    setFormError(null);
    const result = await onSubmit(values);
    if (result.ok) {
      setValues(EMPTY);
      setErrors({});
      setStatus("saved");
      return;
    }
    setStatus("idle");
    setErrors(result.fieldErrors ?? {});
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) setFormError(result.message);
    // Never leave a wrong password sitting in the box.
    setValues((v) => ({ ...v, current_password: "" }));
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 max-w-sm">
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <label htmlFor={`pw-${key}`} className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {label}
          </label>
          <input
            id={`pw-${key}`}
            type="password"
            autoComplete={key === "current_password" ? "current-password" : "new-password"}
            value={values[key]}
            onChange={(e) => change(key, e.target.value)}
            aria-invalid={!!errors[key]}
            className={`w-full px-3 py-2 text-sm rounded-[6px] border bg-white dark:bg-[#1C1C1C] ${
              errors[key] ? "border-red-500" : "border-gray-200 dark:border-[#383838]"
            }`}
          />
          {errors[key] && <p className="text-xs text-red-600 dark:text-red-400">{errors[key]}</p>}
        </div>
      ))}
      <p className="text-[11px] text-gray-500 dark:text-gray-400">At least 8 characters, with a letter and a number.</p>

      {formError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {formError}
        </p>
      )}
      {status === "saved" && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
          Password changed.
        </p>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        className="px-4 py-2 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "saving" ? "Changing..." : "Change password"}
      </button>
    </form>
  );
}
