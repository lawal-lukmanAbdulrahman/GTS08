"use client";

import { formatKobo } from "@gts/utils";

export type ProfileSection = "overview" | "access" | "sales" | "activity" | "flags" | "security";

export const PROFILE_SECTIONS: Array<{ id: ProfileSection; label: string; icon: string; posOnly?: boolean }> = [
  { id: "overview", label: "Overview", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { id: "access", label: "My access", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4" },
  { id: "sales", label: "My sales", icon: "M3 17l5-5 4 4 8-8M15 8h5v5" },
  { id: "activity", label: "Activity", icon: "M12 8v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "flags", label: "Product flags", icon: "M5 21V4m0 0h11l-2 4 2 4H5", posOnly: true },
  { id: "security", label: "Security", icon: "M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z" },
];

interface Props {
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  section: ProfileSection;
  onSelect: (section: ProfileSection) => void;
  onSignOut: () => void;
  todayTotal: number | null;
  todayCount: number | null;
  openFlags: number;
  /** Whether to offer the flags section (POS staff only). */
  showFlags: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : "")).toUpperCase();
}

/** Who you are, what you've taken today, and where to go: the profile's left rail (a top strip on phones). */
export default function ProfileSidebar({ name, email, phone, role, section, onSelect, onSignOut, todayTotal, todayCount, openFlags, showFlags }: Props) {
  const items = PROFILE_SECTIONS.filter((s) => !s.posOnly || showFlags);

  return (
    <aside className="lg:w-80 lg:shrink-0 lg:sticky lg:top-[89px] lg:self-start space-y-4">
      <div className="rounded-[16px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-[#EDCF5D] to-[#f6e7a6]" aria-hidden="true" />
        <div className="px-5 pb-5 -mt-8">
          <div className="w-16 h-16 rounded-full bg-[#010101] text-[#EDCF5D] border-4 border-white dark:border-[#1C1C1C] flex items-center justify-center text-xl font-bold">
            {initials(name)}
          </div>
          <p className="mt-3 text-lg font-bold text-gray-900 dark:text-white">{name || "Staff member"}</p>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#242424] text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {role.replace("_", " ")}
          </span>
          <dl className="mt-4 space-y-1.5 text-sm">
            <dd className="text-gray-700 dark:text-gray-200 break-all">{email ?? "No email"}</dd>
            <dd className="text-gray-500 dark:text-gray-400">{phone || "No phone number yet"}</dd>
          </dl>
        </div>

        {todayTotal !== null && todayCount !== null && (
          <div className="border-t border-gray-100 dark:border-[#262626] px-5 py-4 bg-gray-50/70 dark:bg-[#151515]">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Taken today</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{formatKobo(todayTotal)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {todayCount} sale{todayCount === 1 ? "" : "s"} today
            </p>
          </div>
        )}
      </div>

      <nav aria-label="Profile sections" className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible rounded-[16px] lg:border lg:border-gray-200 lg:dark:border-[#262626] lg:bg-white lg:dark:bg-[#1C1C1C] lg:p-2">
        {items.map((s) => {
          const current = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={current ? "page" : undefined}
              className={`flex items-center gap-3 shrink-0 px-4 py-3 rounded-[10px] text-sm font-semibold transition-colors ${
                current
                  ? "bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#010101]"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#242424]"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                <path d={s.icon} />
              </svg>
              <span className="flex-1 text-left whitespace-nowrap">{s.label}</span>
              {s.id === "flags" && openFlags > 0 && (
                <span className="ml-2 min-w-[22px] px-1.5 py-0.5 rounded-full bg-[#EDCF5D] text-[#010101] text-xs font-bold text-center">{openFlags}</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-3 shrink-0 px-4 py-3 rounded-[10px] text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 lg:mt-1 lg:border-t lg:border-gray-100 lg:dark:border-[#262626] lg:rounded-t-none"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 12H4m0 0l3-3m-3 3l3 3M10 5V4a1 1 0 011-1h8a1 1 0 011 1v16a1 1 0 01-1 1h-8a1 1 0 01-1-1v-1" />
          </svg>
          Sign out
        </button>
      </nav>
    </aside>
  );
}
