"use client";

import { useEffect, useState } from "react";
import { loadDataMode, type DataMode } from "../../lib/data-mode-api";

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; mode: DataMode };

/** Which data this account sees. It follows the account: the demo login sees the demo data, everyone else the live shop. */
export default function DataModeCard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadDataMode().then((r) => {
      if (!cancelled) setState(r.ok ? { kind: "ready", mode: r.mode } : { kind: "error", message: r.message });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-[16px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] p-4 sm:p-5 space-y-2">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white">Live and demo data</h2>
      {state.kind === "loading" && <p className="text-sm text-gray-500">Loading...</p>}
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
      {state.kind === "ready" && state.mode === "live" && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          You&apos;re looking at the <strong>live shop</strong>. Everything recorded while the app was being built (products, orders,
          customers, broadcasts, logs) is kept as demo data and only the demo account can see it. Nothing was deleted.
        </p>
      )}
      {state.kind === "ready" && state.mode === "test" && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong>This is the demo account.</strong> It shows and changes demo data only: nothing done here reaches the live shop,
          no emails are sent, and store details and staff accounts are read-only.
        </p>
      )}
    </section>
  );
}
