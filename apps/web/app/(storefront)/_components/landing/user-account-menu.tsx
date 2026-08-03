"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function UserAccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative inline-block">
      {/* Invisible Clickable Trigger Pill */}
      <button
        onClick={toggleMenu}
        aria-expanded={isOpen}
        className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full hover:bg-gray-100/80 transition-all cursor-pointer group text-[#010101] select-none"
      >
        {/* Circle with User Icon */}
        <div className="w-8 h-8 rounded-full bg-[#F2F0EA] flex items-center justify-center text-[#010101] shrink-0 border border-gray-200/60 shadow-2xs group-hover:bg-[#EDCF5D] transition-colors">
          <svg
            className="w-4 h-4 text-[#010101]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </div>

        {/* Text & Chevron */}
        <span className="text-xs sm:text-sm font-semibold text-[#010101] tracking-tight whitespace-nowrap">
          Welcome shopper
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#010101]" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200/90 p-2 z-50 text-[#010101]"
          >
            <div className="space-y-0.5">
              {/* Greyed out items */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-400 opacity-60 cursor-not-allowed select-none">
                <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span>My Account</span>
              </div>

              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-400 opacity-60 cursor-not-allowed select-none">
                <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <span>Orders</span>
              </div>

              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-400 opacity-60 cursor-not-allowed select-none">
                <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span>Inbox</span>
              </div>

              {/* Active & Clickable Wishlist Item */}
              <Link
                href="/wishlist"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                <span>Wishlist</span>
              </Link>

              {/* Active & Clickable Cart Item */}
              <Link
                href="/cart"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-[#F2F0EA] hover:text-[#010101] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>My Cart</span>
              </Link>

              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-400 opacity-60 cursor-not-allowed select-none">
                <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12v.75m0 3v.75m0 3v.75m0 3V18M3 7.5h18a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H3a1.5 1.5 0 01-1.5-1.5V9A1.5 1.5 0 013 7.5z" />
                </svg>
                <span>Voucher</span>
              </div>
            </div>

            <div className="my-1.5 border-t border-gray-100" />

            {/* Clickable Sign in Black Button */}
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center justify-center gap-2 bg-[#010101] hover:bg-[#010101]/90 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] group/btn cursor-pointer"
            >
              <span>Sign in</span>
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
