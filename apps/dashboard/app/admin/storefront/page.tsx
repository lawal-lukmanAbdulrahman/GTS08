"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { apiCall } from "../../lib/staff-api";
import { SidebarToggle } from "../sidebar-context";
import { CatalogueProvider } from "./_storefront/catalogue-context";
import { Header } from "./_storefront/landing/header";
import { Hero } from "./_storefront/landing/hero";
import { Bestsellers } from "./_storefront/landing/bestsellers";
import { Categories } from "./_storefront/landing/categories";
import { UpgradeAppliances } from "./_storefront/landing/upgrade-appliances";
import { BabySpecials } from "./_storefront/landing/baby-specials";
import { NewArrivals } from "./_storefront/landing/new-arrivals";
import { BeautyHygieneDeals } from "./_storefront/landing/beauty-hygiene-deals";
import { ShowcaseBanners } from "./_storefront/landing/showcase-banners";
import { CrazyFinds } from "./_storefront/landing/crazy-finds";
import { FAQ } from "./_storefront/landing/faq";
import { Footer } from "./_storefront/landing/footer";
import { CartProvider } from "./_storefront/cart-context";
import { WishlistProvider } from "./_storefront/wishlist-context";
import { AuthProvider } from "./_storefront/auth-context";
import { AuthModalProvider } from "./_storefront/auth-modal-context";

interface SectionItem {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
}

