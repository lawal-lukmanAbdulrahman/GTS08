"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authFetch } from "../lib/session";

export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: (className?: string) => React.ReactNode;
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: "add_product",
    title: "Add your first product",
    description: "Upload your items with images, pricing, and category assignments.",
    href: "/admin/products/new",
    actionLabel: "Add Product",
    icon: (cls = "w-4 h-4") => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    id: "manage_inventory",
    title: "Manage inventory & stock",
    description: "Set initial stock levels and low-stock alerts across channels.",
    href: "/admin/inventory/web",
    actionLabel: "Manage Stock",
    icon: (cls = "w-4 h-4") => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    id: "setup_staff",
    title: "Setup employees & staff",
    description: "Invite team members and configure role-based access permissions.",
    href: "/admin/staff",
    actionLabel: "Invite Staff",
    icon: (cls = "w-4 h-4") => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    id: "setup_pickup",
    title: "Configure pickup stations",
    description: "Create physical pickup hubs for customer click-and-collect orders.",
    href: "/admin/pickup-stations",
    actionLabel: "Setup Pickup",
    icon: (cls = "w-4 h-4") => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    id: "launch_promo",
    title: "Launch your first promo code",
    description: "Offer promotional voucher codes to drive customer checkout conversions.",
    href: "/admin/promos",
    actionLabel: "Create Promo",
    icon: (cls = "w-4 h-4") => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    id: "store_profile",
    title: "Store profile & contact details",
    description: "Verify your store name, business WhatsApp line, and support settings.",
    href: "/admin/settings",
    actionLabel: "Store Settings",
    icon: (cls = "w-4 h-4") => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009 9.75c.696 0 1.341-.237 1.856-.636a3.002 3.002 0 004.288 0A2.993 2.993 0 0017.25 9.75c.696 0 1.341-.237 1.856-.636a3.001 3.001 0 002.894 1.235" />
      </svg>
    ),
  },
];

const STORAGE_KEY = "gts_store_walkthrough_state";
const DISMISSED_KEY = "gts_store_walkthrough_dismissed";

