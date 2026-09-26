"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminTopStrip } from "../sidebar-context";
import { apiCall } from "../../lib/staff-api";

interface HeroItem {
  id?: string;
  product_id: string;
  sort_order: number;
  is_active: boolean;
  product?: {
    id: string;
    name: string;
    slug: string;
    base_price: number;
    compare_at_price?: number;
    brand?: string;
    images?: Array<{ cloudinary_public_id?: string; is_primary?: boolean }>;
    category?: { name: string };
  };
}

interface SectionConfig {
  id?: string;
  section_key: string;
  title: string;
  is_active: boolean;
  sort_order: number;
  config?: Record<string, any>;
}

interface ProductSearchResult {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  compare_at_price?: number;
  brand?: string;
  primary_image?: { cloudinary_id?: string };
  images?: Array<{ cloudinary_public_id?: string }>;
  category?: { name?: string };
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
}

const SECTION_DESCRIPTIONS: Record<string, string> = {
  hero: "Full-width animated slider showcasing admin-curated flagship products.",
  bestselling: "Dynamically populated with products ranked by all-time total units sold.",
  trending: "Calculated from recent product views, wishlist adds, and search appearances.",
  "new-arrivals": "Latest additions to the catalogue sorted chronologically by release date.",
  "for-you": "Personalized recommendations driven by customer wishlist and search history.",
  "crazy-deals": "Flash deals and bargains ordered by deepest discount percentage.",
  beauty: "Targeted section showcasing health, beauty, hygiene, and skincare essentials.",
  categories: "Interactive grid allowing customers to browse store collections by department.",
  faq: "Frequently asked questions covering delivery, returns, and payment options.",
  footer: "Comprehensive footer with legal links, contact information, and store details.",
};

