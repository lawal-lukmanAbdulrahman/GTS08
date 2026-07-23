"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Toggle navigation menu"
        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-line/50 dark:hover:bg-[#2A312A]/50 transition-colors"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 top-[68px] z-50 bg-page dark:bg-[#111614]"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex flex-col p-7 gap-2 bg-page dark:bg-[#111614] min-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-[18px] font-semibold text-txt dark:text-[#E8EDE9] py-3 border-b border-line dark:border-[#2A312A] transition-colors hover:text-green focus-visible:text-green"
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 mt-6">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center font-semibold text-[15px] px-5 py-3.5 rounded-full border border-line dark:border-[#3A423A] bg-white dark:bg-[#1E2520] text-txt dark:text-[#E8EDE9] transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center font-semibold text-[15px] px-5 py-3.5 rounded-full bg-ink dark:bg-green text-white transition-colors"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
