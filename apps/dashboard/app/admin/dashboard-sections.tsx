"use client";

import Link from "next/link";
import { useState } from "react";
import { formatKobo } from "@gts/utils";
import type { DashboardData, DashboardPeriod } from "../lib/dashboard-api";
import { BankWatermark, CartWatermark, CashWatermark, ReceiptsWatermark } from "./dashboard-watermarks";

const CARD = "p-3.5 sm:p-4 rounded-[16px] bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] shadow-sm dark:shadow-xl transition-colors";
const KPI =
  "group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28";
const EMPTY_TEXT = "py-6 text-center text-xs text-gray-500 dark:text-[#6B7280] font-mono";

/** "+12.5%" / "-3.2%" / "no earlier data", coloured by direction. */
function Change({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return <span className="text-gray-500 dark:text-[#8E8E8E]">No earlier data to compare</span>;
  const up = pct >= 0;
  return (
    <span className={up ? "text-emerald-600 dark:text-emerald-400" : "text-[#E55353]"}>
      {up ? "+" : ""}
      {pct}% <span className="text-gray-500 dark:text-[#8E8E8E]">{label}</span>
    </span>
  );
}

function Kpi({ testId, title, value, sub, children }: { testId: string; title: string; value: string; sub: React.ReactNode; children: React.ReactNode }) {
  return (
    <div data-testid={testId} className={KPI}>
      <div className="relative z-10 space-y-1">
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">{title}</span>
        <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">{value}</p>
      </div>
      <div className="relative z-10 font-mono text-xs font-medium">{sub}</div>
      {children}
    </div>
  );
}

export function SummaryCards({ cards, period }: { cards: DashboardData["cards"]; period: DashboardPeriod }) {
  const vs = period === "7d" ? "vs previous week" : "vs previous 30 days";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi testId="card-bank-payouts" title="Bank payouts" value={formatKobo(cards.bank_payouts.total)} sub={<Change pct={cards.bank_payouts.change_pct} label={vs} />}>
        <BankWatermark />
      </Kpi>
      <Kpi testId="card-cash" title="Cash in register" value={formatKobo(cards.cash_in_register.today)} sub={<span className="text-gray-500 dark:text-[#8E8E8E]">Cash sales today</span>}>
        <CashWatermark />
      </Kpi>
      <Kpi
        testId="card-repeat"
        title="Repeat buyers"
        value={`${cards.repeat_buyers.pct}%`}
        sub={<span className="text-gray-500 dark:text-[#8E8E8E]">{cards.repeat_buyers.repeat} of {cards.repeat_buyers.buyers} buyers came back</span>}
      >
        <CartWatermark />
      </Kpi>
      <Kpi
        testId="card-completed-sales"
        title="Completed sales"
        value={`${cards.completed_sales.pct}%`}
        sub={<span className="text-gray-500 dark:text-[#8E8E8E]">{cards.completed_sales.paid} paid out of {cards.completed_sales.total}</span>}
      >
        <ReceiptsWatermark />
      </Kpi>
    </div>
  );
}

