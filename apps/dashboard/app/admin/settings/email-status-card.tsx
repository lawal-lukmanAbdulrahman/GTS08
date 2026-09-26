"use client";

import { useEffect, useState } from "react";
import { loadEmailStatus, sendTestEmail } from "../../lib/email-status-api";

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; configured: boolean; from: string | null; missing: string[] };

/** Is email (Resend) set up, and does a message actually arrive? */
export default function EmailStatusCard() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEmailStatus().then((r) => {
      if (cancelled) return;
      setStatus(r.ok ? { kind: "ready", configured: r.configured, from: r.from, missing: r.missing } : { kind: "error", message: r.message });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function test() {
    setBusy(true);
    setResult(null);
    const r = await sendTestEmail();
    setBusy(false);
    setResult(r.ok ? { ok: true, text: `Sent to ${r.to}. Check that inbox (and spam).` } : { ok: false, text: r.message });
  }

  return (
    <section className="rounded-[16px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Email</h2>
        <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5">Receipts, order updates, ticket replies, password resets and campaigns are sent through Resend.</p>
      </div>

      {status.kind === "loading" && <p className="text-sm text-gray-500">Checking...</p>}
      {status.kind === "error" && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{status.message}</p>}
      {status.kind === "ready" && !status.configured && (
        <p className="text-sm text-amber-700 dark:text-amber-400">Email isn't set up yet. Add {status.missing.join(" and ")} to the server's environment.</p>
      )}
      {status.kind === "ready" && status.configured && (
        <>
          <p className="text-sm text-gray-900 dark:text-white">Sending as <strong>{status.from}</strong>.</p>
          <button type="button" disabled={busy} onClick={test} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424] text-gray-900 dark:text-white disabled:opacity-50">
            {busy ? "Sending..." : "Send a test email to me"}
          </button>
          {result && (
            <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{result.text}</p>
          )}
        </>
      )}
    </section>
  );
}
