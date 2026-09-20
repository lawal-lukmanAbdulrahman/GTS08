"use client";

import Link from "next/link";

interface Props {
  name: string;
  isAdmin: boolean;
  onSignOut: () => void;
}

/** What someone sees when they reach the till without being allowed to use it. */
export default function NoPosAccess({ name, isAdmin, onSignOut }: Props) {
  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-[#F8F7F4] dark:bg-[#1C1C1C]">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">You don&apos;t have access to the point of sale</h1>
        <p className="text-base text-gray-600 dark:text-gray-300">
          {name ? `${name}, your` : "Your"} account isn&apos;t set up to take sales yet. Ask an admin to turn on point-of-sale access for you.
        </p>
        <div className="flex flex-col items-center gap-2">
          {isAdmin && (
            <Link href="/admin/staff" className="px-4 py-2.5 text-base font-semibold rounded-[8px] bg-[#EDCF5D] text-[#010101]">
              Manage staff access
            </Link>
          )}
          <button type="button" onClick={onSignOut} className="px-4 py-2.5 text-base font-semibold rounded-[8px] border border-gray-200 dark:border-[#383838]">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