export function RevenueChart({ revenue, period, onPeriod }: { revenue: DashboardData["revenue"]; period: DashboardPeriod; onPeriod: (p: DashboardPeriod) => void }) {
  const max = Math.max(0, ...revenue.series.map((p) => p.revenue));
  const [active, setActive] = useState<number>(revenue.series.length - 1);
  const shown = revenue.series[Math.min(active, revenue.series.length - 1)];
  return (
    <div className={`lg:col-span-7 ${CARD} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E8E] font-sans block">Revenue</span>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-sans">{formatKobo(revenue.total)}</p>
          <div className="text-[11px] font-mono">
            <Change pct={revenue.change_pct} label={period === "7d" ? "vs previous week" : "vs previous 30 days"} />
          </div>
        </div>
        <label className="text-xs">
          <span className="sr-only">Revenue period</span>
          <select
            value={period}
            onChange={(e) => onPeriod(e.target.value as DashboardPeriod)}
            className="bg-gray-100 dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2E2E2E] text-xs font-medium text-gray-700 dark:text-white rounded-[8px] px-3 py-1.5"
          >
            <option value="7d">Weekly</option>
            <option value="30d">Monthly</option>
          </select>
        </label>
      </div>

      {max === 0 ? (
        <p className={EMPTY_TEXT}>No sales in this period yet.</p>
      ) : (
        <div>
          <p className="text-[11px] font-mono text-gray-500 dark:text-[#8E8E8E] h-4">
            {shown ? `${shown.label}: ${formatKobo(shown.revenue)}` : ""}
          </p>
          <div className="h-44 flex items-end gap-1 sm:gap-2 pt-2">
            {revenue.series.map((p, i) => (
              <button
                type="button"
                key={p.date}
                aria-label={`${p.label}: ${formatKobo(p.revenue)}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className="flex-1 h-full flex items-end cursor-pointer"
              >
                <span
                  className={`block w-full rounded-t-[8px] transition-all ${
                    i === active
                      ? "bg-gradient-to-b from-[#FFF1A8] via-[#EDCF5D] to-[#B89628]"
                      : "bg-gradient-to-b from-gray-300 via-gray-200 to-transparent dark:from-[#444444] dark:via-[#242424] dark:to-transparent"
                  }`}
                  style={{ height: `${Math.max(2, Math.round((p.revenue / max) * 100))}%` }}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-1 sm:gap-2 mt-2">
            {revenue.series.map((p, i) => (
              <span key={p.date} className={`flex-1 text-center text-[10px] font-mono truncate ${i === active ? "font-bold text-gray-900 dark:text-white" : "text-gray-400"}`}>
                {revenue.series.length > 10 && i % 5 !== 4 && i !== revenue.series.length - 1 ? "" : p.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductProfits({ profits }: { profits: DashboardData["profits"] }) {
  const [tab, setTab] = useState<"margin" | "sellers">("margin");
  const tabClass = (on: boolean) => `px-3 py-1.5 text-[11px] font-bold rounded-[6px] ${on ? "bg-[#EDCF5D] text-[#010101]" : "text-gray-500 dark:text-gray-400"}`;
  return (
    <div className={`lg:col-span-5 ${CARD} space-y-3`}>
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 dark:border-[#262626] pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Product profits</h3>
          <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Margin from each product&apos;s cost, or revenue this period</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-[#222222] rounded-[8px] p-0.5">
          <button type="button" className={tabClass(tab === "margin")} onClick={() => setTab("margin")}>
            Best margin
          </button>
          <button type="button" className={tabClass(tab === "sellers")} onClick={() => setTab("sellers")}>
            Best sellers
          </button>
        </div>
      </div>
      {tab === "margin" &&
        (profits.best_margin.length === 0 ? (
          <p className={EMPTY_TEXT}>Add cost prices to products to see their margins.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-[#262626]">
            {profits.best_margin.map((p) => (
              <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">
                    {p.category ? `${p.category} · ` : ""}Cost {formatKobo(p.cost)} / Price {formatKobo(p.price)}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{p.margin_pct}% margin</span>
              </li>
            ))}
          </ul>
        ))}
      {tab === "sellers" &&
        (profits.best_sellers.length === 0 ? (
          <p className={EMPTY_TEXT}>No products sold in this period yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-[#262626]">
            {profits.best_sellers.map((p) => (
              <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">{p.units} sold</p>
                </div>
                <span className="shrink-0 text-xs font-mono font-bold text-gray-900 dark:text-white">{formatKobo(p.revenue)}</span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

export function RecentOrders({ orders }: { orders: DashboardData["recent_orders"] }) {
  return (
    <div className={`${CARD} space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent orders</h3>
        <Link href="/admin/orders" className="text-xs font-semibold text-[#010101] dark:text-[#EDCF5D] hover:underline">
          View all orders →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-[#262626] text-gray-500 dark:text-[#6B7280] font-semibold uppercase text-[10px]">
              <th className="pb-3">Order number</th>
              <th className="pb-3">Channel</th>
              <th className="pb-3">Customer</th>
              <th className="pb-3">Status</th>
              <th className="pb-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className={EMPTY_TEXT}>
                  No recent orders
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-[#242424] transition-colors">
                  <td className="py-3 font-mono font-bold text-gray-900 dark:text-white">{o.order_number}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-gray-200">{o.channel.replace("_", " ")}</span>
                  </td>
                  <td className="py-3 text-gray-600 dark:text-[#9CA3AF]">{o.customer?.full_name || o.customer?.email || "Walk-in / guest"}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-gray-100 dark:bg-[#262626] text-gray-800 dark:text-white">{o.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-gray-900 dark:text-white">{formatKobo(o.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StorefrontFunnel({ funnel }: { funnel: DashboardData["funnel"] }) {
  const steps = [
    { label: "Shoppers who visited", value: funnel.visits },
    { label: "Added to cart", value: funnel.cart_adds },
    { label: "Started checkout", value: funnel.checkouts },
    { label: "Paid", value: funnel.paid },
    { label: "Didn't pay", value: funnel.abandoned },
  ];
  const top = Math.max(1, funnel.visits, funnel.checkouts);
  return (
    <div data-testid="funnel" className={`lg:col-span-5 ${CARD} space-y-3`}>
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white font-mono">Storefront funnel</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-white font-mono">
          {funnel.conversion_pct}% <span className="text-xs font-normal text-gray-500">of visitors paid</span>
        </p>
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3">
            <div className="flex-1">
              <div
                className="rounded-full bg-[#FFF6D6] dark:bg-[#EDCF5D]/15 px-3 py-1 text-[11px] font-mono text-gray-800 dark:text-gray-200 truncate"
                style={{ width: `${Math.max(28, Math.round((s.value / top) * 100))}%` }}
              >
                {s.label}
              </div>
            </div>
            <span className="w-12 text-right text-xs font-mono font-bold text-gray-900 dark:text-white">{s.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VisitsChart({ visits, period }: { visits: DashboardData["visits"]; period: DashboardPeriod }) {
  const max = Math.max(0, ...visits.series.map((p) => p.visits));
  const [active, setActive] = useState<number | null>(null);
  const n = visits.series.length;
  const points = visits.series.map((p, i) => `${n > 1 ? (i / (n - 1)) * 100 : 50},${100 - (max ? (p.visits / max) * 85 : 0)}`).join(" ");
  const shown = active !== null ? visits.series[active] : undefined;
  return (
    <div className={`lg:col-span-7 ${CARD} space-y-3`}>
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white font-mono">Storefront visits</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-white font-mono">
          {visits.total.toLocaleString()}{" "}
          <span className="text-xs font-normal">
            <Change pct={visits.change_pct} label={period === "7d" ? "vs previous week" : "vs previous 30 days"} />
          </span>
        </p>
      </div>
      {max === 0 ? (
        <p className={EMPTY_TEXT}>No storefront visits in this period yet.</p>
      ) : (
        <div>
          <p className="text-[11px] font-mono text-gray-500 h-4">{shown ? `${shown.label}: ${shown.visits.toLocaleString()} shoppers` : ""}</p>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-40" onMouseLeave={() => setActive(null)} role="img" aria-label="Shoppers per day">
            <polyline points={`0,100 ${points} 100,100`} fill="#EDCF5D" fillOpacity="0.15" stroke="none" />
            <polyline points={points} fill="none" stroke="#EDCF5D" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            {visits.series.map((p, i) => (
              <rect key={p.date} x={n > 1 ? (i / (n - 1)) * 100 - 50 / n : 0} y="0" width={100 / Math.max(1, n)} height="100" fill="transparent" onMouseEnter={() => setActive(i)} />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

export function UnsoldInventory({ unsold }: { unsold: DashboardData["unsold"] }) {
  return (
    <div className={`${CARD} space-y-3`}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#262626] pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Unsold inventory</h3>
          <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">In stock but no sales this period</p>
        </div>
        <Link href="/admin/inventory" className="text-xs font-semibold text-[#010101] dark:text-[#EDCF5D] hover:underline">
          Inventory →
        </Link>
      </div>
      {unsold.length === 0 ? (
        <p className={EMPTY_TEXT}>Nothing sitting idle.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-[#262626]">
          {unsold.map((u) => (
            <li key={u.product_id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
                <p className="text-[10px] text-gray-500">{u.units} in stock</p>
              </div>
              <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{formatKobo(u.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PopularSizes({ sizes }: { sizes: DashboardData["sizes"] }) {
  return (
    <div className={`${CARD} space-y-3`}>
      <div className="border-b border-gray-200 dark:border-[#262626] pb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Popular sizes</h3>
        <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Share of units sold this period</p>
      </div>
      {sizes.length === 0 ? (
        <p className={EMPTY_TEXT}>No units sold in this period yet.</p>
      ) : (
        <div className="space-y-3">
          {sizes.map((s) => (
            <div key={s.size} className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="font-bold text-gray-900 dark:text-white">{s.size}</span>
                <span className="text-gray-500">
                  {s.share_pct}% · {s.units} units
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden">
                <div className="h-full bg-[#EDCF5D] rounded-full" style={{ width: `${s.share_pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StaffSales({ staff }: { staff: DashboardData["staff"] }) {
  return (
    <div className={`lg:col-span-7 ${CARD} space-y-3`}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#262626] pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Staff sales &amp; discounts</h3>
          <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Paid sales rung up by each cashier this period</p>
        </div>
        <Link href="/admin/staff" className="text-xs font-semibold text-[#010101] dark:text-[#EDCF5D] hover:underline">
          Staff →
        </Link>
      </div>
      {staff.length === 0 ? (
        <p className={EMPTY_TEXT}>No till sales in this period yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-[#262626]">
          {staff.map((s) => (
            <li key={s.cashier_id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 shrink-0 rounded-full bg-[#010101] text-white flex items-center justify-center font-bold text-xs">{s.name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{s.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {s.orders} sale{s.orders === 1 ? "" : "s"} · {formatKobo(s.discounts)} in discounts
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{formatKobo(s.sales)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PromoPerformance({ promos }: { promos: DashboardData["promos"] }) {
  return (
    <div className={`lg:col-span-5 ${CARD} space-y-3`}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#262626] pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Promo codes</h3>
          <p className="text-[10px] text-gray-500 dark:text-[#8E9299]">Sales each code brought in, and what it gave away</p>
        </div>
        <Link href="/admin/promos" className="text-xs font-semibold text-[#010101] dark:text-[#EDCF5D] hover:underline">
          Promos →
        </Link>
      </div>
      {promos.length === 0 ? (
        <p className={EMPTY_TEXT}>No promo codes used in this period yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-[#262626]">
          {promos.map((p) => (
            <li key={p.code} className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono font-bold text-gray-900 dark:text-white">{p.code}</p>
                <p className="text-[10px] text-gray-500">
                  {p.uses} use{p.uses === 1 ? "" : "s"} · {formatKobo(p.discount)} off
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{formatKobo(p.revenue)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