export default function AdminContentManagerPage() {
  const [activeTab, setActiveTab] = useState<"hero" | "sections">("hero");

  // Hero state
  const [heroItems, setHeroItems] = useState<HeroItem[]>([]);
  const [loadingHero, setLoadingHero] = useState(true);
  const [savingHero, setSavingHero] = useState(false);
  const [heroFeedback, setHeroFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sections state
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [savingSections, setSavingSections] = useState(false);
  const [sectionsFeedback, setSectionsFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Product picker modal state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Format currency in Naira
  const formatNaira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

  // ── Load Hero Products ──
  const loadHero = useCallback(async () => {
    setLoadingHero(true);
    const res = await apiCall<HeroItem[]>("/storefront/hero");
    if (res.ok && Array.isArray(res.data)) {
      setHeroItems(res.data);
    }
    setLoadingHero(false);
  }, []);

  // ── Load Sections ──
  const loadSections = useCallback(async () => {
    setLoadingSections(true);
    const [sectionsRes, catsRes] = await Promise.all([
      apiCall<SectionConfig[]>("/storefront/sections"),
      apiCall<CategoryItem[]>("/categories"),
    ]);

    if (sectionsRes.ok && Array.isArray(sectionsRes.data)) {
      setSections(sectionsRes.data);
    }
    if (catsRes.ok && Array.isArray(catsRes.data)) {
      setCategories(catsRes.data);
    }
    setLoadingSections(false);
  }, []);

  useEffect(() => {
    void loadHero();
    void loadSections();
  }, [loadHero, loadSections]);

  // ── Search products for picker modal ──
  useEffect(() => {
    if (!isPickerOpen) return;
    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      const query = pickerSearch.trim() ? `&search=${encodeURIComponent(pickerSearch.trim())}` : "";
      const res = await apiCall<ProductSearchResult[]>(`/products?limit=20${query}`);
      if (res.ok && Array.isArray(res.data)) {
        setSearchResults(res.data);
      }
      setSearchingProducts(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [pickerSearch, isPickerOpen]);

  // ── Save Hero Lineup ──
  const handleSaveHero = async () => {
    setSavingHero(true);
    setHeroFeedback(null);
    const payload = {
      products: heroItems.map((item, idx) => ({
        product_id: item.product_id,
        sort_order: idx,
        is_active: item.is_active,
      })),
    };

    const res = await apiCall("/storefront/hero", {
      method: "PUT",
      json: payload,
    });

    if (res.ok) {
      setHeroFeedback({ type: "success", text: "Hero carousel lineup updated successfully!" });
      void loadHero();
    } else {
      setHeroFeedback({ type: "error", text: res.message || "Failed to save hero lineup." });
    }
    setSavingHero(false);
  };

  // ── Save Sections ──
  const handleSaveSections = async () => {
    setSavingSections(true);
    setSectionsFeedback(null);
    const payload = {
      sections: sections.map((sec, idx) => ({
        section_key: sec.section_key,
        title: sec.title,
        is_active: sec.is_active,
        sort_order: idx,
        config: sec.config || {},
      })),
    };

    const res = await apiCall("/storefront/sections", {
      method: "PUT",
      json: payload,
    });

    if (res.ok) {
      setSectionsFeedback({ type: "success", text: "Storefront sections updated successfully!" });
      void loadSections();
    } else {
      setSectionsFeedback({ type: "error", text: res.message || "Failed to save sections." });
    }
    setSavingSections(false);
  };

  // ── Hero Helpers ──
  const moveHeroItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= heroItems.length) return;
    const copy = [...heroItems];
    const [moved] = copy.splice(index, 1);
    if (!moved) return;
    copy.splice(targetIndex, 0, moved);
    setHeroItems(copy);
  };

  const removeHeroItem = (index: number) => {
    setHeroItems((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleHeroItemActive = (index: number) => {
    setHeroItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, is_active: !item.is_active } : item))
    );
  };

  const addProductToHero = (product: ProductSearchResult) => {
    if (heroItems.some((h) => h.product_id === product.id)) return;
    const newItem: HeroItem = {
      product_id: product.id,
      sort_order: heroItems.length,
      is_active: true,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        base_price: product.base_price,
        compare_at_price: product.compare_at_price,
        brand: product.brand,
        images: product.images || (product.primary_image?.cloudinary_id ? [{ cloudinary_public_id: product.primary_image.cloudinary_id }] : []),
        category: product.category?.name ? { name: product.category.name } : undefined,
      },
    };
    setHeroItems((prev) => [...prev, newItem]);
    setIsPickerOpen(false);
  };

  // ── Sections Helpers ──
  const moveSection = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    if (!moved) return;
    copy.splice(targetIndex, 0, moved);
    setSections(copy);
  };

  const toggleSectionActive = (index: number) => {
    setSections((prev) =>
      prev.map((sec, i) => (i === index ? { ...sec, is_active: !sec.is_active } : sec))
    );
  };

  const updateSectionCategory = (index: number, categorySlug: string) => {
    setSections((prev) =>
      prev.map((sec, i) =>
        i === index
          ? {
              ...sec,
              config: { ...(sec.config || {}), category_slug: categorySlug },
            }
          : sec
      )
    );
  };

  return (
    <div className="px-4 pt-3.5 pb-8 sm:px-6 lg:px-8 space-y-6 max-w-[1400px] mx-auto font-sans">
      <AdminTopStrip breadcrumbs={[{ label: "Content Manager" }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-[#262626] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Content Manager
          </h1>
          <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5">
            Manage your storefront hero carousel products and control homepage section ordering.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-lg bg-gray-100 dark:bg-[#252525] p-1 border border-gray-200/60 dark:border-[#333]">
          <button
            onClick={() => setActiveTab("hero")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "hero"
                ? "bg-white dark:bg-[#161616] text-gray-900 dark:text-white shadow-2xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Hero Carousel ({heroItems.length})
          </button>
          <button
            onClick={() => setActiveTab("sections")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "sections"
                ? "bg-white dark:bg-[#161616] text-gray-900 dark:text-white shadow-2xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Storefront Sections ({sections.length})
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 1: HERO CAROUSEL                                       */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "hero" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#181818] p-4 rounded-xl border border-gray-200 dark:border-[#262626]">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Hero Slider Lineup</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Flagship products shown at the top of the storefront. Drag or reorder using the arrows.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsPickerOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-[#252525] dark:hover:bg-[#2F2F2F] text-gray-900 dark:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Product
              </button>
              <button
                onClick={handleSaveHero}
                disabled={savingHero}
                className="px-4 py-1.5 rounded-lg bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-[#010101] text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {savingHero ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {heroFeedback && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
                heroFeedback.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              <span>{heroFeedback.text}</span>
              <button onClick={() => setHeroFeedback(null)} className="cursor-pointer ml-3 font-bold">
                ✕
              </button>
            </div>
          )}

          {/* Hero Items List */}
          {loadingHero ? (
            <div className="py-16 text-center text-xs text-gray-400 dark:text-[#666]">
              <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading hero carousel products...
            </div>
          ) : heroItems.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-[#181818] rounded-xl border border-dashed border-gray-200 dark:border-[#2F2F2F] p-8">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#252525] flex items-center justify-center mx-auto mb-3 text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">No hero products selected</h3>
              <p className="text-xs text-gray-500 dark:text-[#9CA3AF] max-w-sm mx-auto mt-1 mb-4">
                The storefront is currently showing default showcase products. Click below to curate custom items for the hero slider.
              </p>
              <button
                onClick={() => setIsPickerOpen(true)}
                className="px-4 py-2 rounded-lg bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-[#010101] text-xs font-bold cursor-pointer"
              >
                + Add Hero Product
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {heroItems.map((item, index) => {
                const prod = item.product;
                const img =
                  prod?.images?.[0]?.cloudinary_public_id ||
                  "/products/hero/air_jordan_retro_1_blue.png";
                return (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between bg-white dark:bg-[#181818] p-3.5 rounded-xl border border-gray-200 dark:border-[#262626] transition-all hover:border-gray-300 dark:hover:border-[#333]"
                  >
                    {/* Left: Position badge, thumbnail, product details */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <span className="w-6 text-center text-xs font-mono font-bold text-gray-400 dark:text-gray-500">
                        #{index + 1}
                      </span>
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-[#252525] border border-gray-200 dark:border-[#333] shrink-0 overflow-hidden flex items-center justify-center p-1">
                        <img
                          src={img}
                          alt={prod?.name || "Product"}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {prod?.name || "Unknown Product"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {prod?.base_price ? formatNaira(prod.base_price) : "—"}
                          </span>
                          {prod?.brand && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400">
                              {prod.brand}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                      {/* Active toggle */}
                      <button
                        onClick={() => toggleHeroItemActive(index)}
                        title={item.is_active ? "Visible on storefront" : "Hidden from storefront"}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          item.is_active
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-gray-100 dark:bg-[#252525] text-gray-400"
                        }`}
                      >
                        {item.is_active ? "Active" : "Hidden"}
                      </button>

                      {/* Reorder buttons */}
                      <button
                        onClick={() => moveHeroItem(index, "up")}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveHeroItem(index, "down")}
                        disabled={index === heroItems.length - 1}
                        title="Move Down"
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      {/* Remove button */}
                      <button
                        onClick={() => removeHeroItem(index)}
                        title="Remove from Hero"
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.61 9m4.615-6.72a.75.75 0 01.738.62L15.24 4.5h4.26a.75.75 0 010 1.5h-.896l-.9 13.504A2.25 2.25 0 0115.457 21H8.543a2.25 2.25 0 01-2.247-2.146L5.396 6H4.5a.75.75 0 010-1.5h4.26l.292-1.62a.75.75 0 01.738-.62h4.46z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 2: STOREFRONT SECTIONS                                 */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "sections" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#181818] p-4 rounded-xl border border-gray-200 dark:border-[#262626]">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Storefront Layout & Sections</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Toggle sections on or off and adjust the display hierarchy on your homepage.
              </p>
            </div>
            <button
              onClick={handleSaveSections}
              disabled={savingSections}
              className="px-4 py-1.5 rounded-lg bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-[#010101] text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {savingSections ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                "Save Section Order"
              )}
            </button>
          </div>

          {/* Feedback message */}
          {sectionsFeedback && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
                sectionsFeedback.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              <span>{sectionsFeedback.text}</span>
              <button onClick={() => setSectionsFeedback(null)} className="cursor-pointer ml-3 font-bold">
                ✕
              </button>
            </div>
          )}

          {/* Sections List */}
          {loadingSections ? (
            <div className="py-16 text-center text-xs text-gray-400 dark:text-[#666]">
              <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading storefront sections...
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((sec, index) => {
                const desc = SECTION_DESCRIPTIONS[sec.section_key] || "Custom storefront component.";
                const isCategoryBound = sec.section_key === "beauty" || sec.config?.category_slug;

                return (
                  <div
                    key={sec.section_key}
                    className={`bg-white dark:bg-[#181818] p-4 rounded-xl border transition-all ${
                      sec.is_active
                        ? "border-gray-200 dark:border-[#262626]"
                        : "border-gray-200/50 dark:border-[#202020] opacity-60 bg-gray-50/50 dark:bg-[#141414]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Position & Section Title */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <span className="w-6 text-center text-xs font-mono font-bold text-gray-400 dark:text-gray-500 pt-0.5 sm:pt-0">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                              {sec.title}
                            </h3>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400">
                              {sec.section_key}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {desc}
                          </p>
                        </div>
                      </div>

                      {/* Right: Category Selector (if category-bound), Toggle & Reorder */}
                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        {isCategoryBound && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                              Feed:
                            </span>
                            <select
                              value={sec.config?.category_slug || "health-beauty"}
                              onChange={(e) => updateSectionCategory(index, e.target.value)}
                              className="text-xs bg-gray-100 dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-md px-2 py-1 text-gray-800 dark:text-gray-200 cursor-pointer"
                            >
                              <option value="health-beauty">Health & Beauty</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.slug}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Visibility Switch */}
                        <button
                          onClick={() => toggleSectionActive(index)}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                            sec.is_active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-gray-200 dark:bg-[#2F2F2F] text-gray-500"
                          }`}
                        >
                          {sec.is_active ? "Enabled" : "Disabled"}
                        </button>

                        {/* Reorder Buttons */}
                        <button
                          onClick={() => moveSection(index, "up")}
                          disabled={index === 0}
                          title="Move Up"
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveSection(index, "down")}
                          disabled={index === sections.length - 1}
                          title="Move Down"
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* PRODUCT PICKER MODAL                                      */}
      {/* ────────────────────────────────────────────────────────── */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsPickerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />
          <div className="relative w-full max-w-xl bg-white dark:bg-[#181818] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] overflow-hidden flex flex-col max-h-[85vh] z-10">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Select Product for Hero Slider</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Pick a product from your catalog to feature in the hero carousel.
                </p>
              </div>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-3 border-b border-gray-100 dark:border-[#262626] bg-gray-50 dark:bg-[#1E1E1E]">
              <div className="relative flex items-center">
                <svg className="w-4 h-4 text-gray-400 absolute left-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search products by title or brand..."
                  className="w-full bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>

            {/* Modal Product List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {searchingProducts ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Searching products...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  No products found matching &ldquo;{pickerSearch}&rdquo;
                </div>
              ) : (
                searchResults.map((p) => {
                  const alreadySelected = heroItems.some((h) => h.product_id === p.id);
                  const img =
                    p.primary_image?.cloudinary_id ||
                    p.images?.[0]?.cloudinary_public_id ||
                    "/products/hero/air_jordan_retro_1_blue.png";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-[#252525] border border-gray-200 dark:border-[#333] shrink-0 overflow-hidden flex items-center justify-center p-0.5">
                          <img src={img} alt={p.name} className="w-full h-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                              {formatNaira(p.base_price)}
                            </span>
                            {p.category?.name && (
                              <span className="text-[10px] text-gray-400">
                                • {p.category.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => addProductToHero(p)}
                        disabled={alreadySelected}
                        className={`text-xs px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          alreadySelected
                            ? "bg-gray-100 dark:bg-[#252525] text-gray-400 cursor-not-allowed"
                            : "bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-[#010101] hover:opacity-90 shadow-2xs"
                        }`}
                      >
                        {alreadySelected ? "Added" : "+ Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-100 dark:border-[#262626] flex justify-end">
              <button
                onClick={() => setIsPickerOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
