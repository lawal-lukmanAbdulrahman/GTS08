"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminTopStrip } from "./sidebar-context";
import { dashboardCsv, loadDashboard, type DashboardData, type DashboardPeriod } from "../lib/dashboard-api";
import { getSessionUser } from "../lib/session";
import {
  PopularSizes,
  ProductProfits,
  PromoPerformance,
  RecentOrders,
  RevenueChart,
  StaffSales,
  StorefrontFunnel,
  SummaryCards,
  UnsoldInventory,
  VisitsChart,
} from "./dashboard-sections";

function greeting(now: Date): string {
  const h = Number(now.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function AdminPage() {
  const router = useRouter();
  // Loading must follow the chosen period only, never a new router object.
  const routerRef = useRef(router);
  routerRef.current = router;
  const [period, setPeriod] = useState<DashboardPeriod>("7d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    setFirstName((getSessionUser()?.full_name ?? "").trim().split(/\s+/)[0] ?? "");
    const main = document.querySelector("main");
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 10);
    main.addEventListener("scroll", onScroll);
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const load = useCallback(
    async (p: DashboardPeriod) => {
      setError(null);
      const r = await loadDashboard(p);
      if (r.ok) setData(r.data);
      else if (r.expired) routerRef.current.push("/login?redirect=/admin");
      else setError(r.message);
    },
    []
  );

  useEffect(() => {
    void load(period);
  }, [load, period]);

  const exportCsv = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([dashboardCsv(data)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gts-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 pt-3.5 pb-6 sm:px-6 lg:px-8 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto transition-colors duration-200">
      <div
        className={`sticky top-0 z-40 -mx-4 -mt-3.5 px-4 pt-3.5 pb-2 sm:-mx-6 lg:-mx-8 lg:-mt-3.5 sm:px-6 lg:px-8 space-y-3 transition-all duration-200 ${
          scrolled ? "bg-[#F8F7F4]/90 dark:bg-[#1C1C1C]/90 backdrop-blur-md border-b border-gray-200 dark:border-[#262626] shadow-2xs" : "bg-transparent border-b border-transparent"
        }`}
      >
        <AdminTopStrip breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Overview" }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-0.5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#010101] dark:text-white">
              {greeting(new Date())}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5 font-mono">Sales, stock and storefront activity, updated when you open the page</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data}
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#2A2A2A] disabled:opacity-50"
            >
              Export
            </button>
            <Link href="/admin/products/new" className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] text-[#010101] hover:bg-white font-bold text-xs transition-all shadow-md">
              + New product
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-[12px] border border-red-200 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => void load(period)} className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-white dark:bg-[#242424] text-gray-900 dark:text-white">
            Try again
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-[12px] bg-gray-200 dark:bg-[#2F2F2F] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          <SummaryCards cards={data.cards} period={period} />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <RevenueChart revenue={data.revenue} period={period} onPeriod={setPeriod} />
            <ProductProfits profits={data.profits} />
          </div>
          <RecentOrders orders={data.recent_orders} />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <StorefrontFunnel funnel={data.funnel} />
            <VisitsChart visits={data.visits} period={period} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <UnsoldInventory unsold={data.unsold} />
            <PopularSizes sizes={data.sizes} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <StaffSales staff={data.staff} />
            <PromoPerformance promos={data.promos} />
          </div>
        </>
      )}
    </div>
  );
}
