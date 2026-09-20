"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getStoredCookiePreferences,
  saveCookiePreferences,
  DEFAULT_OPTIONAL_PREFERENCES,
} from "@/../lib/cookie-preferences";

function CookiesPlateIllustration({ className = "w-24 h-16" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 75"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Plate Shadow */}
      <ellipse cx="60" cy="58" rx="46" ry="12" fill="#000000" fillOpacity="0.07" />

      {/* Plate Base & Rim in soft sage */}
      <ellipse cx="60" cy="53" rx="48" ry="14" fill="#88B896" />
      <ellipse cx="60" cy="51" rx="45" ry="12" fill="#A2CCAE" />
      <ellipse cx="60" cy="50" rx="38" ry="9" fill="#90BD9C" />

      {/* Back Left Cookie */}
      <ellipse cx="44" cy="38" rx="14" ry="10" fill="#C98B48" />
      <circle cx="41" cy="35" r="1.8" fill="#3D200F" />
      <circle cx="47" cy="38" r="1.5" fill="#3D200F" />
      <circle cx="44" cy="42" r="1.6" fill="#3D200F" />

      {/* Back Right Cookie */}
      <ellipse cx="76" cy="37" rx="14" ry="10" fill="#D49856" />
      <circle cx="73" cy="34" r="1.8" fill="#3D200F" />
      <circle cx="79" cy="37" r="1.6" fill="#3D200F" />
      <circle cx="76" cy="41" r="1.4" fill="#3D200F" />

      {/* Top Center Cookie */}
      <ellipse cx="60" cy="30" rx="14" ry="10" fill="#E2A662" />
      <circle cx="56" cy="27" r="1.8" fill="#3D200F" />
      <circle cx="63" cy="29" r="1.6" fill="#3D200F" />
      <circle cx="58" cy="33" r="1.5" fill="#3D200F" />
      <circle cx="64" cy="34" r="1.4" fill="#3D200F" />

      {/* Mid Left Cookie */}
      <ellipse cx="45" cy="46" rx="15" ry="11" fill="#DE9E58" />
      <circle cx="41" cy="43" r="2" fill="#3D200F" />
      <circle cx="47" cy="45" r="1.7" fill="#3D200F" />
      <circle cx="43" cy="50" r="1.5" fill="#3D200F" />
      <circle cx="49" cy="49" r="1.6" fill="#3D200F" />

      {/* Mid Right Cookie */}
      <ellipse cx="74" cy="45" rx="15" ry="11" fill="#E7AB68" />
      <circle cx="71" cy="42" r="1.9" fill="#3D200F" />
      <circle cx="77" cy="44" r="1.7" fill="#3D200F" />
      <circle cx="72" cy="48" r="1.6" fill="#3D200F" />
      <circle cx="78" cy="49" r="1.7" fill="#3D200F" />

      {/* Foreground Center Cookie */}
      <ellipse cx="60" cy="50" rx="14" ry="10" fill="#CF8E4B" />
      <circle cx="56" cy="47" r="1.8" fill="#3D200F" />
      <circle cx="62" cy="49" r="1.7" fill="#3D200F" />
      <circle cx="59" cy="53" r="1.5" fill="#3D200F" />
    </svg>
  );
}

export function CookieConsentBanner() {
  const [hasChecked, setHasChecked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Only run on client
    const currentPrefs = getStoredCookiePreferences();
    if (!currentPrefs) {
      // User has not made a choice yet -> show banner
      setIsVisible(true);
    }
    setHasChecked(true);

    const handlePrefsChange = () => {
      // If user saved preferences elsewhere, hide banner
      setIsVisible(false);
    };

    window.addEventListener("gts-cookie-preferences-changed", handlePrefsChange);
    return () => {
      window.removeEventListener("gts-cookie-preferences-changed", handlePrefsChange);
    };
  }, []);

  const handleAcceptAll = () => {
    // Defaults to Optional Cookies enabled
    saveCookiePreferences(DEFAULT_OPTIONAL_PREFERENCES);
    setIsVisible(false);
  };

  const handleManageCookies = () => {
    router.push("/account?tab=cookies");
    setIsVisible(false);
  };

  if (!hasChecked || !isVisible) {
    return null;
  }

  return (
    <aside
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:left-6 sm:bottom-6 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-6 duration-300"
    >
      <div className="pointer-events-auto bg-white rounded-[26px] border border-gray-100/90 shadow-[0_20px_50px_rgba(0,0,0,0.16)] p-6 sm:p-7 max-w-[410px] w-full space-y-4">
        {/* Header: Title + Cute Plate of Cookies */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-extrabold text-xl sm:text-[22px] text-[#010101] tracking-tight leading-snug">
            Guess what? Cookies!
          </h3>
          <CookiesPlateIllustration className="w-20 h-14 shrink-0 -mr-1" />
        </div>

        {/* Body Description */}
        <p className="text-xs sm:text-[13px] text-gray-600 leading-relaxed font-normal">
          We use essential cookies to offer you a better website experience. We&apos;d like to use
          other cookies to analyse our website&apos;s performance and personalise ads, but only if you
          accept. Learn more about your choices in our{" "}
          <Link
            href="/privacy"
            className="text-[#010101] font-semibold underline underline-offset-2 hover:text-[#EDCF5D] transition-colors"
          >
            cookie policy.
          </Link>
        </p>

        {/* Action Buttons (Accept All + Manage Cookies) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="w-full py-3 px-4 rounded-xl bg-[#010101] hover:bg-[#EDCF5D] text-white hover:text-[#010101] font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer text-center"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={handleManageCookies}
            className="w-full py-3 px-4 rounded-xl bg-[#F2F0EA] hover:bg-[#EAE8E3] text-[#010101] font-bold text-xs sm:text-sm transition-all cursor-pointer text-center"
          >
            Manage Cookies
          </button>
        </div>
      </div>
    </aside>
  );
}
