"use client";

import { useCallback, useEffect, useState } from "react";
import type { FlagStatus } from "@gts/utils";
import { AdminTopStrip } from "../sidebar-context";
import { apiCall } from "../../lib/staff-api";
import FlagQueue, { type QueueFlag } from "./flag-queue";

type Counts = Record<FlagStatus, number>;
const NO_COUNTS: Counts = { open: 0, in_review: 0, resolved: 0, dismissed: 0 };

export default function AdminFlagsPage() {
  const [status, setStatus] = useState<FlagStatus>("open");
  const [flags, setFlags] = useState<QueueFlag[]>([]);
  const [counts, setCounts] = useState<Counts>(NO_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: FlagStatus) => {
    setLoading(true);
    setError(null);
    const result = await apiCall<{ flags: QueueFlag[]; counts: Counts }>(`/flags?status=${which}`);
    if (result.ok) {
      setFlags(result.data.flags);
      setCounts(result.data.counts);
    } else {
      setFlags([]);
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(status);
  }, [status, load]);

  async function update(id: string, body: { status: FlagStatus; resolution_note: string | null }) {
    const result = await apiCall(`/flags/${id}`, { method: "PATCH", json: body });
    if (!result.ok) return { ok: false as const, message: result.message };
    await load(status);
    return { ok: true as const };
  }

  return (
    <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-6 max-w-[1600px] mx-auto font-sans">
      <AdminTopStrip breadcrumbs={[{ label: "Product flags" }]} />

      <div className="border-b border-gray-200 dark:border-[#262626] pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Product flags</h1>
        <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">
          Problems cashiers have reported on products: wrong prices, stock that doesn&apos;t match, damaged items.
        </p>
      </div>

      <FlagQueue flags={flags} counts={counts} status={status} onStatusChange={setStatus} onUpdate={update} loading={loading} error={error} />
    </div>
  );
}
