"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminTopStrip } from "../sidebar-context";
import ProductFormModal, { ProductFormData } from "./product-form-modal";
import ProductInfoDrawer from "./product-info-drawer";
import { exportProductsToExcel } from "./product-excel-service";
import ProductExcelImportModal from "./product-excel-import-modal";

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  brand?: string;
  base_price: number;
  compare_at_price?: number;
  cost_price?: number;
  profit_kobo?: number;
  margin_pct?: number;
  status: "active" | "draft" | "archived";
  total_sold: number;
  in_stock: boolean;
  has_low_stock: boolean;
  total_quantity?: number;
  is_featured?: boolean;
  primary_image?: { cloudinary_id: string; alt?: string };
  category?: { id?: string; name: string; slug: string };
  tags?: string[];
  variants?: Array<{
    id: string;
    size: string;
    color: string;
    color_hex?: string;
    sku?: string;
    available: number;
    quantity?: number;
  }>;
  short_description?: string;
  description?: string;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [featuredOnly, setFeaturedOnly] = useState<boolean>(false);
  const [showFilterPopover, setShowFilterPopover] = useState<boolean>(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<ProductFormData> | null>(null);

  const [scrolled, setScrolled] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  
  // Action Menu & Modal States
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [infoProductItem, setInfoProductItem] = useState<ProductItem | null>(null);
  const [deletingProductItem, setDeletingProductItem] = useState<ProductItem | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(3);

  // Drafts & Outage Recovery State
  const [recoveredDraftCount, setRecoveredDraftCount] = useState<number>(0);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState<boolean>(false);
  const [localDraftInfo, setLocalDraftInfo] = useState<any>(null);
  const [cloudDrafts, setCloudDrafts] = useState<any[]>([]);

  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, productId: string) => {
    e.stopPropagation();
    if (openActionMenuId === productId) {
      setOpenActionMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 160;
      const opensUpward = rect.bottom + menuHeight > window.innerHeight;

      setMenuPosition({
        top: opensUpward ? Math.max(10, rect.top - menuHeight) : rect.bottom + 4,
        left: Math.max(10, rect.right - 144),
      });
      setOpenActionMenuId(productId);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (deletingProductItem && deleteCountdown > 0) {
      timer = setInterval(() => {
        setDeleteCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [deletingProductItem, deleteCountdown]);

  // Click outside to close filter popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setShowFilterPopover(false);
      }
    };
    if (showFilterPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilterPopover]);

  // Scroll listener for sticky header
  useEffect(() => {
    const mainEl = document.querySelector("main");
    const handleScroll = () => {
      const scrollY = mainEl ? mainEl.scrollTop : window.scrollY;
      setScrolled(scrollY > 10);
    };

    if (mainEl) {
      mainEl.addEventListener("scroll", handleScroll, { passive: true });
    }
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Reset to page 1 whenever filters or search terms change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, brandFilter, stockFilter, statusFilter, minPrice, maxPrice, sortBy, featuredOnly]);

  const handleSelectAll = () => {
    const pageProductIds = paginatedProducts.map((p) => p.id);
    const allPageSelected = pageProductIds.length > 0 && pageProductIds.every((id) => selectedProducts.includes(id));
    if (allPageSelected) {
      setSelectedProducts((prev) => prev.filter((id) => !pageProductIds.includes(id)));
    } else {
      setSelectedProducts((prev) => Array.from(new Set([...prev, ...pageProductIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const fetchDrafts = async () => {
    try {
      const token = localStorage.getItem("gts_token");
      const res = await fetch("http://localhost:3000/api/v1/products/drafts", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setCloudDrafts(json.data || []);
      }
    } catch {}
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const token = localStorage.getItem("gts_token");
      await fetch(`http://localhost:3000/api/v1/products/drafts?id=${draftId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setCloudDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchDrafts();

    try {
      const raw = localStorage.getItem("gts_product_create_draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.name || parsed.brand || parsed.basePriceNaira || (parsed.variants && parsed.variants.length > 0))) {
          setLocalDraftInfo(parsed);
          setRecoveredDraftCount(1);
        }
      }
    } catch {
      // ignore
    }

    const now = new Date();
    setLastUpdated(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }));

    const mainEl = document.querySelector("main");
    if (mainEl) {
      const handleScroll = () => {
        setScrolled(mainEl.scrollTop > 5);
      };
      mainEl.addEventListener("scroll", handleScroll);
      return () => mainEl.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/v1/products?include_all_status=true&limit=100");
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: ProductItem) => {
    const formData: Partial<ProductFormData> = {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku || "",
      brand: "GTS",
      category_name: p.category?.name || "Fashion",
      base_price_naira: (p.base_price / 100).toString(),
      compare_at_naira: p.compare_at_price ? (p.compare_at_price / 100).toString() : "",
      cost_price_naira: p.cost_price ? (p.cost_price / 100).toString() : "",
      status: p.status,
      image_url: p.primary_image?.cloudinary_id || "/products/denim_jacket.png",
      short_description: p.short_description || "",
      description: p.description || "",
      tags: (p.tags || []).join(", "),
      variants: (p.variants || []).map((v) => ({
        size: v.size || "M",
        color: v.color || "Black",
        color_hex: v.color_hex || "#111827",
        sku: v.sku || "",
        quantity: v.quantity || v.available || 10,
      })),
    };
    setEditingProduct(formData);
    setIsModalOpen(true);
  };

  const handleSetProductStatus = async (p: ProductItem, targetStatus: "active" | "draft" | "archived") => {
    // Optimistic local state update (instant UI change, no list flash)
    setProducts((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, status: targetStatus } : item))
    );
    setOpenActionMenuId(null);

    try {
      const token = localStorage.getItem("gts_token");
      await fetch("http://localhost:3000/api/v1/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: p.id, status: targetStatus }),
      });
    } catch (err) {
      console.error("Status update error:", err);
      // Rollback on error
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, status: p.status } : item))
      );
    }
  };

  const handleBulkArchive = async () => {
    if (selectedProducts.length === 0) return;
    const idsToArchive = [...selectedProducts];
    setProducts((prev) =>
      prev.map((p) => (idsToArchive.includes(p.id) ? { ...p, status: "archived" as const } : p))
    );
    setSelectedProducts([]);

    try {
      const token = localStorage.getItem("gts_token");
      await Promise.all(
        idsToArchive.map((id) =>
          fetch("http://localhost:3000/api/v1/products", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id, status: "archived" }),
          })
        )
      );
    } catch (err) {
      console.error("Bulk archive error:", err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return;
    const idsToDelete = [...selectedProducts];
    setProducts((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
    setSelectedProducts([]);

    try {
      const token = localStorage.getItem("gts_token");
      await Promise.all(
        idsToDelete.map((id) =>
          fetch(`http://localhost:3000/api/v1/products?id=${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  };

  const handleBulkExport = () => {
    if (selectedProducts.length === 0) return;
    const selectedData = products.filter((p) => selectedProducts.includes(p.id));
    exportProductsToExcel(
      selectedData,
      `gts-products-selected-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleOpenInfoModal = (p: ProductItem) => {
    setInfoProductItem(p);
    setOpenActionMenuId(null);
  };

  const handleOpenDeleteDialog = (p: ProductItem) => {
    setDeletingProductItem(p);
    setDeleteCountdown(3);
    setOpenActionMenuId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProductItem) return;
    const id = deletingProductItem.id;
    try {
      const token = localStorage.getItem("gts_token");
      await fetch(`http://localhost:3000/api/v1/products?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // offline fallback
    }
    setProducts((prev) => prev.filter((item) => item.id !== id));
    setDeletingProductItem(null);
  };

  const formatNaira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

  // Dynamic available categories and brands for filter menu
  const availableCategories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean))) as string[];
  }, [products]);

  const availableBrands = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[];
  }, [products]);

  const activeFiltersCount =
    (categoryFilter !== "ALL" ? 1 : 0) +
    (brandFilter !== "ALL" ? 1 : 0) +
    (stockFilter !== "ALL" ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (featuredOnly ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  const handleResetFilters = () => {
    setCategoryFilter("ALL");
    setBrandFilter("ALL");
    setStockFilter("ALL");
    setStatusFilter("ALL");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
    setFeaturedOnly(false);
    setSearchQuery("");
  };

  // Filtering & Sorting Logic
  const filteredProducts = products
    .filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        categoryFilter === "ALL" ||
        (p.category?.name && p.category.name.toLowerCase() === categoryFilter.toLowerCase());

      const matchesBrand =
        brandFilter === "ALL" ||
        (p.brand && p.brand.toLowerCase() === brandFilter.toLowerCase());

      const matchesStock =
        stockFilter === "ALL" ||
        (stockFilter === "IN_STOCK" && p.in_stock && !p.has_low_stock) ||
        (stockFilter === "LOW_STOCK" && p.has_low_stock) ||
        (stockFilter === "OUT_OF_STOCK" && !p.in_stock);

      const matchesStatus =
        statusFilter === "ALL"
          ? p.status !== "draft"
          : p.status === statusFilter;

      const productNairaPrice = p.base_price > 100000 ? p.base_price / 100 : p.base_price;
      const matchesMinPrice = !minPrice || productNairaPrice >= Number(minPrice);
      const matchesMaxPrice = !maxPrice || productNairaPrice <= Number(maxPrice);

      const matchesFeatured = !featuredOnly || Boolean(p.is_featured);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBrand &&
        matchesStock &&
        matchesStatus &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesFeatured
      );
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.base_price - b.base_price;
      if (sortBy === "price_desc") return b.base_price - a.base_price;
      if (sortBy === "bestselling") return (b.total_sold || 0) - (a.total_sold || 0);
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      return 0; // default "newest"
    });

  // Pagination Calculations
  const totalEntries = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalEntries === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(validCurrentPage * pageSize, totalEntries);
  const displayedCount = totalEntries === 0 ? 0 : endIndex - startIndex + 1;
  const paginatedProducts = filteredProducts.slice((validCurrentPage - 1) * pageSize, validCurrentPage * pageSize);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (validCurrentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, "...", totalPages];
  };

  // KPI Calculations (Exclude drafts from catalog count unless viewing drafts)
  const totalProductsCount =
    statusFilter === "draft"
      ? products.filter((p) => p.status === "draft").length
      : products.filter((p) => p.status !== "draft").length;
  const inStockCount = products.filter((p) => p.status !== "draft" && p.in_stock).length;
  const lowStockCount = products.filter((p) => p.status !== "draft" && p.has_low_stock).length;
  const outOfStockCount = products.filter((p) => p.status !== "draft" && !p.in_stock).length;
  const avgMargin =
    products.filter((p) => p.margin_pct !== null && p.margin_pct !== undefined).length > 0
      ? Math.round(
          products
            .filter((p) => p.margin_pct !== null && p.margin_pct !== undefined)
            .reduce((acc, p) => acc + (p.margin_pct || 0), 0) /
            products.filter((p) => p.margin_pct !== null && p.margin_pct !== undefined).length
        )
      : 58;

  // Calculate total orders
  const totalOrdersCount = products.length > 0
    ? products.reduce((acc, p) => acc + (p.total_sold || 0), 0) || 142
    : 142;

  // Calculate total inventory revenue value in Naira
  const totalRevenueNaira = products.length > 0
    ? Math.round(products.reduce((acc, p) => acc + (p.base_price > 100000 ? p.base_price / 100 : p.base_price || 0), 0))
    : 84320;
  const formattedRevenue = "₦" + (totalRevenueNaira > 0 ? totalRevenueNaira.toLocaleString("en-NG") : "84,320");

  return (
    <div className="px-4 pt-3.5 pb-6 lg:px-5 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto font-sans transition-colors duration-200">
      {/* ────── STICKY TOP PAGE HEADER (METADATA + TITLE ROW COMBINED) ────── */}
      <div
        className={`sticky top-0 z-40 -mx-4 -mt-3.5 px-4 pt-3.5 pb-2.5 lg:-mx-5 lg:-mt-3.5 lg:px-5 space-y-3 bg-[#F8F7F4]/95 dark:bg-[#1C1C1C]/95 backdrop-blur-md transition-all duration-200 ${
          scrolled
            ? "border-b border-gray-200 dark:border-[#262626] shadow-2xs"
            : "border-b border-transparent"
        }`}
      >
        {/* Top Metadata Strip */}
        <AdminTopStrip
          breadcrumbs={[
            { label: "Product", href: "/admin/products" },
            { label: "Overview" },
          ]}
        />

        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Products List
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5 font-mono">
              Manage product items, base prices, cost prices, and stock inventory
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Drafts Recovery Button with Text & Badge */}
            <button
              type="button"
              onClick={() => {
                fetchDrafts();
                setShowDraftsDrawer(true);
              }}
              className="relative px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title={cloudDrafts.length > 0 ? `View ${cloudDrafts.length} Cloud Drafts` : "No drafts available"}
            >
              {/* Draft Icon */}
              <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span>Drafts</span>

              {/* Badge if Cloud Drafts Exist */}
              {cloudDrafts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#EDCF5D] text-black text-[10px] font-black leading-none ml-0.5">
                  {cloudDrafts.length}
                </span>
              )}
            </button>

            {/* Import Button (Excel .xlsx) */}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title="Import Products via Excel (.xlsx)"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Import</span>
            </button>

            {/* Export Button (Excel .xlsx) */}
            <button
              type="button"
              onClick={() =>
                exportProductsToExcel(
                  filteredProducts,
                  `gts-products-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`
                )
              }
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title={`Export ${filteredProducts.length} Products to Excel (.xlsx)`}
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6" />
              </svg>
              <span>Export</span>
            </button>

            {/* Add Product Button (Primary GTS Gold #EDCF5D) */}
            <Link
              href="/admin/products/new"
              className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] text-[#010101] hover:bg-white dark:bg-[#EDCF5D] dark:text-[#121316] dark:hover:bg-white text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Add Product</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Catalog Items */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStockFilter("ALL");
            setCurrentPage(1);
          }}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Catalog Items
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {totalProductsCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              5 Active Categories
            </div>
          )}

          {/* 3D Isometric Stacked Crates / Inventory Watermark */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <style>{`
                  .wm-crate-top-s1 { stop-color: #E5E7EB; }
                  .wm-crate-top-s2 { stop-color: #D1D5DB; }
                  .wm-crate-left-s1 { stop-color: #9CA3AF; }
                  .wm-crate-left-s2 { stop-color: #6B7280; }
                  .wm-crate-right-s1 { stop-color: #6B7280; }
                  .wm-crate-right-s2 { stop-color: #4B5563; }
                  .wm-crate-stroke { stroke: rgba(0, 0, 0, 0.16); }
                  .wm-crate-line { stroke: rgba(51, 65, 85, 0.5); }
                  .dark .wm-crate-top-s1 { stop-color: #3A3A3A; }
                  .dark .wm-crate-top-s2 { stop-color: #2D2D2D; }
                  .dark .wm-crate-left-s1 { stop-color: #242424; }
                  .dark .wm-crate-left-s2 { stop-color: #1A1A1A; }
                  .dark .wm-crate-right-s1 { stop-color: #1A1A1A; }
                  .dark .wm-crate-right-s2 { stop-color: #121212; }
                  .dark .wm-crate-stroke { stroke: rgba(255, 255, 255, 0.18); }
                  .dark .wm-crate-line { stroke: rgba(255, 255, 255, 0.4); }
                `}</style>
                <linearGradient id="crateFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>

                <mask id="fadeTopLeftCrate">
                  <rect x="0" y="0" width="130" height="100" fill="url(#crateFadeMask)" />
                </mask>

                <linearGradient id="crateTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="wm-crate-top-s1" />
                  <stop offset="100%" className="wm-crate-top-s2" />
                </linearGradient>
                <linearGradient id="crateLeftGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" className="wm-crate-left-s1" />
                  <stop offset="100%" className="wm-crate-left-s2" />
                </linearGradient>
                <linearGradient id="crateRightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" className="wm-crate-right-s1" />
                  <stop offset="100%" className="wm-crate-right-s2" />
                </linearGradient>
              </defs>

              <g mask="url(#fadeTopLeftCrate)">
                {/* 3D Box 2 (Back Right Stacked) */}
                <g transform="translate(25, -12)">
                  <polygon points="45,28 75,15 105,28 75,41" fill="url(#crateTopGrad)" className="wm-crate-stroke" strokeWidth="1.2" />
                  <polygon points="45,28 75,41 75,72 45,59" fill="url(#crateLeftGrad)" className="wm-crate-stroke" strokeWidth="1.2" />
                  <polygon points="75,41 105,28 105,59 75,72" fill="url(#crateRightGrad)" className="wm-crate-stroke" strokeWidth="1.2" />
                </g>

                {/* 3D Box 1 (Front Main Isometric Crate) */}
                <g transform="translate(0, 4)">
                  {/* Top Face */}
                  <polygon points="20,38 56,22 92,38 56,54" fill="url(#crateTopGrad)" className="wm-crate-stroke" strokeWidth="1.6" />
                  {/* Top Tape Seam */}
                  <line x1="38" y1="30" x2="74" y2="46" className="wm-crate-line" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Left Face */}
                  <polygon points="20,38 56,54 56,92 20,76" fill="url(#crateLeftGrad)" className="wm-crate-stroke" strokeWidth="1.6" />
                  {/* Left Cross Ribs */}
                  <line x1="20" y1="57" x2="56" y2="73" className="wm-crate-line" strokeWidth="1.5" />
                  <line x1="38" y1="46" x2="38" y2="84" className="wm-crate-line" strokeWidth="1.5" />

                  {/* Right Face */}
                  <polygon points="56,54 92,38 92,76 56,92" fill="url(#crateRightGrad)" className="wm-crate-stroke" strokeWidth="1.6" />
                  {/* Right Cross Ribs */}
                  <line x1="56" y1="73" x2="92" y2="57" className="wm-crate-line" strokeWidth="1.5" />
                  <line x1="74" y1="46" x2="74" y2="84" className="wm-crate-line" strokeWidth="1.5" />
                  {/* Shipping Label Tag sticker on right face */}
                  <polygon points="64,54 82,46 82,58 64,66" fill="url(#crateTopGrad)" opacity="0.8" className="wm-crate-stroke" strokeWidth="1" />
                </g>
              </g>
            </svg>
          </div>
        </div>

        {/* Card 2: Total Revenue Value */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStockFilter("ALL");
            setCurrentPage(1);
          }}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Total Revenue Value
            </span>
            {loading ? (
              <div className="h-8 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans truncate">
                {formattedRevenue}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              +12.5% vs last month
            </div>
          )}

          {/* Stacked Cash Banknotes Watermark */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <style>{`
                  .wm-cash-g1-s1 { stop-color: #D1D5DB; }
                  .wm-cash-g1-s2 { stop-color: #9CA3AF; }
                  .wm-cash-g2-s1 { stop-color: #CBD5E1; }
                  .wm-cash-g2-s2 { stop-color: #64748B; }
                  .wm-cash-g3-s1 { stop-color: #94A3B8; }
                  .wm-cash-g3-s2 { stop-color: #475569; }
                  .wm-cash-stroke1 { stroke: rgba(0, 0, 0, 0.12); }
                  .wm-cash-stroke2 { stroke: rgba(0, 0, 0, 0.16); }
                  .wm-cash-naira { fill: #334155; }
                  .wm-cash-line { stroke: rgba(51, 65, 85, 0.6); }
                  .dark .wm-cash-g1-s1 { stop-color: #303030; }
                  .dark .wm-cash-g1-s2 { stop-color: #1B1B1B; }
                  .dark .wm-cash-g2-s1 { stop-color: #252525; }
                  .dark .wm-cash-g2-s2 { stop-color: #161616; }
                  .dark .wm-cash-g3-s1 { stop-color: #1C1C1C; }
                  .dark .wm-cash-g3-s2 { stop-color: #121212; }
                  .dark .wm-cash-stroke1 { stroke: rgba(255, 255, 255, 0.14); }
                  .dark .wm-cash-stroke2 { stroke: rgba(255, 255, 255, 0.18); }
                  .dark .wm-cash-naira { fill: #FFFFFF; }
                  .dark .wm-cash-line { stroke: rgba(255, 255, 255, 0.6); }
                `}</style>
                <linearGradient id="cashFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>

                <mask id="fadeTopLeftCash">
                  <rect x="0" y="0" width="130" height="100" fill="url(#cashFadeMask)" />
                </mask>

                <linearGradient id="cashNoteGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="wm-cash-g1-s1" />
                  <stop offset="100%" className="wm-cash-g1-s2" />
                </linearGradient>
                <linearGradient id="cashNoteGradMid" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="wm-cash-g2-s1" />
                  <stop offset="100%" className="wm-cash-g2-s2" />
                </linearGradient>
                <linearGradient id="cashNoteGradBack" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="wm-cash-g3-s1" stopOpacity="0.8" />
                  <stop offset="100%" className="wm-cash-g3-s2" stopOpacity="0.5" />
                </linearGradient>
              </defs>

              <g mask="url(#fadeTopLeftCash)">
                {/* Note 3 (Back Right) */}
                <g transform="rotate(12 90 68)">
                  <rect x="42" y="26" width="74" height="42" rx="6" fill="url(#cashNoteGradBack)" className="wm-cash-stroke1" strokeWidth="1.2" />
                  <circle cx="79" cy="47" r="7" className="wm-cash-stroke1" strokeWidth="1.2" />
                </g>

                {/* Note 2 (Middle) */}
                <g transform="rotate(-2 70 58)">
                  <rect x="30" y="24" width="74" height="42" rx="6" fill="url(#cashNoteGradMid)" className="wm-cash-stroke1" strokeWidth="1.4" />
                  <rect x="36" y="30" width="62" height="30" rx="4" className="wm-cash-stroke1" strokeWidth="1.2" />
                  <circle cx="67" cy="45" r="8" className="wm-cash-stroke2" strokeWidth="1.4" />
                </g>

                {/* Note 1 (Front Left - Naira Seal & Lines) */}
                <g transform="rotate(-15 48 54)">
                  <rect x="14" y="22" width="74" height="42" rx="6" fill="url(#cashNoteGradFront)" className="wm-cash-stroke2" strokeWidth="1.6" />
                  <rect x="20" y="28" width="62" height="30" rx="4" className="wm-cash-stroke2" strokeWidth="1.4" />
                  <circle cx="51" cy="43" r="8.5" className="wm-cash-stroke2" strokeWidth="1.6" />
                  <text x="51" y="46" textAnchor="middle" className="wm-cash-naira" fontSize="10" fontWeight="bold" fontFamily="sans-serif">₦</text>
                  <line x1="24" y1="32" x2="32" y2="32" className="wm-cash-line" strokeWidth="2" strokeLinecap="round" />
                  <line x1="70" y1="54" x2="78" y2="54" className="wm-cash-line" strokeWidth="2" strokeLinecap="round" />
                </g>
              </g>
            </svg>
          </div>
        </div>

        {/* Card 3: Low Stock Warnings */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStockFilter((prev) => (prev === "LOW_STOCK" ? "ALL" : "LOW_STOCK"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            stockFilter === "LOW_STOCK"
              ? "border-amber-500/80 ring-2 ring-amber-500/40 dark:border-amber-400 dark:ring-amber-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-amber-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Low Stock Warnings
              </span>
              {stockFilter === "LOW_STOCK" && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-14 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {lowStockCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-36 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
              {lowStockCount > 0 ? "Needs restock batch soon" : "All items well stocked"}
            </div>
          )}

          {/* 3D Isometric Depleted Pallet with Amber Low-Stock Gauge Watermark */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <linearGradient id="lowStockFadeMaskProd" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>
                <mask id="fadeLowStockMaskProd">
                  <rect x="0" y="0" width="130" height="100" fill="url(#lowStockFadeMaskProd)" />
                </mask>
              </defs>

              <g mask="url(#fadeLowStockMaskProd)" transform="translate(10, 8)">
                {/* Wooden Pallet Base */}
                <polygon points="20,58 56,42 92,58 56,74" fill="url(#crateTopGrad)" className="wm-crate-stroke" strokeWidth="1.2" />
                <polygon points="20,58 56,74 56,80 20,64" fill="url(#crateLeftGrad)" className="wm-crate-stroke" strokeWidth="1.2" />
                <polygon points="56,74 92,58 92,64 56,80" fill="url(#crateRightGrad)" className="wm-crate-stroke" strokeWidth="1.2" />
                <line x1="32" y1="52" x2="68" y2="68" className="wm-crate-line" strokeWidth="1.2" />
                <line x1="44" y1="47" x2="80" y2="63" className="wm-crate-line" strokeWidth="1.2" />

                {/* Single Remaining Low-Stock Crate Sitting on Pallet */}
                <g transform="translate(0, -14)">
                  <polygon points="32,46 56,36 80,46 56,56" fill="url(#crateTopGrad)" className="wm-crate-stroke" strokeWidth="1.4" />
                  <polygon points="32,46 56,56 56,72 32,62" fill="url(#crateLeftGrad)" className="wm-crate-stroke" strokeWidth="1.4" />
                  <polygon points="56,56 80,46 80,62 56,72" fill="url(#crateRightGrad)" className="wm-crate-stroke" strokeWidth="1.4" />
                  <line x1="44" y1="41" x2="68" y2="51" className="wm-crate-line" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* Ghost Outline of Missing Depleted Crates (Dashed Low Stock Indicator) */}
                <g transform="translate(0, -38)">
                  <polygon points="32,46 56,36 80,46 56,56" fill="none" stroke="rgba(245, 158, 11, 0.45)" strokeWidth="1.2" strokeDasharray="3 3" />
                  <polygon points="32,46 56,56 56,70 32,60" fill="none" stroke="rgba(245, 158, 11, 0.35)" strokeWidth="1.2" strokeDasharray="3 3" />
                  <polygon points="56,56 80,46 80,60 56,70" fill="none" stroke="rgba(245, 158, 11, 0.35)" strokeWidth="1.2" strokeDasharray="3 3" />
                  {/* Amber Alert Threshold Mark */}
                  <line x1="26" y1="62" x2="86" y2="62" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" opacity="0.85" />
                </g>
              </g>
            </svg>
          </div>
        </div>

        {/* Card 4: Out of Stock / Critical */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStockFilter((prev) => (prev === "OUT_OF_STOCK" ? "ALL" : "OUT_OF_STOCK"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            stockFilter === "OUT_OF_STOCK"
              ? "border-rose-500/80 ring-2 ring-rose-500/40 dark:border-rose-400 dark:ring-rose-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-rose-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Out of Stock (Critical)
              </span>
              {stockFilter === "OUT_OF_STOCK" && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {outOfStockCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-rose-500 dark:text-rose-400">
              {outOfStockCount > 0 ? "Requires urgent replenishment" : "0 stockouts recorded"}
            </div>
          )}

          {/* 3D Isometric Empty Pallet with Zero Units Perimeter Watermark */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <linearGradient id="outOfStockFadeMaskProd" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>
                <mask id="fadeOutOfStockMaskProd">
                  <rect x="0" y="0" width="130" height="100" fill="url(#outOfStockFadeMaskProd)" />
                </mask>
              </defs>

              <g mask="url(#fadeOutOfStockMaskProd)" transform="translate(10, 8)">
                {/* Empty Wooden Warehouse Pallet */}
                <polygon points="20,54 56,38 92,54 56,70" fill="url(#crateTopGrad)" className="wm-crate-stroke" strokeWidth="1.4" />
                <polygon points="20,54 56,70 56,78 20,62" fill="url(#crateLeftGrad)" className="wm-crate-stroke" strokeWidth="1.4" />
                <polygon points="56,70 92,54 92,62 56,78" fill="url(#crateRightGrad)" className="wm-crate-stroke" strokeWidth="1.4" />
                
                {/* Pallet Top Deck Slats (Empty Deck) */}
                <line x1="28" y1="50" x2="64" y2="66" className="wm-crate-line" strokeWidth="1.4" />
                <line x1="38" y1="46" x2="74" y2="62" className="wm-crate-line" strokeWidth="1.4" />
                <line x1="48" y1="41" x2="84" y2="57" className="wm-crate-line" strokeWidth="1.4" />

                {/* Completely Empty Ghost Crate Perimeter (0 Stock) */}
                <g transform="translate(0, -22)">
                  <polygon points="28,44 56,32 84,44 56,56" fill="none" stroke="rgba(244, 63, 94, 0.45)" strokeWidth="1.4" strokeDasharray="4 3" />
                  <polygon points="28,44 56,56 56,74 28,62" fill="none" stroke="rgba(244, 63, 94, 0.35)" strokeWidth="1.4" strokeDasharray="4 3" />
                  <polygon points="56,56 84,44 84,62 56,74" fill="none" stroke="rgba(244, 63, 94, 0.35)" strokeWidth="1.4" strokeDasharray="4 3" />
                  
                  {/* Empty Perimeter Diagonal Cross */}
                  <line x1="28" y1="44" x2="84" y2="44" stroke="rgba(244, 63, 94, 0.6)" strokeWidth="1.2" strokeDasharray="2 2" />
                  <line x1="56" y1="32" x2="56" y2="56" stroke="rgba(244, 63, 94, 0.6)" strokeWidth="1.2" strokeDasharray="2 2" />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* ────── UNIFIED CATALOG TOOLBAR & TABLE CONTAINER ────── */}
      <div className="bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs transition-colors">
        {/* Top Toolbar Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-t-[16px] border-b border-gray-200/80 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Actions: Filter Pill + All Status Dropdown */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Filter Button with Active Count and Popover */}
            <div className="relative" ref={filterPopoverRef}>
              <button
                type="button"
                onClick={() => setShowFilterPopover((prev) => !prev)}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-2xs transition-all cursor-pointer ${
                  activeFiltersCount > 0
                    ? "bg-[#EDCF5D]/15 text-[#9E7B00] dark:text-[#EDCF5D] border-[#EDCF5D]/40 font-bold"
                    : "bg-white dark:bg-[#222222] border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B]"
                }`}
              >
                <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9m-9 6h9m-9 6h9M3.75 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0m0 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0m0 6H6m0 0a1.5 1.5 0 003 0m-3 0a1.5 1.5 0 01-3 0" />
                </svg>
                <span>Filter</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black text-[10px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Filter Popover Panel */}
              {showFilterPopover && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 max-h-[min(520px,80vh)] overflow-y-auto bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs [scrollbar-width:thin]">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#2A2A2A]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">
                        Filter Catalog
                      </span>
                      {activeFiltersCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#EDCF5D]/20 text-[#9E7B00] dark:text-[#EDCF5D] text-[10.5px] font-bold">
                          {activeFiltersCount} active
                        </span>
                      )}
                    </div>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  {availableCategories.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Category
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto [scrollbar-width:thin]">
                        <button
                          type="button"
                          onClick={() => setCategoryFilter("ALL")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            categoryFilter === "ALL"
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          All
                        </button>
                        {availableCategories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategoryFilter(categoryFilter.toLowerCase() === cat.toLowerCase() ? "ALL" : cat)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              categoryFilter.toLowerCase() === cat.toLowerCase()
                                ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                                : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brand Pills */}
                  {availableBrands.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Brand
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto [scrollbar-width:thin]">
                        <button
                          type="button"
                          onClick={() => setBrandFilter("ALL")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            brandFilter === "ALL"
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          All Brands
                        </button>
                        {availableBrands.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setBrandFilter(brandFilter.toLowerCase() === b.toLowerCase() ? "ALL" : b)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              brandFilter.toLowerCase() === b.toLowerCase()
                                ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs"
                                : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                            }`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price Range (₦) */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Price Range (₦)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Min (₦)"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#303030] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                      />
                      <input
                        type="number"
                        placeholder="Max (₦)"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#303030] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                      />
                    </div>
                  </div>

                  {/* Sort By */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#303030] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D] cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="bestselling">Best Selling</option>
                      <option value="name_asc">Product Name (A–Z)</option>
                    </select>
                  </div>

                  {/* Featured Only Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={featuredOnly}
                      onChange={(e) => setFeaturedOnly(e.target.checked)}
                      className="rounded border-gray-300 dark:border-[#444444] text-[#EDCF5D] focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      ★ Featured Products Only
                    </span>
                  </label>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-gray-100 dark:border-[#2A2A2A] flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {filteredProducts.length} results matching
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFilterPopover(false)}
                      className="px-4 py-1.5 rounded-lg bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black text-xs font-bold shadow-2xs hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status Select Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Stock Select Filter (All Stock, In Stock, Low Stock, Out of Stock) */}
            <div className="relative">
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="ALL">All Stock</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
              <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Bulk Selection Action Icon Buttons (Appears when checkboxes are selected) */}
            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-2 pl-2.5 border-l border-gray-200 dark:border-[#333333] transition-all">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 mr-0.5">
                  {selectedProducts.length} Selected
                </span>

                {/* Archive Icon Button */}
                <div className="relative group">
                  <button
                    onClick={handleBulkArchive}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  </button>
                  {/* Tooltip Bubble (Positioned below button to prevent overflow clipping) */}
                  <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 hidden group-hover:flex items-center justify-center px-2.5 py-1 bg-[#1A1A1A] dark:bg-[#2E2E2E] text-white text-[10.5px] font-semibold rounded-md shadow-lg border border-gray-700 dark:border-gray-600 whitespace-nowrap z-50 pointer-events-none">
                    Archive Selected
                  </div>
                </div>

                {/* Export Icon Button */}
                <div className="relative group">
                  <button
                    onClick={handleBulkExport}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>
                  {/* Tooltip Bubble */}
                  <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 hidden group-hover:flex items-center justify-center px-2.5 py-1 bg-[#1A1A1A] dark:bg-[#2E2E2E] text-white text-[10.5px] font-semibold rounded-md shadow-lg border border-gray-700 dark:border-gray-600 whitespace-nowrap z-50 pointer-events-none">
                    Export Selected
                  </div>
                </div>

                {/* Delete Icon Button */}
                <div className="relative group">
                  <button
                    onClick={handleBulkDelete}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.61 9m4.615-6.72a.75.75 0 01.738.62L15.24 4.5h4.26a.75.75 0 010 1.5h-.896l-.9 13.504A2.25 2.25 0 0115.457 21H8.543a2.25 2.25 0 01-2.247-2.146L5.396 6H4.5a.75.75 0 010-1.5h4.26l.292-1.62a.75.75 0 01.738-.62h4.46z" />
                    </svg>
                  </button>
                  {/* Tooltip Bubble */}
                  <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 hidden group-hover:flex items-center justify-center px-2.5 py-1 bg-[#1A1A1A] dark:bg-[#2E2E2E] text-white text-[10.5px] font-semibold rounded-md shadow-lg border border-gray-700 dark:border-gray-600 whitespace-nowrap z-50 pointer-events-none">
                    Delete Selected
                  </div>
                </div>

                {/* Clear Selection Button */}
                <button
                  onClick={() => setSelectedProducts([])}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#2B2B2B] shadow-2xs transition-all cursor-pointer flex items-center justify-center text-xs font-bold"
                  title="Clear Selection"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Right Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search...."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D] shadow-2xs"
            />
            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-[#222222] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/50 dark:bg-[#141414]/50 text-gray-400 dark:text-[#8E8E8E] font-medium text-xs">
                  <th className="pl-4 pr-2 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={paginatedProducts.length > 0 && paginatedProducts.every((p) => selectedProducts.includes(p.id))}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-[#444444] text-[#EDCF5D] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Date Updated</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Warehouse</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 dark:text-gray-400">Total Sales</th>
                  <th className="pr-4 pl-2 py-3 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#242424]">
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400 dark:text-[#666666] font-mono">
                      No products match your search/filter criteria
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p, idx) => {
                    const primaryImgUrl = p.primary_image?.cloudinary_id || "/products/denim_jacket.png";
                    const isSelected = selectedProducts.includes(p.id);

                    // Formatted updated time string & stock status calculation
                    const updatedTimeStr = idx % 2 === 0 ? "Today at 1:23pm" : idx % 3 === 0 ? "Today at 3:50pm" : "Yesterday at 4:15pm";
                    const stockQty = p.total_quantity !== undefined ? p.total_quantity : p.in_stock ? (idx % 2 === 0 ? 4 : 12) : 0;
                    const warehouseStockStr = stockQty === 0 ? "Out of Stock" : stockQty <= 5 ? `${stockQty} Low Stock` : `${stockQty} in Stock`;
                    const stockColorClass = stockQty === 0 ? "text-red-600 dark:text-red-400 font-semibold" : stockQty <= 5 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-gray-600 dark:text-gray-300 font-medium";

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-gray-50/80 dark:hover:bg-[#222222]/60 transition-colors ${
                          isSelected ? "bg-amber-500/5 dark:bg-[#EDCF5D]/5" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="pl-4 pr-2 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(p.id)}
                            className="rounded border-gray-300 dark:border-[#444444] text-[#EDCF5D] focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Name (Clickable Circular Avatar + Product Title) */}
                        <td className="px-3 py-3">
                          <div
                            onClick={() => handleOpenInfoModal(p)}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs group-hover:scale-105 transition-transform">
                              <img
                                src={primaryImgUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="font-semibold text-gray-900 dark:text-white text-xs tracking-tight group-hover:text-[#EDCF5D] transition-colors">
                              {p.name}
                            </span>
                          </div>
                        </td>

                        {/* Status (Rounded Pill Badge) */}
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              p.status === "active"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : p.status === "draft"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-gray-200 dark:bg-[#333333] text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {p.status === "active" ? "Active" : p.status === "draft" ? "Draft" : "Archived"}
                          </span>
                        </td>

                        {/* Date Updated */}
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-300 font-medium">
                          {updatedTimeStr}
                        </td>

                        {/* Warehouse Stock */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          {stockQty <= 5 && stockQty > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                              {stockQty} Low Stock
                            </span>
                          ) : stockQty === 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap bg-gray-500/15 border border-gray-400/30 text-gray-600 dark:text-gray-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                              Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              {stockQty} in Stock
                            </span>
                          )}
                        </td>

                        {/* Total Sales / Price */}
                        <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white">
                          {formatNaira(p.base_price)}
                        </td>

                        {/* 3-Dots Vertical Action Button */}
                        <td className="pr-4 pl-2 py-3 text-right">
                          <button
                            onClick={(e) => handleToggleMenu(e, p.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer"
                            title="Actions"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ────── PAGINATION FOOTER BAR ────── */}
        {!loading && totalEntries > 0 && (
          <div className="relative px-4 py-3.5 border-t border-gray-200/80 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-sans">
            {/* Left: Showing entries info */}
            <div className="font-normal text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              Showing {displayedCount} of {totalEntries} entries
            </div>

            {/* Center: Pagination Controls */}
            <div className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-1.5">
              {/* Previous Page Arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={validCurrentPage === 1}
                className="w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] min-h-[28px] sm:min-h-[32px] rounded-[6px] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282828] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Previous page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              {/* Page Number Buttons & Ellipsis */}
              {getPageNumbers().map((item, idx) => {
                if (item === "...") {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] flex items-center justify-center text-gray-400 select-none font-mono text-xs leading-none"
                    >
                      ...
                    </span>
                  );
                }

                const pageNum = Number(item);
                const isActive = pageNum === validCurrentPage;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] min-h-[28px] sm:min-h-[32px] rounded-[6px] text-xs sm:text-sm font-medium flex items-center justify-center text-center leading-none transition-all cursor-pointer select-none ${
                      isActive
                        ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black font-bold shadow-2xs"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282828]"
                    }`}
                  >
                    <span className="leading-none inline-flex items-center justify-center">{pageNum}</span>
                  </button>
                );
              })}

              {/* Next Page Arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={validCurrentPage === totalPages}
                className="w-7 h-7 sm:w-8 sm:h-8 min-w-[28px] sm:min-w-[32px] min-h-[28px] sm:min-h-[32px] rounded-[6px] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282828] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Next page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Right: Empty spacer to balance layout on desktop */}
            <div className="hidden sm:block" />
          </div>
        )}
      </div>

      {/* Product Creation & Editing Slide-over Modal */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchProducts}
        initialData={editingProduct}
      />

      {/* ────── FLOATING FIXED ACTION DROPDOWN MENU (UNCLIPPED VIEWPORT PORTAL) ────── */}
      {openActionMenuId && menuPosition && (
        <div className="fixed inset-0 z-50 pointer-events-none font-sans">
          <div
            className="fixed inset-0 pointer-events-auto"
            onClick={() => setOpenActionMenuId(null)}
          />
          {filteredProducts.map((p) => {
            if (p.id !== openActionMenuId) return null;
            return (
              <div
                key={p.id}
                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                className="fixed w-36 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] shadow-2xl z-50 py-1 font-sans text-xs animate-fadeIn overflow-hidden pointer-events-auto"
              >
                {/* Info Option */}
                <button
                  onClick={() => handleOpenInfoModal(p)}
                  className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span>Info</span>
                </button>

                {/* Edit Option */}
                <button
                  onClick={() => {
                    setOpenActionMenuId(null);
                    router.push(`/admin/products/${p.id}/edit`);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  <span>Edit</span>
                </button>

                {/* Archive / Activate Option */}
                {p.status === "archived" ? (
                  <button
                    onClick={() => handleSetProductStatus(p, "active")}
                    className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Activate</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSetProductStatus(p, "archived")}
                    className="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.146L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <span>Archive</span>
                  </button>
                )}

                <div className="my-1 border-t border-gray-100 dark:border-[#333333]" />

                {/* Delete Option */}
                <button
                  onClick={() => handleOpenDeleteDialog(p)}
                  className="w-full px-3 py-2 text-left text-red-600 dark:text-red-400 flex items-center gap-2 font-medium cursor-pointer transition-colors group"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                    e.currentTarget.style.color = '#ffffff';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) svg.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) svg.style.color = '';
                  }}
                >
                  <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.61 9m4.615-6.72a.75.75 0 01.738.62L15.24 4.5h4.26a.75.75 0 010 1.5h-.896l-.9 13.504A2.25 2.25 0 0115.457 21H8.543a2.25 2.25 0 01-2.247-2.146L5.396 6H4.5a.75.75 0 010-1.5h4.26l.292-1.62a.75.75 0 01.738-.62h4.46z" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ────── STOREFRONT-STYLE PRODUCT INFO SIDE DRAWER ────── */}
      <ProductInfoDrawer
        product={infoProductItem}
        isOpen={!!infoProductItem}
        onClose={() => setInfoProductItem(null)}
        onEdit={(p) => router.push(`/admin/products/${p.id}/edit`)}
      />

      {/* ────── DESTRUCTIVE DELETE DIALOG WITH COUNTDOWN TIMER ────── */}
      {deletingProductItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-fadeIn font-sans">
            {/* Header / Red Warning Icon without circle */}
            <div className="flex items-start gap-3.5">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Delete Product Confirmation
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-gray-900 dark:text-white font-bold">{deletingProductItem.name}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setDeletingProductItem(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#282828] dark:hover:bg-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={deleteCountdown > 0}
                onClick={handleConfirmDelete}
                style={{
                  backgroundColor: deleteCountdown > 0 ? "rgba(220, 38, 38, 0.2)" : "#dc2626",
                  color: deleteCountdown > 0 ? "rgba(248, 113, 113, 0.6)" : "#ffffff",
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                  deleteCountdown > 0
                    ? "border border-red-500/20 cursor-not-allowed"
                    : "cursor-pointer active:scale-95"
                }`}
                onMouseEnter={(e) => {
                  if (deleteCountdown === 0) e.currentTarget.style.backgroundColor = "#b91c1c";
                }}
                onMouseLeave={(e) => {
                  if (deleteCountdown === 0) e.currentTarget.style.backgroundColor = "#dc2626";
                }}
              >
                {deleteCountdown > 0 ? `Delete in (${deleteCountdown}s)` : "Delete Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── DRAFTS MODAL (CLOUD-SAVED PRODUCT DRAFTS) ────── */}
      {showDraftsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#2C2C2C] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col font-sans">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#2C2C2C] pb-3.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EDCF5D]/15 text-[#EDCF5D] flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Draft Products ({cloudDrafts.length})
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Unsaved revisions and new product drafts safely stored in cloud
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftsDrawer(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-[#282828] text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm flex items-center justify-center cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Single Unified Drafts List */}
            <div className="overflow-y-auto pr-1 flex-1 space-y-2.5 [scrollbar-width:thin]">
              {cloudDrafts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-[#252525] flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">No draft items</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                    Incomplete product creations and working edits will appear here. Discarding never affects live products.
                  </p>
                </div>
              ) : (
                cloudDrafts.map((d) => {
                  const data = d.draft_data || {};
                  const isRevision = d.draft_type === "revision";
                  const targetUrl = isRevision && d.product_id
                    ? `/admin/products/${d.product_id}/edit`
                    : `/admin/products/new?draft_id=${d.id}`;

                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444] transition-all gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#333333] overflow-hidden flex items-center justify-center p-1 shrink-0">
                          {data.image_url || data.primary_image_url ? (
                            <img
                              src={data.image_url || data.primary_image_url}
                              alt={d.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400">GTS</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              isRevision
                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}>
                              {isRevision ? "Revision" : "New"}
                            </span>
                            <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              {d.title || "Untitled Draft"}
                            </h5>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate font-mono">
                            {data.category_name || "General"} • {data.variants?.length || 0} variants • {data.base_price ? formatNaira(data.base_price) : "₦0"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(d.id)}
                          className="w-7 h-7 rounded-md text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors flex items-center justify-center text-xs cursor-pointer"
                          title="Discard Draft (Live product remains safe)"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.61 9m4.615-6.72a.75.75 0 01.738.62L15.24 4.5h4.26a.75.75 0 010 1.5h-.896l-.9 13.504A2.25 2.25 0 0115.457 21H8.543a2.25 2.25 0 01-2.247-2.146L5.396 6H4.5a.75.75 0 010-1.5h4.26l.292-1.62a.75.75 0 01.738-.62h4.46z" />
                          </svg>
                        </button>
                        <Link
                          href={targetUrl}
                          onClick={() => setShowDraftsDrawer(false)}
                          className="px-3.5 py-1.5 rounded-[6px] bg-[#EDCF5D] text-black hover:bg-[#e2c34d] transition-all text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <span>Resume</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Excel Import Modal */}
      <ProductExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => {
          setShowImportModal(false);
          fetchProducts();
        }}
      />
    </div>
  );
}
