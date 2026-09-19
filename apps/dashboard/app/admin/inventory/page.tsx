"use client";

import { API_BASE } from "../../lib/api-base";
import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { AdminTopStrip } from "../sidebar-context";
import { exportInventoryToExcel } from "./inventory-excel-service";
import { idempotentFetch } from "@gts/utils";

export interface InventoryItem {
  id: string;
  variant_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  low_stock_threshold: number;
  last_restocked_at?: string;
  last_sold_at?: string;
  updated_at?: string;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
  product_id?: string;
  product_name: string;
  product_slug?: string;
  product_status?: string;
  brand?: string;
  category_name?: string;
  category_slug?: string;
  variant_size?: string;
  variant_color?: string;
  variant_color_hex?: string;
  sku?: string;
  barcode?: string;
  unit_price: number;
  cost_price?: number;
  total_valuation?: number;
  image?: string;
}

export interface StockMovement {
  id: string;
  variant_id: string;
  delta: number;
  reason: string;
  order_id?: string;
  actor_id?: string;
  notes?: string;
  created_at: string;
  actor?: {
    full_name?: string;
    email?: string;
    role?: string;
  };
  variant?: {
    size?: string;
    color?: string;
    sku?: string;
    product?: {
      name?: string;
      base_price?: number;
    };
  };
}

function resolveVariantImage(
  productName: string,
  variantColor?: string,
  variantImageUrl?: string
): string {
  const p = (productName || "").toLowerCase();
  const c = (variantColor || "").toLowerCase();

  // If a specific custom image URL was provided (not generic fallback)
  if (variantImageUrl && variantImageUrl !== "/products/denim_jacket.png") {
    const isGenericHero =
      variantImageUrl.includes("samsung_fridge_black.png") ||
      variantImageUrl.includes("pixel_10_metal.png") ||
      variantImageUrl.includes("nexus_washing_machine_blue.png") ||
      variantImageUrl.includes("air_jordan_retro_1_red.png");

    if (!isGenericHero) {
      return variantImageUrl;
    }
  }

  // 1. Samsung Fridge
  if (p.includes("samsung") || p.includes("fridge") || p.includes("refrigerator") || p.includes("bespoke")) {
    if (c.includes("bronze") || c.includes("tuscan") || c.includes("brown")) {
      return "/products/hero/samsung_fridge_bronze.png";
    }
    if (c.includes("grey") || c.includes("gray") || c.includes("silver") || c.includes("metallic") || c.includes("stainless")) {
      return "/products/hero/samsung_fridge_grey.png";
    }
    if (c.includes("white") || c.includes("cream") || c.includes("classic")) {
      return "/products/hero/samsung_fridge_white.png";
    }
    if (c.includes("black") || c.includes("matte") || c.includes("dark")) {
      return "/products/hero/samsung_fridge_black.png";
    }
  }

  // 2. Google Pixel 10 Pro
  if (p.includes("pixel")) {
    if (c.includes("red") || c.includes("coral")) {
      return "/products/hero/pixel_10_red.png";
    }
    if (c.includes("purple") || c.includes("obsidian")) {
      return "/products/hero/pixel_10_purple.png";
    }
    if (c.includes("green") || c.includes("hazel") || c.includes("mint")) {
      return "/products/hero/pixel_10_green.png";
    }
    if (c.includes("metal") || c.includes("titanium") || c.includes("silver") || c.includes("grey") || c.includes("gray")) {
      return "/products/hero/pixel_10_metal.png";
    }
  }

  // 3. Nexus Washing Machine
  if (p.includes("nexus") || p.includes("wash") || p.includes("twin tub")) {
    if (c.includes("grey") || c.includes("gray") || c.includes("metallic")) {
      return "/products/hero/nexus_washing_machine_grey.png";
    }
    if (c.includes("white") || c.includes("classic")) {
      return "/products/hero/nexus_washing_machine_white.png";
    }
    if (c.includes("green") || c.includes("mint")) {
      return "/products/hero/nexus_washing_machine_green.png";
    }
    if (c.includes("yellow") || c.includes("solar")) {
      return "/products/hero/nexus_washing_machine_yellow.png";
    }
    if (c.includes("blue") || c.includes("royal")) {
      return "/products/hero/nexus_washing_machine_blue.png";
    }
  }

  // 4. Air Jordan 1
  if (p.includes("jordan")) {
    if (c.includes("blue") || c.includes("royal")) {
      return "/products/hero/air_jordan_retro_1_blue.png";
    }
    if (c.includes("black") || c.includes("shadow")) {
      return "/products/hero/air_jordan_retro_1_black.png";
    }
    if (c.includes("red") || c.includes("chicago")) {
      return "/products/hero/air_jordan_retro_1_red.png";
    }
  }

  return variantImageUrl || "";
}

