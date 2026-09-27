"use client";

import { useEffect, useState } from "react";
import { loadDataMode } from "../lib/data-mode-api";
import { getToken } from "../lib/session";

/**
 * A small permanent tag on every screen of the demo account, so nobody
 * mistakes the demo data for the live shop. Fixed in a corner so it never
 * shifts the layout of the till or the admin pages.
 */
export default function DataModeBanner() {
  const [test, setTest] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    loadDataMode().then((r) => {
      if (!cancelled && r.ok && r.mode === "test") setTest(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!test) return null;
  return (
    <div role="status" className="fixed bottom-3 left-3 z-[60] rounded-full bg-amber-400 text-[#010101] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide shadow-lg pointer-events-none">
      Demo account · demo data
    </div>
  );
}