export default function StoreWalkthrough() {
  const [mounted, setMounted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);

    // 1. Load manual completions from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCompletedSteps(JSON.parse(saved));
      }
    } catch {
      // ignore
    }

    // 2. Load minimized preference
    try {
      const savedMin = localStorage.getItem(DISMISSED_KEY);
      if (savedMin === "true") {
        setIsMinimized(true);
      }
    } catch {
      // ignore
    }

    // 3. Auto-detect real store progress from API
    const checkStoreProgress = async () => {
      try {
        const detected: Record<string, boolean> = {};

        // Check products
        const prodRes = await authFetch("/api/v1/products?limit=1");
        if (prodRes.ok) {
          const prodJson = await prodRes.json();
          const items = Array.isArray(prodJson.data)
            ? prodJson.data
            : Array.isArray(prodJson)
            ? prodJson
            : [];
          if (items.length > 0) detected.add_product = true;
        }

        // Check pickup stations
        const pickupRes = await authFetch("/api/v1/pickup-stations");
        if (pickupRes.ok) {
          const pickupJson = await pickupRes.json();
          const items = Array.isArray(pickupJson.data)
            ? pickupJson.data
            : Array.isArray(pickupJson)
            ? pickupJson
            : [];
          if (items.length > 0) detected.setup_pickup = true;
        }

        // Check promos
        const promoRes = await authFetch("/api/v1/promos");
        if (promoRes.ok) {
          const promoJson = await promoRes.json();
          const items = Array.isArray(promoJson.data)
            ? promoJson.data
            : Array.isArray(promoJson)
            ? promoJson
            : [];
          if (items.length > 0) detected.launch_promo = true;
        }

        // Check staff
        const staffRes = await authFetch("/api/v1/staff");
        if (staffRes.ok) {
          const staffJson = await staffRes.json();
          const items = Array.isArray(staffJson.data)
            ? staffJson.data
            : Array.isArray(staffJson)
            ? staffJson
            : [];
          // If more than 1 user or existing staff member
          if (items.length > 0) detected.setup_staff = true;
        }

        setCompletedSteps((prev) => {
          const updated = { ...prev, ...detected };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      } catch {
        // non-blocking
      }
    };

    checkStoreProgress();
  }, [pathname]);

  // Lock scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setIsDrawerOpen(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = origOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isDrawerOpen]);

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const completedCount = useMemo(() => {
    return WALKTHROUGH_STEPS.filter((step) => completedSteps[step.id]).length;
  }, [completedSteps]);

  const totalSteps = WALKTHROUGH_STEPS.length;
  const stepsLeft = totalSteps - completedCount;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  const toggleMinimize = (min: boolean) => {
    setIsMinimized(min);
    try {
      localStorage.setItem(DISMISSED_KEY, min ? "true" : "false");
    } catch {
      // ignore
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* ────── 1. FLOATING BOTTOM SETUP DIALOG / WIDGET ────── */}
      <aside
        aria-label="Store setup progress"
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-6 z-40 max-w-sm transition-all duration-300"
      >
        {isMinimized ? (
          /* Minimized pill button */
          <button
            type="button"
            onClick={() => toggleMinimize(false)}
            title="Open Store Setup Guide"
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#010101] dark:bg-[#1A1A1A] text-white border border-gray-800 dark:border-[#333333] shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-5 h-5 rounded-full bg-[#EDCF5D] text-[#010101] flex items-center justify-center font-bold text-[10px]">
              {stepsLeft > 0 ? stepsLeft : "✓"}
            </div>
            <span className="text-xs font-semibold tracking-tight text-white group-hover:text-[#EDCF5D] transition-colors">
              {stepsLeft > 0 ? `${stepsLeft} setup steps left` : "Store setup complete"}
            </span>
          </button>
        ) : (
          /* Expandable Bottom Card */
          <div className="bg-white dark:bg-[#151515] border border-gray-200 dark:border-[#262626] rounded-xl p-3.5 shadow-2xl w-80 sm:w-88 transition-all">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#010101] dark:bg-[#252525] text-[#EDCF5D] flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#010101] dark:text-white leading-tight">
                    Store Setup Guide
                  </h4>
                  <p className="text-[10px] text-gray-500 dark:text-[#9CA3AF]">
                    {stepsLeft > 0 ? `${stepsLeft} steps remaining` : "All steps completed!"}
                  </p>
                </div>
              </div>

              {/* Minimize button */}
              <button
                type="button"
                onClick={() => toggleMinimize(true)}
                title="Minimize guide"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#222222] transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            {/* Progress Bar */}
            <div className="my-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-gray-500 dark:text-[#9CA3AF]">
                  {completedCount} of {totalSteps} done
                </span>
                <span className="font-bold text-[#010101] dark:text-[#EDCF5D]">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-[#262626] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#010101] dark:bg-[#EDCF5D] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="flex-1 py-1.5 px-3 rounded-lg bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#010101] text-xs font-bold shadow-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View Checklist</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ────── 2. RIGHT PANEL DRAWER (CHECKLIST) ────── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[90] font-sans">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Right Slide-out Drawer */}
          <section
            aria-label="Store setup checklist"
            className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white dark:bg-[#151515] shadow-2xl flex flex-col justify-between z-[95] border-l border-gray-200 dark:border-[#262626] animate-in slide-in-from-right duration-300"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-[#242424] shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#010101] dark:bg-[#252525] text-[#EDCF5D] flex items-center justify-center font-black">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#010101] dark:text-white">
                      Store Setup Checklist
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-[#9CA3AF]">
                      Essential tasks to get your web store fully operational.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
                  title="Close Guide"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Progress Tracker Card */}
              <div className="p-3 bg-gray-50 dark:bg-[#1E1E1E] rounded-lg border border-gray-200/70 dark:border-[#2D2D2D]">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="text-[#010101] dark:text-white">
                    {stepsLeft > 0 ? `${stepsLeft} steps remaining` : "Store setup completed!"}
                  </span>
                  <span className="font-mono text-[#010101] dark:text-[#EDCF5D]">
                    {completedCount} / {totalSteps} ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#010101] dark:bg-[#EDCF5D] rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Steps List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {WALKTHROUGH_STEPS.map((step, index) => {
                const isDone = !!completedSteps[step.id];
                return (
                  <div
                    key={step.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isDone
                        ? "bg-gray-50/70 dark:bg-[#1A1A1A]/70 border-gray-200/60 dark:border-[#262626] opacity-80"
                        : "bg-white dark:bg-[#1C1C1C] border-gray-200 dark:border-[#2D2D2D] hover:border-gray-400 dark:hover:border-gray-600 shadow-xs"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleStep(step.id)}
                        className={`mt-0.5 w-5 h-5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isDone
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-gray-300 dark:border-gray-600 hover:border-[#010101] dark:hover:border-[#EDCF5D] bg-transparent"
                        }`}
                        title={isDone ? "Mark incomplete" : "Mark completed"}
                      >
                        {isDone && (
                          <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-sm bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-300">
                            0{index + 1}
                          </span>
                          <h4
                            className={`text-xs font-bold truncate ${
                              isDone
                                ? "line-through text-gray-500 dark:text-[#7A7A7A]"
                                : "text-[#010101] dark:text-white"
                            }`}
                          >
                            {step.title}
                          </h4>
                        </div>

                        <p className="text-[11px] text-gray-500 dark:text-[#9CA3AF] leading-relaxed mb-3">
                          {step.description}
                        </p>

                        <div className="flex items-center gap-2">
                          <Link
                            href={step.href}
                            onClick={() => setIsDrawerOpen(false)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#010101] text-white dark:bg-[#2A2A2A] dark:hover:bg-[#333333] dark:text-white text-[11px] font-semibold hover:opacity-90 transition-all cursor-pointer shadow-2xs"
                          >
                            <span>{step.actionLabel}</span>
                            <span aria-hidden="true">→</span>
                          </Link>
                          {isDone && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-[#242424] bg-gray-50/50 dark:bg-[#1A1A1A] shrink-0">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCompletedSteps({});
                    try {
                      localStorage.removeItem(STORAGE_KEY);
                    } catch {
                      // ignore
                    }
                  }}
                  className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  Reset Checklist
                </button>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-gray-200 dark:bg-[#282828] text-gray-800 dark:text-gray-200 text-xs font-bold hover:bg-gray-300 dark:hover:bg-[#333333] transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>,
    document.body
  );
}