const DEFAULT_SECTIONS: SectionItem[] = [
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

interface HeroProductChoice {
  id: string;
  name: string;
  brand: string;
  price: string;
  selected: boolean;
  image: string;
}

const DEFAULT_HERO_PRODUCTS: HeroProductChoice[] = [
  {
    id: "air-jordan-1",
    name: "Air Jordan Retro 1 High",
    brand: "Nike",
    price: "₦85,000",
    selected: true,
    image: "/products/hero/air_jordan_retro_1_blue.png",
  },
  {
    id: "pixel-10",
    name: "Google Pixel 10 Pro 5G",
    brand: "Google",
    price: "₦620,000",
    selected: true,
    image: "/products/hero/pixel_10_green.png",
  },
  {
    id: "samsung-fridge",
    name: "Samsung French Door Refrigerator",
    brand: "Samsung",
    price: "₦750,000",
    selected: true,
    image: "/products/hero/samsung_fridge_black.png",
  },
  {
    id: "nexus-washing-machine",
    name: "Nexus Twin Tub Washing Machine",
    brand: "Nexus",
    price: "₦185,000",
    selected: true,
    image: "/products/hero/nexus_washing_machine_blue.png",
  },
  {
    id: "chicco-bravo-stroller",
    name: "Chicco Bravo 3-in-1 Quick-Fold Stroller",
    brand: "Chicco",
    price: "₦185,000",
    selected: false,
    image: "/products/baby_stroller.jpg",
  },
  {
    id: "maison-luxury-eau-de-parfum",
    name: "Maison Francis Kurkdjian Baccarat Rouge 540",
    brand: "Maison Francis",
    price: "₦165,000",
    selected: false,
    image: "/products/perfume_luxury.jpg",
  },
];

const BASE_WIDTH = 1440;

function StorefrontManagementPage() {
  const [sections, setSections] = useState<SectionItem[]>(DEFAULT_SECTIONS);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("hero");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sections" | "hero_products">("sections");
  const [heroProducts, setHeroProducts] = useState<HeroProductChoice[]>(DEFAULT_HERO_PRODUCTS);

  // Drag state (works identically on sidebar and canvas)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(0.52);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; startOffsetX: number; startOffsetY: number }>({
    x: 0,
    y: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });

  // History State for Undo / Redo
  const [historyPast, setHistoryPast] = useState<SectionItem[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<SectionItem[][]>([]);

  const activePanMode = isPanMode || isSpaceHeld;

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gts_storefront_sections_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSections(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const pushHistory = (currentSections: SectionItem[]) => {
    setHistoryPast((prev) => [...prev.slice(-30), currentSections]);
    setHistoryFuture([]);
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    if (!previous) return;
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [sections, ...prev]);
    setSections(previous);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    if (!next) return;
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev, sections]);
    setSections(next);
  };

  // Keyboard shortcuts (Undo/Redo & Spacebar Pan)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isSpaceHeld && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault();
        setIsSpaceHeld(true);
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z")) ||
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y"))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [historyPast, historyFuture, sections, isSpaceHeld]);

  // Window-level mousemove and mouseup listeners for buttery-smooth panning
  useEffect(() => {
    if (!isPanning) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanOffset({
        x: panStartRef.current.startOffsetX + dx,
        y: panStartRef.current.startOffsetY + dy,
      });
    };

    const handleWindowMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isPanning]);

  const handleMouseDownPan = (e: React.MouseEvent) => {
    if (activePanMode || e.button === 1 || e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startOffsetX: panOffset.x,
        startOffsetY: panOffset.y,
      };
    }
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) return;

    pushHistory(sections);
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    if (moved) {
      copy.splice(target, 0, moved);
      setSections(copy);
    }
  };

  const toggleSectionEnabled = (id: string) => {
    pushHistory(sections);
    const copy = sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    setSections(copy);
  };

  const handleDragStart = (index: number) => {
    if (activePanMode) return;
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (activePanMode) return;
    e.preventDefault();
    setDragOverIdx(index);
  };

  const handleDrop = (index: number) => {
    if (activePanMode) return;
    if (draggedIdx === null || draggedIdx === index) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    pushHistory(sections);
    const copy = [...sections];
    const [moved] = copy.splice(draggedIdx, 1);
    if (moved) {
      copy.splice(index, 0, moved);
      setSections(copy);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    localStorage.setItem("gts_storefront_sections_order", JSON.stringify(sections));

    const selectedHeroIds = heroProducts.filter((p) => p.selected).map((p) => p.id);
    // The layout is only "saved live" once the server (admin-only) accepts it.
    const result = await apiCall("/storefront/sections", {
      method: "PUT",
      json: { sections, heroProductIds: selectedHeroIds },
    });

    if (result.ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(result.message);
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    pushHistory(sections);
    setSections(DEFAULT_SECTIONS);
  };

  const toggleHeroProduct = (id: string) => {
    const updated = heroProducts.map((p) =>
      p.id === id ? { ...p, selected: !p.selected } : p
    );
    setHeroProducts(updated);
  };

  // Render individual native section component
  const renderSectionVisual = (id: string) => {
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
    <div className="flex flex-col h-screen bg-[#0E0E0E] text-white select-none overflow-hidden font-sans">
      {/* ────── TOP STUDIO HEADER ────── */}
      <header className="h-16 px-6 border-b border-[#242424] bg-[#141414] flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <SidebarToggle className="text-gray-400 hover:text-white hover:bg-[#222222]" />

          <Link
            href="/admin"
            className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#222222] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Dashboard</span>
          </Link>

          <div className="h-4 w-px bg-[#2C2C2C]" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono uppercase">Page:</span>
            <span className="text-sm font-bold text-white tracking-wide">Storefront Management</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-[#222222] transition-colors cursor-pointer"
          >
            Reset Defaults
          </button>

          {/* Save Button with signature GTS Gold accent */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-[#EDCF5D] hover:bg-[#dfbe46] text-black font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Saving Changes...</span>
              </>
            ) : saveSuccess ? (
              <>
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Saved Live!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Save Changes</span>
              </>
            )}
          </button>
          {saveError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400 max-w-xs">
              Not saved: {saveError}
            </p>
          )}
        </div>
      </header>

      {/* ────── MAIN STUDIO WORKSPACE (DOTTED GRID BACKGROUND) ────── */}
      <div className="flex-1 relative overflow-hidden bg-[#0A0A0A] bg-[radial-gradient(#2E2E2E_1px,transparent_1px)] [background-size:24px_24px] flex p-3 gap-3">
        {/* ══════════════════════════════════════════════════════════════
            LEFT FLOATING OVERLAY PANEL (CONTROLS)
            ══════════════════════════════════════════════════════════════ */}
        <aside className="w-80 lg:w-[380px] h-full rounded-2xl border border-[#262626] bg-[#141414]/95 backdrop-blur-xl flex flex-col shrink-0 z-20 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Segmented Tab Navigation */}
          <div className="p-2.5 border-b border-[#242424] bg-[#141414]/90 shrink-0">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-[10px] bg-[#1C1C1E] border border-[#2A2A2E]">
              <button
                onClick={() => setActiveTab("sections")}
                className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === "sections"
                    ? "bg-[#2C2C2E] text-white shadow-xs"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Sections Order ({sections.filter((s) => s.enabled).length}/{sections.length})
              </button>
              <button
                onClick={() => setActiveTab("hero_products")}
                className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === "hero_products"
                    ? "bg-[#2C2C2E] text-white shadow-xs"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Hero Products
              </button>
            </div>
          </div>

          {/* Tab 1: Sections List */}
          {activeTab === "sections" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Storefront Structure
                </span>
                <span className="text-[11px] text-gray-500">Drag or use arrows</span>
              </div>

              {sections.map((section, index) => {
                const isSelected = selectedSectionId === section.id;
                const isDragged = draggedIdx === index;
                const isOver = dragOverIdx === index;

                return (
                  <div
                    key={section.id}
                    draggable={!activePanMode}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      const el = document.getElementById(`native-section-${section.id}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`group p-3 rounded-xl border transition-all select-none flex items-center justify-between gap-3 ${
                      activePanMode ? "cursor-default opacity-85" : "cursor-pointer"
                    } ${
                      isSelected
                        ? "border-[#EDCF5D] bg-[#EDCF5D]/10 shadow-lg shadow-[#EDCF5D]/5"
                        : "border-[#262626] bg-[#1A1A1A] hover:border-[#383838]"
                    } ${isDragged ? "opacity-30" : "opacity-100"} ${
                      isOver ? "border-t-2 border-t-[#EDCF5D]" : ""
                    } ${!section.enabled ? "opacity-40" : ""}`}
                  >
                    {/* Left Drag Handle & Section Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`text-sm shrink-0 select-none ${
                          activePanMode
                            ? "text-gray-600 cursor-default"
                            : "text-gray-500 hover:text-[#EDCF5D] cursor-grab active:cursor-grabbing"
                        }`}
                        title={activePanMode ? "Pan Mode active" : "Drag to reorder"}
                      >
                        ⠿
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">
                            {section.name}
                          </span>
                          {section.id === "hero" && (
                            <span className="text-[10px] bg-[#EDCF5D]/20 text-[#EDCF5D] font-bold px-1.5 py-0.2 rounded">
                              Hero
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono">
                          Section {index + 1} • {section.category}
                        </span>
                      </div>
                    </div>

                    {/* Right Move Up / Down & Eye Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSection(index, "up");
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          index === 0
                            ? "text-gray-600 cursor-not-allowed"
                            : "hover:bg-white/10 text-gray-300 hover:text-white active:scale-95 cursor-pointer"
                        }`}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === sections.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSection(index, "down");
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          index === sections.length - 1
                            ? "text-gray-600 cursor-not-allowed"
                            : "hover:bg-white/10 text-gray-300 hover:text-white active:scale-95 cursor-pointer"
                        }`}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionEnabled(section.id);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
                        title={section.enabled ? "Hide section" : "Show section"}
                      >
                        {section.enabled ? (
                          <svg className="w-4 h-4 text-[#EDCF5D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Hero Section Product Selection */}
          {activeTab === "hero_products" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              <div className="px-1">
                <h4 className="text-xs font-bold text-white">
                  Featured Hero Products
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Select which products rotate in the interactive 3D hero stage.
                </p>
              </div>

              <div className="space-y-2">
                {heroProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => toggleHeroProduct(p.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      p.selected
                        ? "border-[#EDCF5D] bg-[#EDCF5D]/10"
                        : "border-[#262626] bg-[#1A1A1A] opacity-50 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        <img src={p.image} alt={p.name} className="w-8 h-8 object-contain" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-white truncate">
                          {p.name}
                        </h5>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <span>{p.brand}</span>
                          <span>•</span>
                          <span className="font-semibold text-[#EDCF5D]">{p.price}</span>
                        </div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={() => {}}
                      className="accent-[#EDCF5D] w-4 h-4 rounded cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT NATIVE STOREFRONT CANVAS
            - 100% NATIVE REACT COMPONENTS (ZERO IFRAME / ZERO OFFLINE ERRORS)
            - ZERO SIDEWAYS SCROLLBAR (overflow-x-hidden)
            - VERTICALLY SCROLLABLE WITH NATIVE MOUSE/WHEEL
            - SMOOTH PANNING (Hold Spacebar or Click Pan)
            - DIRECT DRAG & DROP ON CANVAS SECTIONS
            ══════════════════════════════════════════════════════════════ */}
        <div className="flex-1 relative h-full overflow-hidden flex flex-col">
          <main
            onMouseDown={handleMouseDownPan}
            className={`w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center select-none py-10 px-4 ${
              activePanMode
                ? isPanning
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-default"
            }`}
          >
            {/* Scaled bounding wrapper matching true layout box dimensions */}
            <div
              style={{
                width: `${BASE_WIDTH * zoom}px`,
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                transition: isPanning ? "none" : "transform 0.08s ease-out",
                marginBottom: "180px",
              }}
              className="shrink-0"
            >
              {/* Scaled Canvas Container with clean frame & drop shadow */}
              <div
                style={{
                  width: `${BASE_WIDTH}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
                className="rounded-2xl border border-[#262626] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-hidden"
              >
                <AuthProvider>
                  <AuthModalProvider>
                    <WishlistProvider>
                      <CartProvider>
                        {/* Storefront Real Header Navigation */}
                        <div className="w-full pointer-events-none select-none">
                          <Suspense fallback={null}>
                            <Header />
                          </Suspense>
                        </div>

                        {/* ── Native Sections Stack ── */}
                        <div className="flex flex-col w-full">
                          {sections.map((section, index) => {
                    const isSelected = selectedSectionId === section.id;
                    const isDragged = draggedIdx === index;
                    const isOver = dragOverIdx === index;

                    return (
                      <div
                        key={section.id}
                        id={`native-section-${section.id}`}
                        draggable={!activePanMode}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={() => handleDrop(index)}
                        onClick={() => setSelectedSectionId(section.id)}
                        className={`w-full relative transition-all duration-150 group/section ${
                          activePanMode
                            ? "cursor-grab select-none"
                            : "cursor-default"
                        } ${
                          isSelected
                            ? "ring-4 ring-red-600 shadow-xl z-20"
                            : "hover:ring-[3px] hover:ring-red-500/80"
                        } ${isDragged ? "opacity-30 scale-[0.99]" : "opacity-100"} ${
                          isOver ? "border-t-4 border-red-700" : ""
                        } ${!section.enabled ? "opacity-40 grayscale" : ""}`}
                      >
                        {/* Section Floating Badge Overlay (on hover) */}
                        {!activePanMode && (
                          <div className="absolute top-3 left-4 right-4 z-30 flex items-center justify-between pointer-events-none opacity-0 group-hover/section:opacity-100 transition-opacity duration-150">
                            <div className="flex items-center gap-2 bg-[#010101]/95 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xl backdrop-blur-md pointer-events-auto border border-white/20">
                              <span className="text-gray-400 cursor-grab active:cursor-grabbing select-none" title="Drag to reorder section">
                                ⠿
                              </span>
                              <span className="tracking-wide font-bold">{section.name}</span>
                              <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded text-white font-mono uppercase">
                                {index + 1}/{sections.length}
                              </span>
                            </div>

                            {/* Quick Action Controls */}
                            <div className="flex items-center gap-1.5 bg-[#010101]/95 text-white px-2 py-1 rounded-lg shadow-2xl backdrop-blur-md pointer-events-auto border border-white/20">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveSection(index, "up");
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                title="Move section up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={index === sections.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveSection(index, "down");
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                title="Move section down"
                              >
                                ▼
                              </button>
                              <div className="w-px h-3.5 bg-white/20" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSectionEnabled(section.id);
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-white/20 transition-colors cursor-pointer"
                                title={section.enabled ? "Hide section from storefront" : "Show section"}
                              >
                                {section.enabled ? "👁" : "🚫"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Disabled Overlay Tag */}
                        {!section.enabled && (
                          <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="bg-black/90 border border-white/20 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2">
                              <span>Hidden from customers</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSectionEnabled(section.id);
                                }}
                                className="text-[#EDCF5D] underline ml-1 cursor-pointer"
                              >
                                Enable
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Native Section Component */}
                        <div className="w-full pointer-events-none select-none">
                          {renderSectionVisual(section.id)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                      </CartProvider>
                    </WishlistProvider>
                  </AuthModalProvider>
                </AuthProvider>
              </div>
            </div>
          </main>

          {/* ══════════════════════════════════════════════════════════════
              FIXED FLOATING BOTTOM-RIGHT CONTROLS (NON-SCROLLABLE)
              ══════════════════════════════════════════════════════════════ */}
          <div className="absolute bottom-4 right-5 z-40 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#141414]/90 backdrop-blur-md border border-[#2C2C2C] shadow-2xl pointer-events-auto">
            {/* Undo Button */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              title="Undo (Ctrl+Z)"
              className={`p-2 rounded-xl transition-all ${
                historyPast.length > 0
                  ? "text-gray-300 hover:text-white hover:bg-[#222] cursor-pointer active:scale-95"
                  : "text-gray-600 opacity-40 cursor-not-allowed"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>

            {/* Redo Button */}
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyFuture.length === 0}
              title="Redo (Ctrl+Shift+Z)"
              className={`p-2 rounded-xl transition-all ${
                historyFuture.length > 0
                  ? "text-gray-300 hover:text-white hover:bg-[#222] cursor-pointer active:scale-95"
                  : "text-gray-600 opacity-40 cursor-not-allowed"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>

            <div className="h-4 w-px bg-[#2C2C2C]" />

            {/* Pan Toggle Button */}
            <button
              type="button"
              onClick={() => setIsPanMode(!isPanMode)}
              title={isPanMode ? "Exit Pan Mode (edit & reorder sections)" : "Enable Pan Mode (drag canvas anywhere, hold Space)"}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isPanMode
                  ? "bg-[#EDCF5D] text-black shadow-xs font-bold"
                  : "text-gray-400 hover:text-white hover:bg-[#222]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </button>

            <div className="h-4 w-px bg-[#2C2C2C]" />

            {/* Zoom Out */}
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.05).toFixed(2))))}
              title="Zoom Out"
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#222] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>

            {/* Zoom Reset */}
            <button
              type="button"
              onClick={() => {
                setZoom(0.45);
                setPanOffset({ x: 0, y: 0 });
              }}
              title="Reset Zoom to 45%"
              className="px-2.5 py-1 text-xs font-mono font-bold text-gray-300 hover:text-[#EDCF5D] cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.05).toFixed(2))))}
              title="Zoom In"
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#222] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The preview shows the real catalogue, from the database. */
export default function StorefrontManagementPageWithCatalogue() {
  return (
    <CatalogueProvider>
      <StorefrontManagementPage />
    </CatalogueProvider>
  );
}
