"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Hero } from "./hero";
import { Bestsellers } from "./bestsellers";
import { Categories } from "./categories";
import { UpgradeAppliances } from "./upgrade-appliances";
import { BabySpecials } from "./baby-specials";
import { NewArrivals } from "./new-arrivals";
import { BeautyHygieneDeals } from "./beauty-hygiene-deals";
import { ShowcaseBanners } from "./showcase-banners";
import { CrazyFinds } from "./crazy-finds";
import { FAQ } from "./faq";
import { Footer } from "./footer";

export interface SectionMeta {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
}

export const INITIAL_SECTIONS: SectionMeta[] = [
  { id: "hero", name: "Hero Showcase", category: "Hero", enabled: true },
  { id: "bestsellers", name: "Bestselling Products", category: "Products", enabled: true },
  { id: "categories", name: "Featured Categories", category: "Categories", enabled: true },
  { id: "appliances", name: "Upgrade Your Appliances", category: "Products", enabled: true },
  { id: "baby", name: "Baby Specials", category: "Products", enabled: true },
  { id: "new-arrivals", name: "Fresh Season New Arrivals", category: "Showcase", enabled: true },
  { id: "beauty", name: "Beauty & Hygiene Deals", category: "Products", enabled: true },
  { id: "showcase", name: "Showcase Banners", category: "Banners", enabled: true },
  { id: "crazy-finds", name: "Crazy Finds", category: "Products", enabled: true },
  { id: "faq", name: "Frequently Asked Questions", category: "Support", enabled: true },
  { id: "footer", name: "Storefront Footer", category: "Footer", enabled: true },
];

