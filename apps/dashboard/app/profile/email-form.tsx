"use client";

import { useState } from "react";

export interface EmailChangeInput {
  new_email: string;
  current_password: string;
}

export type EmailChangeOutcome =
  | { ok: true; email: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

interface Props {
  currentEmail: string | null;
  onSave: (input: EmailChangeInput) => Promise<EmailChangeOutcome>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailForm({ currentEmail, onSave }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "saving") return;

    const fieldErrors: Record<string, string> = {};
    const trimmed = newEmail.trim().toLowerCase();

    if (!trimmed) {
      fieldErrors.new_email = "Enter your new email address.";
    } else if (!EMAIL_REGEX.test(trimmed)) {
      fieldErrors.new_email = "Enter a valid email address.";
    } else if (trimmed === (currentEmail || "").toLowerCase()) {
      fieldErrors.new_email = "New email must be different from your current email.";
    }

    if (!currentPassword) {
      fieldErrors.current_password = "Enter your current password to authorize this change.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setStatus("saving");
    setFormError(null);
    setErrors({});

    const result = await onSave({ new_email: trimmed, current_password: currentPassword });
    if (result.ok) {
      setSavedEmail(result.email);
      setNewEmail("");
      setCurrentPassword("");
      setErrors({});
      setStatus("saved");
      return;
    }

    setStatus("idle");
    setErrors(result.fieldErrors ?? {});
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      setFormError(result.message);
    }
    // Clear password on error
    setCurrentPassword("");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 max-w-sm">
      <div className="space-y-1">
        <label htmlFor="email-new" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          New email address
        </label>
        <input
          id="email-new"
          type="email"
          autoComplete="email"
          placeholder="new-email@example.com"
          value={newEmail}
          onChange={(e) => {
            setNewEmail(e.target.value);
            setStatus("idle");
            setFormError(null);
            setErrors((prev) => {
              const { new_email: _gone, ...rest } = prev;
              return rest;
            });
          }}
          aria-invalid={!!errors.new_email}
          className={`w-full px-3 py-2 text-sm rounded-[6px] border bg-white dark:bg-[#1C1C1C] text-gray-900 dark:text-white ${
            errors.new_email ? "border-red-500" : "border-gray-200 dark:border-[#383838]"
          }`}
        />
        {errors.new_email && <p className="text-xs text-red-600 dark:text-red-400">{errors.new_email}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="email-password" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Current password
        </label>
        <div className="relative">
          <input
            id="email-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Verify your identity"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setStatus("idle");
              setFormError(null);
              setErrors((prev) => {
                const { current_password: _gone, ...rest } = prev;
                return rest;
              });
            }}
            aria-invalid={!!errors.current_password}
            className={`w-full px-3 py-2 pr-10 text-sm rounded-[6px] border bg-white dark:bg-[#1C1C1C] text-gray-900 dark:text-white ${
              errors.current_password ? "border-red-500" : "border-gray-200 dark:border-[#383838]"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-medium"
            tabIndex={-1}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {errors.current_password && <p className="text-xs text-red-600 dark:text-red-400">{errors.current_password}</p>}
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Required to authorize sensitive credential updates.</p>
      </div>

      {formError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {formError}
        </p>
      )}

      {status === "saved" && (
        <div role="status" className="p-3 rounded-[8px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
          Email address successfully updated to <strong>{savedEmail}</strong>.
        </div>
      )}

      <button
        type="submit"
        disabled={status === "saving" || !newEmail || !currentPassword}
        className="px-4 py-2 rounded-[8px] bg-[#EDCF5D] text-[#010101] font-bold text-sm hover:brightness-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "saving" ? "Updating email..." : "Update email"}
      </button>
    </form>
  );
}
