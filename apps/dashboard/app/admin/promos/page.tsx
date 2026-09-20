"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { apiCall } from "../../lib/staff-api";
import { buildPromoBody, describeDiscount, describeUse, promoStatus, type PromoFormValues, type PromoView } from "./promo-form";

const FIELD = "w-full px-3 py-2 text-sm rounded-[6px] border border-gray-200 dark:border-[#383838] bg-transparent";
const LABEL = "block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1";
const EMPTY: PromoFormValues = { code: "", type: "percentage", value: "", minOrder: "", maxUses: "", expires: "" };
const STATUS_STYLE: Record<string, string> = {
  Live: "bg-emerald-100 text-emerald-800",
  Off: "bg-gray-100 text-gray-700",
  Expired: "bg-red-100 text-red-800",
  "Not started": "bg-amber-100 text-amber-800",
  "Used up": "bg-amber-100 text-amber-800",
};

/** Promo codes: create them, switch them on and off, and delete ones that were never used. */
export default function PromosPage() {
  const [promos, setPromos] = useState<PromoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<PromoFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const r = await apiCall<PromoView[]>("/promos");
    if (r.ok) setPromos(r.data ?? []);
    else setLoadError(r.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (patch: Partial<PromoFormValues>) => setForm((f) => ({ ...f, ...patch }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const built = buildPromoBody(form);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    const r = await apiCall("/promos", { method: "POST", json: built.body });
    setBusy(false);
    if (r.ok) {
      setForm(EMPTY);
      await load();
    } else {
      // The server names its own fields (code, discount_value...); show them against the form's.
      const map: Record<string, string> = { code: "code", discount_value: "value", min_order_amount: "minOrder", max_uses: "maxUses", expires_at: "expires" };
      setErrors(Object.fromEntries(Object.entries(r.details ?? {}).map(([k, v]) => [map[k] ?? k, v])));
      setFailure(r.message);
    }
  }

  async function toggle(p: PromoView) {
    const r = await apiCall(`/promos/${p.id}/activate`, { method: "PUT", json: { is_active: !p.is_active } });
    if (r.ok) await load();
    else setFailure(r.message);
  }

  async function remove(p: PromoView) {
    if (!window.confirm(`Delete ${p.code}? This can't be undone.`)) return;
    const r = await apiCall(`/promos/${p.id}`, { method: "DELETE" });
    if (r.ok) await load();
    else setFailure(r.message);
  }

  return (
    <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-6 max-w-[1600px] mx-auto font-sans">
      <AdminTopStrip breadcrumbs={[{ label: "Promo codes" }]} />

      <div className="border-b border-gray-200 dark:border-[#262626] pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Promo codes</h1>
        <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">
          Discounts customers can enter at checkout. The server works out the saving from its own prices, and a code counts as used when its order is paid.
        </p>
      </div>

      <form onSubmit={create} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 items-start rounded-[12px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] p-4">
        <div className="lg:col-span-1">
          <label htmlFor="promo-code" className={LABEL}>Code</label>
          <input id="promo-code" value={form.code} onChange={(e) => set({ code: e.target.value })} className={FIELD} autoComplete="off" />
          {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
        </div>
        <div>
          <label htmlFor="promo-type" className={LABEL}>Type</label>
          <select id="promo-type" value={form.type} onChange={(e) => set({ type: e.target.value as PromoFormValues["type"] })} className={FIELD}>
            <option value="percentage">Percentage off</option>
            <option value="fixed_amount">Fixed amount off</option>
          </select>
        </div>
        <div>
          <label htmlFor="promo-value" className={LABEL}>{form.type === "percentage" ? "Percent (1 to 100)" : "Amount (₦)"}</label>
          <input id="promo-value" value={form.value} onChange={(e) => set({ value: e.target.value })} className={FIELD} inputMode="decimal" />
          {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value}</p>}
        </div>
        <div>
          <label htmlFor="promo-min" className={LABEL}>Minimum order (₦, optional)</label>
          <input id="promo-min" value={form.minOrder} onChange={(e) => set({ minOrder: e.target.value })} className={FIELD} inputMode="decimal" />
          {errors.minOrder && <p className="text-xs text-red-600 mt-1">{errors.minOrder}</p>}
        </div>
        <div>
          <label htmlFor="promo-uses" className={LABEL}>Total uses (optional)</label>
          <input id="promo-uses" value={form.maxUses} onChange={(e) => set({ maxUses: e.target.value })} className={FIELD} inputMode="numeric" />
          {errors.maxUses && <p className="text-xs text-red-600 mt-1">{errors.maxUses}</p>}
        </div>
        <div>
          <label htmlFor="promo-expires" className={LABEL}>Last day (optional)</label>
          <input id="promo-expires" type="date" value={form.expires} onChange={(e) => set({ expires: e.target.value })} className={FIELD} />
          {errors.expires && <p className="text-xs text-red-600 mt-1">{errors.expires}</p>}
        </div>
        <div className="sm:col-span-2 lg:col-span-6 flex items-center gap-3">
          <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-bold rounded-[8px] bg-[#EDCF5D] text-[#010101] disabled:opacity-50">
            {busy ? "Creating..." : "Create code"}
          </button>
          {failure && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{failure}</p>}
        </div>
      </form>

      {loadError && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          <button type="button" onClick={() => load()} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-gray-100 dark:bg-[#242424]">Try again</button>
        </div>
      )}

      {loading && promos.length === 0 && !loadError && <p className="text-sm text-gray-500">Loading...</p>}

      {promos.length > 0 && (
        <div className="overflow-x-auto rounded-[12px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-[#262626]">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="px-4 py-3 font-semibold">Used</th>
                <th className="px-4 py-3 font-semibold">Ends</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => {
                const status = promoStatus(p);
                return (
                  <tr key={p.id} className="border-b last:border-0 border-gray-100 dark:border-[#262626]">
                    <td className="px-4 py-3 font-mono font-bold">{p.code}</td>
                    <td className="px-4 py-3">{describeDiscount(p)}</td>
                    <td className="px-4 py-3">{describeUse(p)}</td>
                    <td className="px-4 py-3">{p.expires_at ? new Date(p.expires_at).toLocaleDateString("en-NG") : "No end"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status]}`}>{status}</span></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                      <button type="button" onClick={() => toggle(p)} className="text-xs font-semibold underline">{p.is_active ? "Switch off" : "Switch on"}</button>
                      {p.used_count === 0 && (
                        <button type="button" onClick={() => remove(p)} className="text-xs font-semibold underline text-red-600">Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && promos.length === 0 && <p className="text-sm text-gray-500">No promo codes yet. Create the first one above.</p>}
    </div>
  );
}