export function StorefrontSectionsManager() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("edit_mode") === "true";
  const [sections, setSections] = useState<SectionMeta[]>(INITIAL_SECTIONS);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sync with localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gts_storefront_sections_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with any newly added sections
          const existingIds = new Set(parsed.map((s: any) => s.id));
          const merged = [
            ...parsed,
            ...INITIAL_SECTIONS.filter((s) => !existingIds.has(s.id)),
          ];
          setSections(merged);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const [isPanMode, setIsPanMode] = useState<boolean>(false);

  // Listen to postMessage from parent dashboard editor
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const { type, payload } = event.data;

      if (type === "GTS_UPDATE_SECTIONS" && Array.isArray(payload)) {
        setSections(payload);
        localStorage.setItem("gts_storefront_sections_order", JSON.stringify(payload));
      } else if (type === "GTS_SELECT_SECTION") {
        setSelectedSectionId(payload);
        const el = document.getElementById(`storefront-section-${payload}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else if (type === "GTS_SET_PAN_MODE") {
        setIsPanMode(Boolean(payload));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Report scrollHeight to parent dashboard editor so iframe has full flat height without internal scrollbar
  useEffect(() => {
    if (!isEditMode) return;

    const reportHeight = () => {
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        5400
      );
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: "GTS_STOREFRONT_HEIGHT", payload: height },
          "*"
        );
      }
    };

    reportHeight();
    const timer1 = setTimeout(reportHeight, 400);
    const timer2 = setTimeout(reportHeight, 1200);

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => reportHeight())
      : null;

    if (observer && document.body) {
      observer.observe(document.body);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      observer?.disconnect();
    };
  }, [isEditMode, sections]);

  // Broadcast changes to parent editor if inside iframe
  const notifyParent = useCallback((updated: SectionMeta[]) => {
    localStorage.setItem("gts_storefront_sections_order", JSON.stringify(updated));
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "GTS_SECTIONS_CHANGED", payload: updated }, "*");
    }
  }, []);

  const moveSection = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const newSections = [...sections];
    const [moved] = newSections.splice(index, 1);
    if (moved) {
      newSections.splice(targetIndex, 0, moved);
      setSections(newSections);
      notifyParent(newSections);
    }
  };

  const toggleSectionVisibility = (id: string) => {
    const newSections = sections.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setSections(newSections);
    notifyParent(newSections);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSections = [...sections];
    const [moved] = newSections.splice(draggedIndex, 1);
    if (moved) {
      newSections.splice(index, 0, moved);
      setSections(newSections);
      notifyParent(newSections);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const renderSectionComponent = (id: string) => {
    switch (id) {
      case "hero":
        return <Hero />;
      case "bestsellers":
        return <Bestsellers />;
      case "categories":
        return <Categories />;
      case "appliances":
        return <UpgradeAppliances />;
      case "baby":
        return <BabySpecials />;
      case "new-arrivals":
        return <NewArrivals />;
      case "beauty":
        return <BeautyHygieneDeals />;
      case "showcase":
        return <ShowcaseBanners />;
      case "crazy-finds":
        return <CrazyFinds />;
      case "faq":
        return <FAQ />;
      case "footer":
        return <Footer />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col w-full">
      {sections.map((section, index) => {
        // If not in edit mode and section is disabled, skip rendering
        if (!isEditMode && !section.enabled) return null;

        const isSelected = selectedSectionId === section.id;
        const isDragged = draggedIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={section.id}
            id={`storefront-section-${section.id}`}
            draggable={isEditMode && !isPanMode}
            onDragStart={(e) => {
              if (isPanMode) {
                e.preventDefault();
                return;
              }
              handleDragStart(index);
            }}
            onDragOver={(e) => {
              if (isPanMode) return;
              handleDragOver(e, index);
            }}
            onDrop={() => {
              if (isPanMode) return;
              handleDrop(index);
            }}
            className={`w-full relative transition-all duration-200 ${
              isPanMode
                ? "pointer-events-none select-none"
                : isEditMode
                ? `group/section my-1 rounded-sm ${
                    // Prominent red outline matching the user's reference image
                    isSelected
                      ? "ring-4 ring-red-600 shadow-xl"
                      : "ring-[3px] ring-red-500/90 hover:ring-red-600 hover:shadow-lg"
                  } ${isDragged ? "opacity-40" : "opacity-100"} ${
                    isDragOver ? "border-t-4 border-red-700" : ""
                  } ${!section.enabled ? "opacity-50 grayscale" : ""}`
                : ""
            }`}
            onClick={() => {
              if (isEditMode && !isPanMode) {
                setSelectedSectionId(section.id);
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage(
                    { type: "GTS_SECTION_SELECTED", payload: section.id },
                    "*"
                  );
                }
              }
            }}
          >
            {/* ── Editing Mode Controls Overlay ── */}
            {isEditMode && !isPanMode && (
              <div className="absolute top-2 left-3 right-3 z-30 flex items-center justify-between pointer-events-none opacity-0 group-hover/section:opacity-100 transition-opacity duration-150">
                {/* Section Badge & Drag Handle */}
                <div className="flex items-center gap-2 bg-[#010101] text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-lg backdrop-blur-md pointer-events-auto cursor-grab active:cursor-grabbing border border-white/20">
                  <span className="text-gray-400 select-none">⠿</span>
                  <span className="tracking-wide">{section.name}</span>
                  <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded text-white font-mono uppercase">
                    {index + 1}/{sections.length}
                  </span>
                </div>

                {/* Reorder Buttons & Actions */}
                <div className="flex items-center gap-1 bg-[#010101] text-white p-1 rounded-md shadow-lg backdrop-blur-md pointer-events-auto border border-white/20">
                  {/* Move Up Button */}
                  <button
                    type="button"
                    title="Move section up"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSection(index, "up");
                    }}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                      index === 0
                        ? "text-gray-600 cursor-not-allowed"
                        : "hover:bg-white/20 text-white active:scale-95"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>

                  {/* Move Down Button */}
                  <button
                    type="button"
                    title="Move section down"
                    disabled={index === sections.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSection(index, "down");
                    }}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                      index === sections.length - 1
                        ? "text-gray-600 cursor-not-allowed"
                        : "hover:bg-white/20 text-white active:scale-95"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Visibility Toggle */}
                  <button
                    type="button"
                    title={section.enabled ? "Hide section" : "Show section"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSectionVisibility(section.id);
                    }}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/20 text-white active:scale-95 transition-colors"
                  >
                    {section.enabled ? (
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Actual Section Content */}
            <div className={isEditMode ? "pointer-events-none select-none" : ""}>
              {renderSectionComponent(section.id)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
