"use client";

import { formatKobo, formatWAT } from "@gts/utils";
import { describeActivity } from "../lib/activity-labels";
import type { ActivityEntryView, SalesRecordView } from "../lib/staff-types";
import type { ProfileSection } from "./profile-sidebar";

interface Props {
  name: string;
  sales: SalesRecordView | null;
  salesError: string | null;
  openFlags: number;
  recentActivity: ActivityEntryView[];
  onOpen: (section: ProfileSection) => void;
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-[14px] border p-4 ${accent ? "border-[#EDCF5D] bg-[#FBF5DA] dark:bg-[#2a2614]" : "border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C]"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-sm text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  );
}

/** The landing view: a greeting, today's numbers, and the latest things you did. */
export default function ProfileOverview({ name, sales, salesError, openFlags, recentActivity, onOpen }: Props) {
  const first = name.trim().split(/\s+/)[0] || "there";
  const s = sales?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hello, {first}</h2>
        <p className="text-base text-gray-500 dark:text-gray-400">Here&apos;s how today is going.</p>
      </div>

      {salesError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {salesError}
        </p>
      )}

      {s && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Tile accent label="Total sales" value={formatKobo(s.sales.total)} sub={`${s.sales.count} sale${s.sales.count === 1 ? "" : "s"}`} />
          <Tile label="Average sale" value={formatKobo(s.sales.average)} />
          <Tile label="Discounts given" value={formatKobo(s.discounts_given.total)} sub={`${s.discounts_given.count} sale${s.discounts_given.count === 1 ? "" : "s"}`} />
          <Tile label="Voided" value={formatKobo(s.voided.total)} sub={`${s.voided.count} sale${s.voided.count === 1 ? "" : "s"}`} />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onOpen("sales")} className="px-4 py-2.5 rounded-[10px] bg-gray-100 dark:bg-[#242424] text-sm font-semibold">
          See all sales
        </button>
        {openFlags > 0 && (
          <button type="button" onClick={() => onOpen("flags")} className="px-4 py-2.5 rounded-[10px] bg-[#EDCF5D] text-[#010101] text-sm font-semibold">
            {openFlags} open flag{openFlags === 1 ? "" : "s"} waiting on an admin
          </button>
        )}
      </div>

      <section className="rounded-[14px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#262626]">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Latest activity</h3>
          <button type="button" onClick={() => onOpen("activity")} className="text-sm font-semibold underline">
            See all activity
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="px-5 py-6 text-base text-gray-500">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-[#262626]">
            {recentActivity.slice(0, 5).map((entry) => {
              const d = describeActivity(entry);
              return (
                <li key={entry.id} className="px-5 py-3">
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{d.title}</p>
                  {d.detail && <p className="text-sm text-gray-500 dark:text-gray-400">{d.detail}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{formatWAT(entry.created_at)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
