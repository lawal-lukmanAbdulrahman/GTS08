"use client";

import Link from "next/link";
import { useState } from "react";
import { API_BASE } from "../lib/api-base";

const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Staff ask for a password-reset link. The answer never says whether the address has an account. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!EMAIL.test(clean)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      if (res.ok) setSent(true);
      else setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error || "Something went wrong. Please try again.");
    } catch {
      setError("Unable to connect to the GTS server. Please check your network connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0A] font-sans">
      <div className="w-full max-w-md bg-white rounded-[28px] p-6 sm:p-8 text-[#010101] shadow-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">Forgot your password?</h1>
        <p className="text-xs text-gray-500 mb-6">Enter your staff email and we'll send you a link to choose a new one.</p>

        {sent ? (
          <p role="status" className="p-3.5 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-xs font-semibold">
            If that address has an account, a reset link is on its way. It works once and expires in 1 hour.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="staff-email" className="block text-xs font-bold text-gray-700 mb-1">Staff email</label>
              <input
                id="staff-email"
                type="email"
                autoComplete="username"
                placeholder="admin@gts.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-gray-200 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium outline-none focus:border-[#010101] focus:ring-1 focus:ring-[#010101]"
              />
            </div>
            {error && <p role="alert" className="text-red-600 text-[11px] font-semibold px-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#010101] text-white py-3 font-bold text-xs sm:text-sm hover:bg-[#EDCF5D] hover:text-[#010101] transition-all disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs">
          <Link href="/login" className="font-semibold underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
