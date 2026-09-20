"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  name: string;
  role: string;
  isAdmin: boolean;
  canUsePos: boolean;
  /** The page this menu is on, so it doesn't link to itself. */
  current?: "pos" | "profile" | "admin";
  onSignOut: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : "")).toUpperCase();
}

const ITEM = "block w-full text-left px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#242424]";

/** The signed-in staff member's menu: profile, where else they can go, and sign out. */
export default function StaffMenu({ name, role, isAdmin, canUsePos, current, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayName = name.trim() || "Staff member";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#242424]"
      >
        <span className="w-7 h-7 rounded-full bg-[#EDCF5D] text-[#010101] text-xs font-bold flex items-center justify-center" aria-hidden>
          {initials(name)}
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{displayName}</span>
        <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#242424] text-gray-500 dark:text-gray-400">
          {role}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-52 z-50 rounded-[8px] border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] shadow-lg py-1"
        >
          <a role="menuitem" href="/profile" className={ITEM}>
            My profile
          </a>
          {canUsePos && current !== "pos" && (
            <a role="menuitem" href="/pos" className={ITEM}>
              Point of sale
            </a>
          )}
          {isAdmin && current !== "admin" && (
            <a role="menuitem" href="/admin" className={ITEM}>
              Admin dashboard
            </a>
          )}
          <div className="my-1 border-t border-gray-100 dark:border-[#262626]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className={`${ITEM} text-red-600 dark:text-red-400`}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
