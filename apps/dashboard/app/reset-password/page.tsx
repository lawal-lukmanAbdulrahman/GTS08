"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { validateNewPassword } from "@gts/utils";
import { API_BASE } from "../lib/api-base";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [linkError, setLinkError] = useState<string | null>(token ? null : "This reset link is invalid or has expired.");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLinkError(null);
    // The password is sent exactly as typed: it is never sanitised, only checked.
    const check = validateNewPassword(next, confirm);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: next, confirm_password: confirm }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; code?: string; details?: Record<string, string> } | null;
      if (res.ok) setDone(true);
      else if (json?.details) setErrors(json.details);
      else setLinkError(json?.error || "Something went wrong. Please try again.");
    } catch {
      setLinkError("Unable to connect to the GTS server. Please check your network connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-full border border-gray-200 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium outline-none focus:border-[#010101] focus:ring-1 focus:ring-[#010101]";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0A] font-sans">
      <div className="w-full max-w-md bg-white rounded-[28px] p-6 sm:p-8 text-[#010101] shadow-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">Choose a new password</h1>

        {done ? (
          <>
            <p role="status" className="p-3.5 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-xs font-semibold mb-4">
              Your password has been changed. You've been signed out everywhere.
            </p>
            <Link href="/login" className="block text-center rounded-full bg-[#010101] text-white py-3 font-bold text-xs sm:text-sm">Sign in</Link>
          </>
        ) : (
          <>
            {linkError && (
              <div role="alert" className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {linkError} <Link href="/forgot-password" className="underline">Request a new link</Link>
              </div>
            )}
            {token && (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="new-password" className="block text-xs font-bold text-gray-700 mb-1">New password</label>
                  <input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
                  {errors.new_password && <p className="text-red-600 text-[11px] font-semibold mt-1.5 px-2">{errors.new_password}</p>}
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-bold text-gray-700 mb-1">Confirm new password</label>
                  <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
                  {errors.confirm_password && <p className="text-red-600 text-[11px] font-semibold mt-1.5 px-2">{errors.confirm_password}</p>}
                </div>
                <button type="submit" disabled={loading} className="w-full rounded-full bg-[#010101] text-white py-3 font-bold text-xs sm:text-sm hover:bg-[#EDCF5D] hover:text-[#010101] transition-all disabled:opacity-50">
                  {loading ? "Saving..." : "Set new password"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
