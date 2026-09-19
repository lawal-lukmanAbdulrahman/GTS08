"use client";

import { useEffect, useState } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { loadStoreDetails, saveStoreDetails } from "../../lib/store-settings-api";
import StoreSettingsForm, { type StoreDetails } from "./store-settings-form";

export default function AdminSettingsPage() {
  const [details, setDetails] = useState<StoreDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const result = await loadStoreDetails();
    if (result.ok) setDetails(result.data);
    else setLoadError(result.message);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="px-4 pt-3.5 pb-6 lg:px-5 lg:pt-3.5 space-y-6 max-w-[1600px] mx-auto font-sans">
      <AdminTopStrip breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Store details" }]} />

      <div className="border-b border-gray-200 dark:border-[#262626] pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Store details</h1>
        <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">
          Shown on printed receipts and the storefront. Changes apply to the next receipt printed.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading store details...</p>}

      {loadError && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          <button type="button" onClick={load} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]">
            Try again
          </button>
        </div>
      )}

      {details && <StoreSettingsForm initial={details} onSave={saveStoreDetails} />}
    </div>
  );
}