export default function AdminInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [stockStatusFilter, setStockStatusFilter] = useState("ALL"); // ALL, IN_STOCK, LOW_STOCK, OUT_OF_STOCK
  const [sortBy, setSortBy] = useState<string>("default"); // default, stock_asc, stock_desc, value_desc, name_asc
  const [minValuation, setMinValuation] = useState<string>("");
  const [maxValuation, setMaxValuation] = useState<string>("");
  const [showFilterPopover, setShowFilterPopover] = useState<boolean>(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Action Menu & Modals State
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Single Stock Adjustment Modal State
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "remove" | "set">("add");
  const [adjustQty, setAdjustQty] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("restock");
  const [adjustNotes, setAdjustNotes] = useState<string>("");
  const [adjustSubmitting, setAdjustSubmitting] = useState<boolean>(false);

  // Threshold Edit Modal State
  const [thresholdModalItem, setThresholdModalItem] = useState<InventoryItem | null>(null);
  const [thresholdVal, setThresholdVal] = useState<string>("5");
  const [thresholdSubmitting, setThresholdSubmitting] = useState<boolean>(false);

  // Bulk Adjustment Modal State
  const [showBulkAdjustModal, setShowBulkAdjustModal] = useState<boolean>(false);
  const [bulkAdjustType, setBulkAdjustType] = useState<"add" | "set">("add");
  const [bulkAdjustQty, setBulkAdjustQty] = useState<string>("");
  const [bulkAdjustReason, setBulkAdjustReason] = useState<string>("restock");
  const [bulkSubmitting, setBulkSubmitting] = useState<boolean>(false);

  // Stock Movement History Drawer State
  const [showMovementsDrawer, setShowMovementsDrawer] = useState<boolean>(false);
  const [drawerVariantItem, setDrawerVariantItem] = useState<InventoryItem | null>(null);
  const [movementsList, setMovementsList] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState<boolean>(false);

  // Success / Toast Notice State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    fetchInventory();

    const mainEl = document.querySelector("main");
    if (mainEl) {
      const handleScroll = () => {
        setScrolled(mainEl.scrollTop > 5);
      };
      mainEl.addEventListener("scroll", handleScroll);
      return () => mainEl.removeEventListener("scroll", handleScroll);
    }
  }, []);

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, brandFilter, stockStatusFilter, sortBy, minValuation, maxValuation]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("gts_token");
      const res = await fetch(`${API_BASE}/inventory`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setInventory(json.data);
          return;
        }
      }
      // If DB has no inventory records yet, load fallback sample catalog
      setInventory(getFallbackInventory());
    } catch {
      setInventory(getFallbackInventory());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackInventory = (): InventoryItem[] => [
    {
      id: "inv-1",
      variant_id: "var-1",
      product_name: "Cool back pack",
      product_slug: "cool-back-pack",
      sku: "BP-BLK-2026",
      brand: "GTS",
      category_name: "Fashion",
      variant_size: "Standard",
      variant_color: "Midnight Slate",
      variant_color_hex: "#1E293B",
      quantity: 50,
      reserved_quantity: 0,
      available_quantity: 50,
      low_stock_threshold: 10,
      unit_price: 3500000,
      cost_price: 2200000,
      total_valuation: 1750000,
      last_restocked_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      image: "/products/backpack.png",
    },
    {
      id: "inv-2",
      variant_id: "var-2",
      product_name: "DeLonghi 2 Slice Retro Electric Toaster",
      product_slug: "delonghi-2-slice-retro-electric-toaster",
      sku: "DL-TST-2026",
      brand: "DeLonghi",
      category_name: "Appliances",
      variant_size: "2-Slice",
      variant_color: "Chrome Red",
      variant_color_hex: "#DC2626",
      quantity: 3,
      reserved_quantity: 0,
      available_quantity: 3,
      low_stock_threshold: 5,
      unit_price: 2200000,
      cost_price: 1500000,
      total_valuation: 66000,
      last_restocked_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      image: "/products/toaster.png",
    },
    {
      id: "inv-3",
      variant_id: "var-3",
      product_name: "Tri-Ply Heavy Duty Stainless Steel Stock Pot",
      product_slug: "tri-ply-heavy-duty-stainless-steel-stock-pot",
      sku: "ST-POT-32CM",
      brand: "MasterChef",
      category_name: "Appliances",
      variant_size: "32cm / 12L",
      variant_color: "Polished Steel",
      variant_color_hex: "#94A3B8",
      quantity: 36,
      reserved_quantity: 2,
      available_quantity: 34,
      low_stock_threshold: 8,
      unit_price: 2800000,
      cost_price: 1800000,
      total_valuation: 952000,
      last_restocked_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      image: "/products/stockpot.png",
    },
    {
      id: "inv-4",
      variant_id: "var-4",
      product_name: "Hurom Slow Masticating Cold Press Juicer",
      product_slug: "hurom-slow-masticating-cold-press-juicer",
      sku: "HR-JCR-H300",
      brand: "Hurom",
      category_name: "Appliances",
      variant_size: "Standard",
      variant_color: "Matte Black",
      variant_color_hex: "#0F172A",
      quantity: 2,
      reserved_quantity: 0,
      available_quantity: 2,
      low_stock_threshold: 5,
      unit_price: 5500000,
      cost_price: 3900000,
      total_valuation: 110000,
      last_restocked_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      image: "/products/juicer.png",
    },
    {
      id: "inv-5",
      variant_id: "var-5",
      product_name: "OX Heavy Duty 18\" Standing Pedestal Fan",
      product_slug: "ox-heavy-duty-18-standing-pedestal-fan",
      sku: "OX-FAN-18PRO",
      brand: "OX",
      category_name: "Appliances",
      variant_size: "18-inch",
      variant_color: "Industrial Black",
      variant_color_hex: "#18181B",
      quantity: 1,
      reserved_quantity: 0,
      available_quantity: 1,
      low_stock_threshold: 6,
      unit_price: 3500000,
      cost_price: 2400000,
      total_valuation: 35000,
      last_restocked_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      image: "/products/fan.png",
    },
    {
      id: "inv-6",
      variant_id: "var-6",
      product_name: "LG NeoChef Inverter Microwave Oven",
      product_slug: "lg-neochef-inverter-microwave-oven",
      sku: "LG-MW-25L",
      brand: "LG",
      category_name: "Appliances",
      variant_size: "25 Liters",
      variant_color: "Smoky Mirror Glass",
      variant_color_hex: "#475569",
      quantity: 1,
      reserved_quantity: 0,
      available_quantity: 1,
      low_stock_threshold: 4,
      unit_price: 7200000,
      cost_price: 5400000,
      total_valuation: 72000,
      last_restocked_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      image: "/products/microwave.png",
    },
    {
      id: "inv-7",
      variant_id: "var-7",
      product_name: "PlayStation 5 Console Spider-Man 2 Bundle",
      product_slug: "playstation-5-console-spider-man-2-bundle",
      sku: "PS5-SM2-BNDL",
      brand: "Sony",
      category_name: "Gaming",
      variant_size: "Disc Edition",
      variant_color: "Symbiote Red/Black",
      variant_color_hex: "#991B1B",
      quantity: 0,
      reserved_quantity: 0,
      available_quantity: 0,
      low_stock_threshold: 5,
      unit_price: 68000000,
      cost_price: 58000000,
      total_valuation: 0,
      last_restocked_at: new Date(Date.now() - 86400000 * 14).toISOString(),
      image: "/products/spiderman_ps5.png",
    },
    {
      id: "inv-8",
      variant_id: "var-8",
      product_name: "Nexus Twin Tub Washing Machine",
      product_slug: "nexus-twin-tub-washing-machine",
      sku: "NX-WM-TT-2026",
      brand: "Nexus",
      category_name: "Appliances",
      variant_size: "7.5 KG",
      variant_color: "White/Blue",
      variant_color_hex: "#2563EB",
      quantity: 12,
      reserved_quantity: 1,
      available_quantity: 11,
      low_stock_threshold: 4,
      unit_price: 18500000,
      cost_price: 14500000,
      total_valuation: 2035000,
      last_restocked_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      image: "/products/washing_machine.png",
    },
  ];

  const fetchMovements = async (variantId?: string) => {
    setMovementsLoading(true);
    try {
      const url = variantId
        ? `${API_BASE}/inventory/movements?variant_id=${variantId}`
        : `${API_BASE}/inventory/movements`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setMovementsList(json.data || []);
        return;
      }
    } catch {}

    // Fallback sample movements
    setMovementsList([
      {
        id: "mv-1",
        variant_id: variantId || "var-1",
        delta: 50,
        reason: "restock",
        notes: "Initial warehouse shipment received",
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        actor: { full_name: "Admin Stock Manager", role: "admin" },
      },
      {
        id: "mv-2",
        variant_id: variantId || "var-3",
        delta: -2,
        reason: "sale_pos",
        notes: "POS Terminal checkout #POS-1092",
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        actor: { full_name: "Lagos Cashier Desk", role: "cashier" },
      },
      {
        id: "mv-3",
        variant_id: variantId || "var-7",
        delta: -5,
        reason: "sale_online",
        notes: "Online Store Order #GTS-8842",
        created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
        actor: { full_name: "System Webhook", role: "system" },
      },
    ]);
    setMovementsLoading(false);
  };

  const handleOpenMovementsDrawer = (inv?: InventoryItem) => {
    setDrawerVariantItem(inv || null);
    setShowMovementsDrawer(true);
    fetchMovements(inv?.variant_id);
  };

  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, invId: string) => {
    e.stopPropagation();
    if (openActionMenuId === invId) {
      setOpenActionMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 170;
      const opensUpward = rect.bottom + menuHeight > window.innerHeight;

      setMenuPosition({
        top: opensUpward ? Math.max(10, rect.top - menuHeight) : rect.bottom + 4,
        left: Math.max(10, rect.right - 180),
      });
      setOpenActionMenuId(invId);
    }
  };

  const handleSelectAll = () => {
    const pageItemIds = paginatedInventory.map((i) => i.id);
    const allPageSelected = pageItemIds.length > 0 && pageItemIds.every((id) => selectedItems.includes(id));
    if (allPageSelected) {
      setSelectedItems((prev) => prev.filter((id) => !pageItemIds.includes(id)));
    } else {
      setSelectedItems((prev) => Array.from(new Set([...prev, ...pageItemIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Single Stock Adjustment Submission
  const handleConfirmStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalItem || !adjustQty) return;

    const parsedQty = parseInt(adjustQty, 10);
    if (isNaN(parsedQty) || parsedQty < 0) return;

    setAdjustSubmitting(true);
    const targetVariantId = adjustModalItem.variant_id || adjustModalItem.id;

    try {
      const token = localStorage.getItem("gts_token");
      await idempotentFetch(`${API_BASE}/inventory/${targetVariantId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          adjustment_type: adjustType,
          quantity: parsedQty,
          reason: adjustReason,
          notes: adjustNotes || null,
        }),
      });
    } catch {}

    // Optimistic state update
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === adjustModalItem.id || item.variant_id === adjustModalItem.variant_id) {
          let newQty = item.quantity;
          if (adjustType === "add") newQty += parsedQty;
          else if (adjustType === "remove") newQty = Math.max(0, newQty - parsedQty);
          else if (adjustType === "set") newQty = parsedQty;

          const newAvail = Math.max(0, newQty - item.reserved_quantity);
          const unitP = item.unit_price > 100000 ? item.unit_price / 100 : item.unit_price;

          return {
            ...item,
            quantity: newQty,
            available_quantity: newAvail,
            total_valuation: unitP * newAvail,
            last_restocked_at: adjustType === "add" ? new Date().toISOString() : item.last_restocked_at,
          };
        }
        return item;
      })
    );

    setAdjustSubmitting(false);
    setAdjustModalItem(null);
    setAdjustQty("");
    setAdjustNotes("");
    showToast(`Stock updated successfully for ${adjustModalItem.product_name}`);
  };

  // Low Stock Threshold Edit Submission
  const handleConfirmThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thresholdModalItem || !thresholdVal) return;

    const parsedThreshold = parseInt(thresholdVal, 10);
    if (isNaN(parsedThreshold) || parsedThreshold < 0) return;

    setThresholdSubmitting(true);
    const targetVariantId = thresholdModalItem.variant_id || thresholdModalItem.id;

    try {
      const token = localStorage.getItem("gts_token");
      await idempotentFetch(`${API_BASE}/inventory/${targetVariantId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          low_stock_threshold: parsedThreshold,
        }),
      });
    } catch {}

    // Optimistic update
    setInventory((prev) =>
      prev.map((item) =>
        item.id === thresholdModalItem.id || item.variant_id === thresholdModalItem.variant_id
          ? { ...item, low_stock_threshold: parsedThreshold }
          : item
      )
    );

    setThresholdSubmitting(false);
    setThresholdModalItem(null);
    showToast(`Reorder threshold updated to ${parsedThreshold} units.`);
  };

  // Bulk Stock Adjustment Submission
  const handleConfirmBulkAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0 || !bulkAdjustQty) return;

    const parsedQty = parseInt(bulkAdjustQty, 10);
    if (isNaN(parsedQty) || parsedQty < 0) return;

    setBulkSubmitting(true);

    // Apply optimistic updates to all selected items
    setInventory((prev) =>
      prev.map((item) => {
        if (selectedItems.includes(item.id)) {
          let newQty = item.quantity;
          if (bulkAdjustType === "add") newQty += parsedQty;
          else if (bulkAdjustType === "set") newQty = parsedQty;

          const newAvail = Math.max(0, newQty - item.reserved_quantity);
          const unitP = item.unit_price > 100000 ? item.unit_price / 100 : item.unit_price;

          return {
            ...item,
            quantity: newQty,
            available_quantity: newAvail,
            total_valuation: unitP * newAvail,
            last_restocked_at: bulkAdjustType === "add" ? new Date().toISOString() : item.last_restocked_at,
          };
        }
        return item;
      })
    );

    // Async batch call to backend
    try {
      const token = localStorage.getItem("gts_token");
      for (const itemId of selectedItems) {
        const item = inventory.find((i) => i.id === itemId);
        if (item) {
          const targetVariantId = item.variant_id || item.id;
          fetch(`${API_BASE}/inventory/${targetVariantId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              adjustment_type: bulkAdjustType,
              quantity: parsedQty,
              reason: bulkAdjustReason,
              notes: `Bulk adjustment across ${selectedItems.length} selected variants`,
            }),
          }).catch(() => {});
        }
      }
    } catch {}

    setBulkSubmitting(false);
    setShowBulkAdjustModal(false);
    setBulkAdjustQty("");
    setSelectedItems([]);
    showToast(`Bulk updated ${selectedItems.length} inventory variants successfully!`);
  };

  const formatNaira = (amount: number) => {
    const val = amount > 100000 ? amount / 100 : amount;
    return "₦" + Math.round(val).toLocaleString("en-NG");
  };

  // Available categories & brands for filter pills
  const availableCategories = useMemo(() => {
    return Array.from(new Set(inventory.map((i) => i.category_name).filter(Boolean))) as string[];
  }, [inventory]);

  const availableBrands = useMemo(() => {
    return Array.from(new Set(inventory.map((i) => i.brand).filter(Boolean))) as string[];
  }, [inventory]);

  const activeFiltersCount =
    (categoryFilter !== "ALL" ? 1 : 0) +
    (brandFilter !== "ALL" ? 1 : 0) +
    (stockStatusFilter !== "ALL" ? 1 : 0) +
    (minValuation ? 1 : 0) +
    (maxValuation ? 1 : 0) +
    (sortBy !== "default" ? 1 : 0);

  const handleResetFilters = () => {
    setCategoryFilter("ALL");
    setBrandFilter("ALL");
    setStockStatusFilter("ALL");
    setMinValuation("");
    setMaxValuation("");
    setSortBy("default");
    setSearchQuery("");
  };

  // Filtering & Sorting Logic
  const filteredInventory = useMemo(() => {
    return inventory
      .filter((item) => {
        const matchesSearch =
          !searchQuery ||
          item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.barcode && item.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.variant_color && item.variant_color.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.variant_size && item.variant_size.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCategory =
          categoryFilter === "ALL" ||
          (item.category_name && item.category_name.toLowerCase() === categoryFilter.toLowerCase());

        const matchesBrand =
          brandFilter === "ALL" ||
          (item.brand && item.brand.toLowerCase() === brandFilter.toLowerCase());

        const isLow = item.available_quantity <= item.low_stock_threshold && item.available_quantity > 0;
        const isOut = item.available_quantity === 0;
        const isIn = item.available_quantity > item.low_stock_threshold;

        const matchesStock =
          stockStatusFilter === "ALL" ||
          (stockStatusFilter === "IN_STOCK" && isIn) ||
          (stockStatusFilter === "LOW_STOCK" && isLow) ||
          (stockStatusFilter === "OUT_OF_STOCK" && isOut);

        const valuation = item.total_valuation || (item.unit_price > 100000 ? item.unit_price / 100 : item.unit_price) * item.available_quantity;
        const matchesMinVal = !minValuation || valuation >= Number(minValuation);
        const matchesMaxVal = !maxValuation || valuation <= Number(maxValuation);

        return matchesSearch && matchesCategory && matchesBrand && matchesStock && matchesMinVal && matchesMaxVal;
      })
      .sort((a, b) => {
        if (sortBy === "stock_asc") return a.available_quantity - b.available_quantity;
        if (sortBy === "stock_desc") return b.available_quantity - a.available_quantity;
        if (sortBy === "value_desc") {
          const valA = a.total_valuation || (a.unit_price > 100000 ? a.unit_price / 100 : a.unit_price) * a.available_quantity;
          const valB = b.total_valuation || (b.unit_price > 100000 ? b.unit_price / 100 : b.unit_price) * b.available_quantity;
          return valB - valA;
        }
        if (sortBy === "name_asc") return a.product_name.localeCompare(b.product_name);
        return 0; // default
      });
  }, [inventory, searchQuery, categoryFilter, brandFilter, stockStatusFilter, sortBy, minValuation, maxValuation]);

  // Metric KPI Computations
  const totalTrackedVariants = inventory.length;
  const totalPhysicalUnits = inventory.reduce((acc, item) => acc + (item.quantity || 0), 0);
  const totalReservedUnits = inventory.reduce((acc, item) => acc + (item.reserved_quantity || 0), 0);
  const totalAvailableUnits = inventory.reduce((acc, item) => acc + (item.available_quantity || 0), 0);
  const totalValuationNaira = inventory.reduce((acc, item) => {
    const unitP = item.unit_price > 100000 ? item.unit_price / 100 : item.unit_price;
    return acc + unitP * (item.available_quantity || 0);
  }, 0);

  const formattedStockValuation =
    totalValuationNaira >= 1_000_000_000
      ? `₦${(totalValuationNaira / 1_000_000_000).toFixed(2)}B`
      : totalValuationNaira >= 1_000_000
      ? `₦${(totalValuationNaira / 1_000_000).toFixed(1)}M`
      : `₦${Math.round(totalValuationNaira).toLocaleString("en-NG")}`;

  const lowStockCount = inventory.filter(
    (item) => item.available_quantity <= item.low_stock_threshold && item.available_quantity > 0
  ).length;

  const outOfStockCount = inventory.filter((item) => item.available_quantity === 0).length;

  // Pagination Calculations
  const totalEntries = filteredInventory.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalEntries === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(validCurrentPage * pageSize, totalEntries);
  const displayedCount = totalEntries === 0 ? 0 : endIndex - startIndex + 1;
  const paginatedInventory = filteredInventory.slice((validCurrentPage - 1) * pageSize, validCurrentPage * pageSize);

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

  return (
    <div className="px-4 pt-3.5 pb-6 lg:px-5 lg:pt-3.5 space-y-4 max-w-[1600px] mx-auto font-sans transition-colors duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black font-semibold text-xs rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <svg className="w-4 h-4 text-emerald-400 dark:text-black shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ────── STICKY TOP PAGE HEADER (METADATA + TITLE ROW COMBINED) ────── */}
      <div
        className={`sticky top-0 z-40 -mx-4 -mt-3.5 px-4 pt-3.5 pb-2 lg:-mx-5 lg:-mt-3.5 lg:px-5 space-y-3 transition-all duration-200 ${
          scrolled
            ? "bg-[#F8F7F4]/90 dark:bg-[#1C1C1C]/90 backdrop-blur-md border-b border-gray-200 dark:border-[#262626] shadow-2xs"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        {/* Top Metadata Strip */}
        <AdminTopStrip
          breadcrumbs={[
            { label: "Inventory", href: "/admin/inventory" },
            { label: "Overview" },
          ]}
        />

        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Inventory Control
            </h1>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5 font-mono">
              Realtime stock levels, reorder thresholds, warehouse tracking, and audit logs
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Audit Logs / Movements Drawer Toggle */}
            <button
              type="button"
              onClick={() => handleOpenMovementsDrawer()}
              className="relative px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title="View Realtime Stock Movements Audit Trail"
            >
              <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Movements Log</span>
            </button>

            {/* Export Inventory to Excel (.xlsx) */}
            <button
              type="button"
              onClick={() =>
                exportInventoryToExcel(
                  filteredInventory,
                  `gts-inventory-audit-${new Date().toISOString().slice(0, 10)}.xlsx`
                )
              }
              className="px-3.5 py-2 rounded-[6px] bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#383838] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer shadow-2xs flex items-center gap-2"
              title={`Export ${filteredInventory.length} Inventory Records to Excel (.xlsx)`}
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6" />
              </svg>
              <span>Export</span>
            </button>

            {/* Bulk Restock Action Button (Primary GTS Gold #EDCF5D) */}
            <button
              type="button"
              onClick={() => {
                if (selectedItems.length === 0) {
                  showToast("Please select one or more items from the table below to adjust.");
                } else {
                  setShowBulkAdjustModal(true);
                }
              }}
              className="px-4 py-2 rounded-[6px] bg-[#EDCF5D] text-[#010101] hover:bg-white dark:bg-[#EDCF5D] dark:text-[#121316] dark:hover:bg-white text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>{selectedItems.length > 0 ? `Bulk Restock (${selectedItems.length})` : "Restock Items"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────── 4 ISOMETRIC 3D METRIC KPI CARDS ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tracked Variants */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStockStatusFilter("ALL");
            setCurrentPage(1);
          }}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Tracked Variants
            </span>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {totalTrackedVariants}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-28 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {totalPhysicalUnits} physical units in warehouse
            </div>
          )}

          {/* 3D Isometric Stacked Crates Watermark */}
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
                <linearGradient id="crateFadeMaskInv" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>

                <mask id="fadeTopLeftCrateInv">
                  <rect x="0" y="0" width="130" height="100" fill="url(#crateFadeMaskInv)" />
                </mask>

                <linearGradient id="crateTopGradInv" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="wm-crate-top-s1" />
                  <stop offset="100%" className="wm-crate-top-s2" />
                </linearGradient>
                <linearGradient id="crateLeftGradInv" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" className="wm-crate-left-s1" />
                  <stop offset="100%" className="wm-crate-left-s2" />
                </linearGradient>
                <linearGradient id="crateRightGradInv" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" className="wm-crate-right-s1" />
                  <stop offset="100%" className="wm-crate-right-s2" />
                </linearGradient>
              </defs>

              <g mask="url(#fadeTopLeftCrateInv)">
                <g transform="translate(25, -12)">
                  <polygon points="45,28 75,15 105,28 75,41" fill="url(#crateTopGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                  <polygon points="45,28 75,41 75,72 45,59" fill="url(#crateLeftGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                  <polygon points="75,41 105,28 105,59 75,72" fill="url(#crateRightGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                </g>
                <g transform="translate(0, 4)">
                  <polygon points="20,38 56,22 92,38 56,54" fill="url(#crateTopGradInv)" className="wm-crate-stroke" strokeWidth="1.6" />
                  <line x1="38" y1="30" x2="74" y2="46" className="wm-crate-line" strokeWidth="2.5" strokeLinecap="round" />
                  <polygon points="20,38 56,54 56,92 20,76" fill="url(#crateLeftGradInv)" className="wm-crate-stroke" strokeWidth="1.6" />
                  <line x1="20" y1="57" x2="56" y2="73" className="wm-crate-line" strokeWidth="1.5" />
                  <line x1="38" y1="46" x2="38" y2="84" className="wm-crate-line" strokeWidth="1.5" />
                  <polygon points="56,54 92,38 92,76 56,92" fill="url(#crateRightGradInv)" className="wm-crate-stroke" strokeWidth="1.6" />
                  <line x1="56" y1="73" x2="92" y2="57" className="wm-crate-line" strokeWidth="1.5" />
                  <line x1="74" y1="46" x2="74" y2="84" className="wm-crate-line" strokeWidth="1.5" />
                  <polygon points="64,54 82,46 82,58 64,66" fill="url(#crateTopGradInv)" opacity="0.8" className="wm-crate-stroke" strokeWidth="1" />
                </g>
              </g>
            </svg>
          </div>
        </div>

        {/* Card 2: Warehouse Stock Valuation */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStockStatusFilter("ALL");
            setCurrentPage(1);
          }}
          className="group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border border-gray-200 dark:border-[#2C2C2C] hover:border-gray-400 dark:hover:border-[#444] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none"
        >
          <div className="relative z-10 space-y-1">
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
              Warehouse Stock Value
            </span>
            {loading ? (
              <div className="h-8 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans truncate"
                title={`Exact Total: ₦${Math.round(totalValuationNaira).toLocaleString("en-NG")}`}
              >
                {formattedStockValuation}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400 truncate">
              {totalAvailableUnits.toLocaleString()} units avail · {totalReservedUnits} reserved
            </div>
          )}

          {/* 3D Isometric Industrial Warehouse Pallet Racking Watermark */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <style>{`
                  .wm-rack-frame-inv { stroke: rgba(0, 0, 0, 0.16); }
                  .wm-rack-beam-inv { stroke: #6B7280; }
                  .dark .wm-rack-frame-inv { stroke: rgba(255, 255, 255, 0.2); }
                  .dark .wm-rack-beam-inv { stroke: #2D2D2D; }
                `}</style>
                <linearGradient id="rackFadeMaskInv" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>
                <mask id="fadeRackMaskInv">
                  <rect x="0" y="0" width="140" height="100" fill="url(#rackFadeMaskInv)" />
                </mask>
              </defs>

              <g mask="url(#fadeRackMaskInv)" transform="translate(10, 4)">
                {/* Industrial Warehouse Upright Columns */}
                <line x1="20" y1="15" x2="20" y2="92" className="wm-rack-frame-inv" strokeWidth="2" strokeLinecap="round" />
                <line x1="60" y1="36" x2="60" y2="98" className="wm-rack-frame-inv" strokeWidth="2" strokeLinecap="round" />
                <line x1="100" y1="15" x2="100" y2="92" className="wm-rack-frame-inv" strokeWidth="2" strokeLinecap="round" />
                
                {/* Top Shelf Load Beams */}
                <line x1="20" y1="30" x2="60" y2="52" className="wm-rack-beam-inv" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="60" y1="52" x2="100" y2="30" className="wm-rack-beam-inv" strokeWidth="2.5" strokeLinecap="round" />

                {/* Bottom Shelf Load Beams */}
                <line x1="20" y1="65" x2="60" y2="86" className="wm-rack-beam-inv" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="60" y1="86" x2="100" y2="65" className="wm-rack-beam-inv" strokeWidth="2.5" strokeLinecap="round" />

                {/* Truss Cross Braces */}
                <line x1="20" y1="30" x2="60" y2="86" className="wm-rack-frame-inv" strokeWidth="1" opacity="0.4" strokeDasharray="3 3" />
                <line x1="60" y1="52" x2="100" y2="65" className="wm-rack-frame-inv" strokeWidth="1" opacity="0.4" strokeDasharray="3 3" />

                {/* Top Shelf Pallet Box 1 (Left Bay) */}
                <g transform="translate(28, 20)">
                  <polygon points="12,8 24,2 36,8 24,14" fill="url(#crateTopGradInv)" className="wm-crate-stroke" strokeWidth="1" />
                  <polygon points="12,8 24,14 24,26 12,20" fill="url(#crateLeftGradInv)" className="wm-crate-stroke" strokeWidth="1" />
                  <polygon points="24,14 36,8 36,20 24,26" fill="url(#crateRightGradInv)" className="wm-crate-stroke" strokeWidth="1" />
                </g>

                {/* Top Shelf Pallet Box 2 (Right Bay) */}
                <g transform="translate(62, 10)">
                  <polygon points="12,8 24,2 36,8 24,14" fill="url(#crateTopGradInv)" className="wm-crate-stroke" strokeWidth="1" />
                  <polygon points="12,8 24,14 24,24 12,18" fill="url(#crateLeftGradInv)" className="wm-crate-stroke" strokeWidth="1" />
                  <polygon points="24,14 36,8 36,18 24,24" fill="url(#crateRightGradInv)" className="wm-crate-stroke" strokeWidth="1" />
                </g>

                {/* Bottom Shelf Heavy Pallet Stack (Center-Left) */}
                <g transform="translate(32, 54)">
                  <polygon points="14,10 30,2 46,10 30,18" fill="url(#crateTopGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                  <polygon points="14,10 30,18 30,34 14,26" fill="url(#crateLeftGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                  <polygon points="30,18 46,10 46,26 30,34" fill="url(#crateRightGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                  <line x1="22" y1="6" x2="38" y2="14" className="wm-crate-line" strokeWidth="1.8" strokeLinecap="round" />
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
            setStockStatusFilter((prev) => (prev === "LOW_STOCK" ? "ALL" : "LOW_STOCK"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            stockStatusFilter === "LOW_STOCK"
              ? "border-amber-500/80 ring-2 ring-amber-500/40 dark:border-amber-400 dark:ring-amber-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-amber-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Low Stock Warnings
              </span>
              {stockStatusFilter === "LOW_STOCK" && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                  Filtered
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse my-0.5" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#010101] dark:text-white font-sans">
                {lowStockCount}
              </p>
            )}
          </div>
          {loading ? (
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2F2F2F] rounded-md animate-pulse relative z-10" />
          ) : (
            <div className="relative z-10 font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
              {lowStockCount > 0 ? "Needs restock batch soon" : "All items well stocked"}
            </div>
          )}

          {/* 3D Isometric Depleted Pallet with Amber Low-Stock Gauge Watermark */}
          <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
            <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <linearGradient id="lowStockFadeMaskInv" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>
                <mask id="fadeLowStockMaskInv">
                  <rect x="0" y="0" width="130" height="100" fill="url(#lowStockFadeMaskInv)" />
                </mask>
              </defs>

              <g mask="url(#fadeLowStockMaskInv)" transform="translate(10, 8)">
                {/* Wooden Pallet Base */}
                <polygon points="20,58 56,42 92,58 56,74" fill="url(#crateTopGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                <polygon points="20,58 56,74 56,80 20,64" fill="url(#crateLeftGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                <polygon points="56,74 92,58 92,64 56,80" fill="url(#crateRightGradInv)" className="wm-crate-stroke" strokeWidth="1.2" />
                <line x1="32" y1="52" x2="68" y2="68" className="wm-crate-line" strokeWidth="1.2" />
                <line x1="44" y1="47" x2="80" y2="63" className="wm-crate-line" strokeWidth="1.2" />

                {/* Single Remaining Low-Stock Crate Sitting on Pallet */}
                <g transform="translate(0, -14)">
                  <polygon points="32,46 56,36 80,46 56,56" fill="url(#crateTopGradInv)" className="wm-crate-stroke" strokeWidth="1.4" />
                  <polygon points="32,46 56,56 56,72 32,62" fill="url(#crateLeftGradInv)" className="wm-crate-stroke" strokeWidth="1.4" />
                  <polygon points="56,56 80,46 80,62 56,72" fill="url(#crateRightGradInv)" className="wm-crate-stroke" strokeWidth="1.4" />
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
            setStockStatusFilter((prev) => (prev === "OUT_OF_STOCK" ? "ALL" : "OUT_OF_STOCK"));
            setCurrentPage(1);
          }}
          className={`group relative p-3.5 sm:p-4 rounded-[12px] bg-gradient-to-br from-white via-[#FBFBFA] to-[#F3F2EC] dark:from-[#222222] dark:via-[#181818] dark:to-[#111111] border ${
            stockStatusFilter === "OUT_OF_STOCK"
              ? "border-rose-500/80 ring-2 ring-rose-500/40 dark:border-rose-400 dark:ring-rose-400/30"
              : "border-gray-200 dark:border-[#2C2C2C] hover:border-rose-500/40"
          } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between h-28 cursor-pointer select-none`}
        >
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 block font-sans">
                Out of Stock (Critical)
              </span>
              {stockStatusFilter === "OUT_OF_STOCK" && (
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
                <linearGradient id="outOfStockFadeMaskInv" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>
                <mask id="fadeOutOfStockMaskInv">
                  <rect x="0" y="0" width="130" height="100" fill="url(#outOfStockFadeMaskInv)" />
                </mask>
              </defs>

              <g mask="url(#fadeOutOfStockMaskInv)" transform="translate(10, 8)">
                {/* Empty Wooden Warehouse Pallet */}
                <polygon points="20,54 56,38 92,54 56,70" fill="url(#crateTopGradInv)" className="wm-crate-stroke" strokeWidth="1.4" />
                <polygon points="20,54 56,70 56,78 20,62" fill="url(#crateLeftGradInv)" className="wm-crate-stroke" strokeWidth="1.4" />
                <polygon points="56,70 92,54 92,62 56,78" fill="url(#crateRightGradInv)" className="wm-crate-stroke" strokeWidth="1.4" />
                
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

      {/* ────── UNIFIED INVENTORY TOOLBAR & TABLE CONTAINER ────── */}
      <div className="bg-white dark:bg-[#181818] rounded-[16px] border border-gray-200 dark:border-[#262626] shadow-2xs transition-colors">
        {/* Top Toolbar Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-t-[16px] border-b border-gray-200/80 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Actions: Filter Pill + Dropdowns */}
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
                        Filter Inventory
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

                  {/* Stock Level Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Stock Level
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "ALL", label: "All Items" },
                        { id: "IN_STOCK", label: "In Stock" },
                        { id: "LOW_STOCK", label: "Low Stock (≤ Threshold)" },
                        { id: "OUT_OF_STOCK", label: "Out of Stock (0)" },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setStockStatusFilter(st.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all text-left truncate ${
                            stockStatusFilter === st.id
                              ? "bg-[#0070F3] dark:bg-[#EDCF5D] text-white dark:text-black shadow-2xs font-bold"
                              : "bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
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
                      <option value="default">Default Catalog Order</option>
                      <option value="stock_asc">Lowest Stock Units First (Urgent)</option>
                      <option value="stock_desc">Highest Stock Units First</option>
                      <option value="value_desc">Valuation (High to Low)</option>
                      <option value="name_asc">Product Name (A–Z)</option>
                    </select>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-gray-100 dark:border-[#2A2A2A] flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {filteredInventory.length} variants matching
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

            {/* Quick Stock Filter Dropdown */}
            <div className="relative">
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
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

            {/* Quick Category Dropdown */}
            {availableCategories.length > 0 && (
              <div className="relative hidden md:block">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="appearance-none pl-3.5 pr-8 py-1.5 rounded-xl bg-white dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2B2B2B] transition-all cursor-pointer focus:outline-none shadow-2xs"
                >
                  <option value="ALL">All Categories</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            )}

            {/* Bulk Selection Actions (Appears when rows are selected) */}
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2 pl-2.5 border-l border-gray-200 dark:border-[#333333] transition-all">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 mr-0.5">
                  {selectedItems.length} Selected
                </span>

                <button
                  type="button"
                  onClick={() => setShowBulkAdjustModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Restock</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Quick Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, name, variant..."
              className="w-full pl-9 pr-7 py-1.5 rounded-xl bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-xs font-medium text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D] transition-all shadow-2xs"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-[#222222] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-[#262626] bg-gray-50/60 dark:bg-[#161616] text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <th className="py-3 pl-4 pr-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        paginatedInventory.length > 0 &&
                        paginatedInventory.every((i) => selectedItems.includes(i.id))
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-[#444] text-[#EDCF5D] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Product / Variant</th>
                  <th className="py-3 px-3">Category & Brand</th>
                  <th className="py-3 px-3">Stock Status</th>
                  <th className="py-3 px-3">Physical</th>
                  <th className="py-3 px-3">Reserved</th>
                  <th className="py-3 px-3">Available</th>
                  <th className="py-3 px-3">Reorder Alert</th>
                  <th className="py-3 px-3">Valuation</th>
                  <th className="py-3 px-3">Last Restocked</th>
                  <th className="py-3 pr-4 pl-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-[#222222]">
                {paginatedInventory.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-gray-400 dark:text-gray-500 font-mono">
                      No matching inventory records found
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map((item) => {
                    const isLow = item.available_quantity <= item.low_stock_threshold && item.available_quantity > 0;
                    const isOut = item.available_quantity === 0;

                    let statusBadgeClass = "bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold";
                    let statusLabel = "In Stock";

                    if (isOut) {
                      statusBadgeClass = "bg-gray-500/15 border border-gray-400/30 text-gray-700 dark:text-gray-300 font-bold";
                      statusLabel = "Out of Stock";
                    } else if (isLow) {
                      statusBadgeClass = "bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold shadow-2xs";
                      statusLabel = "Low Stock";
                    }

                    const lastRestockStr = item.last_restocked_at
                      ? new Date(item.last_restocked_at).toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";

                    const valuationNaira =
                      item.total_valuation !== undefined
                        ? item.total_valuation
                        : (item.unit_price > 100000 ? item.unit_price / 100 : item.unit_price) * item.available_quantity;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50/80 dark:hover:bg-[#1E1E1E] transition-colors group"
                      >
                        {/* Checkbox */}
                        <td className="py-3 pl-4 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded border-gray-300 dark:border-[#444] text-[#EDCF5D] focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Product / Variant Info */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            {/* Product Thumbnail */}
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#252525] border border-gray-200/80 dark:border-[#333] flex items-center justify-center shrink-0 overflow-hidden">
                              {(() => {
                                const variantImg = resolveVariantImage(item.product_name, item.variant_color, item.image);
                                return variantImg ? (
                                  <img
                                    src={variantImg}
                                    alt={item.product_name}
                                    className="w-full h-full object-contain p-0.5"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span className="font-bold text-xs text-gray-400">
                                    {item.product_name.slice(0, 2).toUpperCase()}
                                  </span>
                                );
                              })()}
                            </div>

                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[220px]">
                                {item.product_name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[10.5px] text-gray-400 dark:text-gray-500">
                                  {item.sku || "NO-SKU"}
                                </span>
                                {(item.variant_size || item.variant_color) && (
                                  <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-300 text-[10px] font-mono">
                                    {item.variant_size || "STD"} · {item.variant_color || "DEF"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category & Brand */}
                        <td className="py-3 px-3">
                          <p className="font-medium text-gray-800 dark:text-gray-200">
                            {item.category_name || "General"}
                          </p>
                          <p className="text-[10.5px] text-gray-400 dark:text-gray-500 font-mono">
                            {item.brand || "GTS"}
                          </p>
                        </td>

                        {/* Stock Status Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap ${statusBadgeClass}`}>
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isLow ? "bg-rose-500 animate-pulse" : isOut ? "bg-gray-400" : "bg-emerald-500"
                              }`}
                            />
                            {statusLabel}
                          </span>
                        </td>

                        {/* Total Physical Stock */}
                        <td className="py-3 px-3 font-mono font-medium text-gray-700 dark:text-gray-300">
                          {item.quantity}
                        </td>

                        {/* Reserved Stock */}
                        <td className="py-3 px-3 font-mono text-gray-400 dark:text-gray-500">
                          {item.reserved_quantity > 0 ? (
                            <span className="text-amber-500 font-semibold">{item.reserved_quantity}</span>
                          ) : (
                            0
                          )}
                        </td>

                        {/* Available Stock */}
                        <td className="py-3 px-3 font-mono font-bold whitespace-nowrap text-gray-900 dark:text-white">
                          <span
                            className={
                              isOut
                                ? "text-rose-500 font-bold"
                                : isLow
                                ? "text-rose-600 dark:text-rose-400 font-black"
                                : "text-emerald-600 dark:text-emerald-400 font-bold"
                            }
                          >
                            {item.available_quantity}
                          </span>
                        </td>

                        {/* Reorder Threshold */}
                        <td className="py-3 px-3 font-mono text-gray-500 dark:text-gray-400">
                          <button
                            type="button"
                            onClick={() => {
                              setThresholdModalItem(item);
                              setThresholdVal(item.low_stock_threshold.toString());
                            }}
                            className="hover:underline hover:text-[#0070F3] dark:hover:text-[#EDCF5D] cursor-pointer"
                            title="Click to edit low stock threshold"
                          >
                            ≤ {item.low_stock_threshold} units
                          </button>
                        </td>

                        {/* Stock Valuation */}
                        <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">
                          {formatNaira(valuationNaira)}
                        </td>

                        {/* Last Restocked Date */}
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 text-[11px]">
                          {lastRestockStr}
                        </td>

                        {/* 3-Dots Action Button */}
                        <td className="py-3 pr-4 pl-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => handleToggleMenu(e, item.id)}
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

        {/* ────── CENTERED PAGINATION FOOTER BAR ────── */}
        {!loading && totalEntries > 0 && (
          <div className="relative px-4 py-3.5 border-t border-gray-200/80 dark:border-[#262626] bg-white dark:bg-[#1C1C1C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-sans rounded-b-[16px]">
            {/* Left: Showing entries info */}
            <div className="font-normal text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              Showing {displayedCount} of {totalEntries} inventory variants
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

      {/* ────── FLOATING 3-DOTS ACTION POPUP MENU (UNCLIPPED VIEWPORT PORTAL) ────── */}
      {openActionMenuId && menuPosition && (
        <div className="fixed inset-0 z-50 pointer-events-none font-sans">
          <div
            className="fixed inset-0 pointer-events-auto"
            onClick={() => {
              setOpenActionMenuId(null);
              setMenuPosition(null);
            }}
          />
          {(() => {
            const item = inventory.find((i) => i.id === openActionMenuId);
            if (!item) return null;

            return (
              <div
                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                className="fixed w-48 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#333333] shadow-2xl z-50 py-1 font-sans text-xs animate-in fade-in zoom-in-95 duration-100 overflow-hidden pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={() => {
                    setAdjustModalItem(item);
                    setAdjustType("add");
                    setAdjustQty("");
                    setAdjustReason("restock");
                    setOpenActionMenuId(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-3.5 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2B2B2B] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Adjust Stock</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleOpenMovementsDrawer(item);
                    setOpenActionMenuId(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-3.5 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2B2B2B] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Movement Logs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setThresholdModalItem(item);
                    setThresholdVal(item.low_stock_threshold.toString());
                    setOpenActionMenuId(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-3.5 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2B2B2B] flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  <span>Edit Alert Threshold</span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-[#2A2A2A]" />

                <button
                  type="button"
                  onClick={() => {
                    setAdjustModalItem(item);
                    setAdjustType("set");
                    setAdjustQty("0");
                    setAdjustReason("write_off");
                    setAdjustNotes("Marked as 0 stock out / write-off");
                    setOpenActionMenuId(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span>Mark Out of Stock</span>
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ────── STOCK ADJUSTMENT MODAL ────── */}
      {adjustModalItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#333333] rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl font-sans">
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-[#282828] pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Adjust Inventory Stock
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {adjustModalItem.product_name} ({adjustModalItem.sku || "Standard"})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalItem(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmStockAdjustment} className="space-y-4 text-xs">
              {/* Segmented Adjustment Mode: Add / Remove / Set */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Adjustment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "add", label: "+ Add Stock", desc: "Shipment / Restock" },
                    { id: "remove", label: "- Remove Stock", desc: "Damage / Loss" },
                    { id: "set", label: "= Set Exact Total", desc: "Audit Count" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setAdjustType(mode.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        adjustType === mode.id
                          ? "bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black border-transparent font-bold shadow-md"
                          : "bg-gray-50 dark:bg-[#242424] border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2C2C2C]"
                      }`}
                    >
                      <div className="font-bold text-xs">{mode.label}</div>
                      <div className="text-[10px] opacity-75">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Input + Quick Booster Buttons */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-gray-700 dark:text-gray-300">
                    Quantity ({adjustType === "set" ? "New Total Count" : "Units to adjust"})
                  </label>
                  <span className="font-mono text-[11px] text-gray-400">
                    Current: {adjustModalItem.quantity} units
                  </span>
                </div>
                <input
                  type="number"
                  required
                  min="0"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="Enter unit count..."
                  className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#333333] text-sm text-gray-900 dark:text-white font-mono focus:outline-none focus:border-[#EDCF5D]"
                />

                {/* Quick Booster Chips */}
                {adjustType !== "set" && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-gray-400 mr-1">Quick Add:</span>
                    {[5, 10, 25, 50, 100].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAdjustQty(((parseInt(adjustQty, 10) || 0) + num).toString())}
                        className="px-2 py-0.5 rounded bg-gray-100 dark:bg-[#282828] text-gray-700 dark:text-gray-300 text-[11px] font-mono hover:bg-[#EDCF5D] hover:text-black font-semibold transition-colors cursor-pointer"
                      >
                        +{num}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Preview Box */}
              {adjustQty && !isNaN(parseInt(adjustQty, 10)) && (
                <div className="p-3 rounded-xl bg-[#F8F7F4] dark:bg-[#161616] border border-gray-200 dark:border-[#2A2A2A] flex items-center justify-between font-mono text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Projected Stock Level:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{adjustModalItem.quantity}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-bold text-emerald-600 dark:text-[#EDCF5D] text-sm">
                      {adjustType === "add"
                        ? adjustModalItem.quantity + parseInt(adjustQty, 10)
                        : adjustType === "remove"
                        ? Math.max(0, adjustModalItem.quantity - parseInt(adjustQty, 10))
                        : parseInt(adjustQty, 10)}{" "}
                      Units
                    </span>
                  </div>
                </div>
              )}

              {/* Reason Selector */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Reason for Adjustment
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#333333] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D] cursor-pointer"
                >
                  <option value="restock">Restock / New Warehouse Shipment</option>
                  <option value="sale_pos">POS Terminal Offline Sale</option>
                  <option value="adjustment">Stock Count Audit Reconciliation</option>
                  <option value="correction">Inventory Entry Correction</option>
                  <option value="write_off">Damaged / Expired / Write Off</option>
                  <option value="return">Customer Return to Stock</option>
                </select>
              </div>

              {/* Notes Field */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Audit Notes / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g., PO #8841 or Warehouse Bay 4 stock check"
                  className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#333333] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-[#282828]">
                <button
                  type="button"
                  onClick={() => setAdjustModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-[#252525] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting || !adjustQty}
                  className="px-5 py-2 rounded-xl bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {adjustSubmitting ? "Updating..." : "Save Stock Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────── EDIT LOW STOCK THRESHOLD MODAL ────── */}
      {thresholdModalItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#333333] rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl font-sans">
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-[#282828] pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Set Reorder Warning Threshold
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {thresholdModalItem.product_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setThresholdModalItem(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmThreshold} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Alert Threshold (Units)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={thresholdVal}
                  onChange={(e) => setThresholdVal(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#333333] text-sm text-gray-900 dark:text-white font-mono focus:outline-none focus:border-[#EDCF5D]"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  When available stock drops to or below this amount, the item will automatically trigger a Low Stock warning banner across the dashboard.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-[#282828]">
                <button
                  type="button"
                  onClick={() => setThresholdModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-[#252525] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={thresholdSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black font-bold shadow-md hover:opacity-90 transition-opacity cursor-pointer"
                >
                  {thresholdSubmitting ? "Saving..." : "Save Threshold"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────── BULK ADJUSTMENT MODAL ────── */}
      {showBulkAdjustModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#333333] rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl font-sans">
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-[#282828] pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Bulk Stock Restock ({selectedItems.length} Variants)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Apply identical stock increment to all selected items simultaneously
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkAdjustModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmBulkAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Adjustment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkAdjustType("add")}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      bulkAdjustType === "add"
                        ? "bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black border-transparent font-bold shadow-md"
                        : "bg-gray-50 dark:bg-[#242424] border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <div className="font-bold text-xs">+ Add to Existing Stock</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkAdjustType("set")}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      bulkAdjustType === "set"
                        ? "bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black border-transparent font-bold shadow-md"
                        : "bg-gray-50 dark:bg-[#242424] border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <div className="font-bold text-xs">= Set Exact Quantity</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Quantity per Variant
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={bulkAdjustQty}
                  onChange={(e) => setBulkAdjustQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#333333] text-sm text-gray-900 dark:text-white font-mono focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Reason
                </label>
                <select
                  value={bulkAdjustReason}
                  onChange={(e) => setBulkAdjustReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#333333] text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D] cursor-pointer"
                >
                  <option value="restock">Batch Warehouse Shipment</option>
                  <option value="adjustment">Mass Audit Correction</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-[#282828]">
                <button
                  type="button"
                  onClick={() => setShowBulkAdjustModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-[#252525] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSubmitting || !bulkAdjustQty}
                  className="px-5 py-2 rounded-xl bg-[#010101] dark:bg-[#EDCF5D] text-white dark:text-black font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {bulkSubmitting ? "Processing..." : `Confirm for ${selectedItems.length} Items`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────── STOCK MOVEMENTS / AUDIT TRAIL SLIDE-OVER DRAWER ────── */}
      {showMovementsDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowMovementsDrawer(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-[#1C1C1C] border-l border-gray-200 dark:border-[#2E2E2E] shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-gray-200/80 dark:border-[#262626] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Stock Movement Logs
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {drawerVariantItem ? drawerVariantItem.product_name : "Realtime audit logs across all catalog items"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMovementsDrawer(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2A2A2A] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Movements List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 [scrollbar-width:thin]">
                {movementsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-16 bg-gray-100 dark:bg-[#252525] rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : movementsList.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 font-mono text-xs">
                    No recorded stock movements yet.
                  </div>
                ) : (
                  movementsList.map((m) => {
                    const isPositive = m.delta > 0;
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] border border-gray-200/80 dark:border-[#2E2E2E] space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                              isPositive
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {isPositive ? `+${m.delta}` : m.delta} Units
                          </span>
                          <span className="text-[11px] font-mono text-gray-400">
                            {new Date(m.created_at).toLocaleDateString("en-NG", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11.5px] pt-1">
                          <span className="font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-[10px]">
                            {m.reason.replace("_", " ")}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-[10.5px]">
                            by {m.actor?.full_name || m.actor?.email || "System"}
                          </span>
                        </div>

                        {m.notes && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-[#181818] p-2 rounded-lg border border-gray-200/50 dark:border-[#2C2C2C] italic">
                            "{m.notes}"
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
