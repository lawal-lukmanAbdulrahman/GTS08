"use client";

import React, { useEffect, useRef } from "react";

interface DeletedAccountDialogProps {
  isOpen: boolean;
  deletionReason?: string | null;
  supportPhone?: string | null;
  onAcknowledge: () => void;
  onTamper?: () => void;
}

export function DeletedAccountDialog({
  isOpen,
  deletionReason,
  supportPhone,
  onAcknowledge,
  onTamper,
}: DeletedAccountDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isAcknowledgingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    // Forcefully wipe session tokens and reload the page on tamper
    const handleTamper = () => {
      if (isAcknowledgingRef.current) return;
      isAcknowledgingRef.current = true;

      try {
        localStorage.removeItem("gts_customer_user");
        localStorage.removeItem("gts_customer_token");
        localStorage.removeItem("gts_token");
        localStorage.removeItem("gts_user");
        localStorage.removeItem("gts_demo_mode");
        sessionStorage.clear();
        document.cookie = "gts_customer_token=; path=/; max-age=0";
        document.cookie = "gts_access_token=; path=/; max-age=0";
        document.cookie = "gts_demo_mode=; path=/; max-age=0";
      } catch {}

      if (onTamper) {
        onTamper();
      }

      if (typeof window !== "undefined") {
        window.location.reload();
      }
    };

    // 1. Freeze underlying page interaction
    const freezeStyle = document.createElement("style");
    freezeStyle.id = "gts-deleted-freeze-style";
    freezeStyle.innerHTML = `
      body > *:not(#gts-unremovable-deleted-account-dialog) {
        pointer-events: none !important;
        user-select: none !important;
        filter: blur(2px) grayscale(40%) !important;
      }
      body {
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(freezeStyle);

    // 2. Active DOM Mutation Observer: catches element deletion or style manipulation in DevTools
    const checkIntegrity = () => {
      if (isAcknowledgingRef.current) return;
      const el = document.getElementById("gts-unremovable-deleted-account-dialog");
      if (!el || !document.body.contains(el)) {
        handleTamper();
        return;
      }
      try {
        const style = window.getComputedStyle(el);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          parseFloat(style.opacity || "1") < 0.1 ||
          style.pointerEvents === "none"
        ) {
          handleTamper();
        }
      } catch {
        handleTamper();
      }
    };

    const observer = new MutationObserver(() => {
      checkIntegrity();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    // 3. Heartbeat watchdog interval (every 200ms)
    const watchdogInterval = setInterval(() => {
      checkIntegrity();
    }, 200);

    return () => {
      observer.disconnect();
      clearInterval(watchdogInterval);
      const styleEl = document.getElementById("gts-deleted-freeze-style");
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [isOpen, onTamper]);

  if (!isOpen) return null;

  const phoneText = supportPhone || "+234 800 000 0000";
  const reasonText = deletionReason || "Administrative decision";

  const handleOkay = () => {
    isAcknowledgingRef.current = true;
    onAcknowledge();
  };

  return (
    <div
      ref={dialogRef}
      id="gts-unremovable-deleted-account-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deleted-dialog-title"
      className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#1C1C1C] rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-200 dark:border-[#333333] text-center transform animate-in zoom-in-95 duration-200 relative z-[10000000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 mb-5 shadow-xs">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h3 id="deleted-dialog-title" className="text-xl sm:text-2xl font-black text-[#010101] dark:text-white tracking-tight">
          Account Deleted
        </h3>

        <div className="mt-4 p-4 rounded-2xl bg-gray-50 dark:bg-[#252525] border border-gray-200/80 dark:border-[#383838] text-left space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Reason for Deletion
          </span>
          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
            {reasonText}
          </p>
        </div>

        <p className="mt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          If you believe this was an error, please contact customer support at:
          <br />
          <a
            href={`tel:${phoneText.replace(/\s+/g, "")}`}
            className="inline-block mt-1 font-bold text-[#010101] dark:text-[#EDCF5D] underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {phoneText}
          </a>
        </p>

        {/* Sole action button: unremovable until Okay is pressed */}
        <div className="mt-7">
          <button
            type="button"
            onClick={handleOkay}
            className="w-full py-3.5 px-6 rounded-full bg-[#010101] hover:bg-black text-white font-bold text-sm transition-all shadow-md active:scale-98 cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/20"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
}
