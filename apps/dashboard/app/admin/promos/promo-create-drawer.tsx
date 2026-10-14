"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatKobo } from "@gts/utils";
import { apiCall } from "../../lib/staff-api";
import CustomerSelectModal from "./customer-select-modal";
import ProductSelectModal from "./product-select-modal";
import type { PromoProductPreview } from "./types";
import type { CustomerSummary } from "../customers/types";

interface PromoCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function generateRandomCode(): string {
  const prefixes = ["SAVE", "VIP", "OFF", "DEAL", "GTS", "FLASH"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

function calculateDurationText(
  startDateStr: string,
  endDateStr: string
): { text: string; isError: boolean } | null {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T23:59:59Z`);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    return { text: "Expiry date cannot be earlier than start date", isError: true };
  }

  // Calculate full days (inclusive of end day)
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  if (startDateStr === endDateStr) {
    return { text: "Active for 1 day (today until 23:59)", isError: false };
  }
  if (diffDays < 7) {
    return { text: diffDays === 1 ? "Active for 1 day" : `Active for ${diffDays} days`, isError: false };
  }
  const diffWeeks = Math.round(diffDays / 7);
  if (diffDays < 30) {
    return { text: diffWeeks === 1 ? "Active for 1 week" : `Active for ${diffWeeks} weeks`, isError: false };
  }
  const diffMonths = Math.round(diffDays / 30);
  if (diffDays < 365) {
    return { text: diffMonths === 1 ? "Active for 1 month" : `Active for ${diffMonths} months`, isError: false };
  }
  const diffYears = (diffDays / 365).toFixed(1);
  return { text: `Active for ${diffYears} years`, isError: false };
}

export default function PromoCreateDrawer({
  isOpen,
  onClose,
  onSuccess,
}: PromoCreateDrawerProps) {
  const [mounted, setMounted] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customPercent, setCustomPercent] = useState<string>("");

  // Targeting
  const [targetType, setTargetType] = useState<"all" | "specific_customers">("all");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerSummary[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Product Scope
  const [productScope, setProductScope] = useState<"all" | "specific_products">("all");
  const [selectedProducts, setSelectedProducts] = useState<PromoProductPreview[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);

  // Per Person Usage & Mandatory Global Cap
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState<string>("");
  const [globalMaxUses, setGlobalMaxUses] = useState<string>("");

  // Dates
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // UI status
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Initialize fresh code without pre-filling the pickable fields
      setCode(generateRandomCode());
      setDiscountPercent(0);
      setCustomPercent("");
      setTargetType("all");
      setSelectedCustomerIds([]);
      setSelectedCustomers([]);
      setProductScope("all");
      setSelectedProducts([]);
      setMaxUsesPerCustomer("");
      setGlobalMaxUses("");
      setStartDate("");
      setEndDate("");
      setErrorMsg("");

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const durationSubtitle = useMemo(() => {
    return calculateDurationText(startDate, endDate);
  }, [startDate, endDate]);

  // Remove a customer from selection
  const removeCustomer = (id: string) => {
    setSelectedCustomerIds((prev) => prev.filter((cId) => cId !== id));
    setSelectedCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  // Remove a product from selection
  const removeProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Comparison Calculations for the selected product(s)
  const comparisonData = useMemo(() => {
    if (selectedProducts.length === 0 || discountPercent <= 0) return null;
    const prod = selectedProducts[0];
    if (!prod) return null;
    const baseKobo = prod.base_price;
    const costKobo = prod.cost_price || 0;
    const discountKobo = Math.round((baseKobo * discountPercent) / 100);
    const sellingPriceKobo = baseKobo - discountKobo;
    const unitMarginKobo = sellingPriceKobo - costKobo;
    const isBelowCost = costKobo > 0 && sellingPriceKobo < costKobo;

    return {
      productName: prod.name,
      baseKobo,
      costKobo,
      discountKobo,
      sellingPriceKobo,
      unitMarginKobo,
      isBelowCost,
      count: selectedProducts.length,
    };
  }, [selectedProducts, discountPercent]);

  // Form Validation & Pending Requirements
  const missingRequirements = useMemo(() => {
    const list: string[] = [];
    if (!code.trim()) list.push("Promo code");
    if (targetType === "specific_customers" && selectedCustomerIds.length === 0) {
      list.push("Target customer(s)");
    }
    if (productScope === "specific_products" && selectedProducts.length === 0) {
      list.push("Discounted product(s)");
    }
    if (!discountPercent || discountPercent <= 0) {
      list.push("Discount percentage");
    }
    const perPersonNum = parseInt(maxUsesPerCustomer, 10);
    if (!maxUsesPerCustomer.trim() || isNaN(perPersonNum) || perPersonNum < 1) {
      list.push("Limit per person");
    }
    const globalCapNum = parseInt(globalMaxUses, 10);
    if (!globalMaxUses.trim() || isNaN(globalCapNum) || globalCapNum < 1) {
      list.push("Total redemptions cap");
    } else if (!isNaN(perPersonNum) && globalCapNum < perPersonNum) {
      list.push("Global cap ≥ per-person limit");
    }
    if (!startDate) list.push("Start date");
    if (!endDate) list.push("Expiry date");
    else if (startDate && new Date(`${endDate}T23:59:59Z`).getTime() < new Date(`${startDate}T00:00:00Z`).getTime()) {
      list.push("Expiry date on or after start date");
    }

    return list;
  }, [
    code,
    targetType,
    selectedCustomerIds.length,
    productScope,
    selectedProducts.length,
    discountPercent,
    maxUsesPerCustomer,
    globalMaxUses,
    startDate,
    endDate,
  ]);

  const isFormValid = missingRequirements.length === 0;

  if (!isOpen || !mounted) return null;

  const handlePercentPreset = (pct: number) => {
    setDiscountPercent(pct);
    setCustomPercent(String(pct));
  };

  const handleCustomPercentChange = (val: string) => {
    setCustomPercent(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      setDiscountPercent(num);
    } else if (val === "") {
      setDiscountPercent(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isFormValid) {
      setErrorMsg(`Please configure all required fields: ${missingRequirements.join(", ")}`);
      return;
    }

    const totalLimit = parseInt(globalMaxUses, 10);
    const perCustomerLimit = parseInt(maxUsesPerCustomer, 10);

    setSaving(true);
    try {
      const startsAtIso = new Date(`${startDate}T00:00:00Z`).toISOString();
      const expiresAtIso = new Date(`${endDate}T23:59:59Z`).toISOString();

      const payload = {
        code: code.trim().toUpperCase(),
        discount_type: "percentage",
        discount_value: discountPercent,
        min_order_amount: 0,
        max_uses: totalLimit, // Mandatory cap
        starts_at: startsAtIso,
        expires_at: expiresAtIso,
        is_active: true,
        target_type: targetType,
        customer_ids: targetType === "specific_customers" ? selectedCustomerIds : [],
        product_scope: productScope,
        product_ids: productScope === "specific_products" ? selectedProducts.map((p) => p.id) : [],
        max_uses_per_customer: perCustomerLimit,
      };

      const res = await apiCall<any>("/promos", {
        method: "POST",
        json: payload,
      });

      if (!res.ok) {
        let detailsStr = "";
        if (res.details) {
          if (typeof res.details === "object" && !Array.isArray(res.details)) {
            detailsStr = " (" + Object.entries(res.details).map(([k, v]) => `${k}: ${v}`).join(", ") + ")";
          } else if (Array.isArray(res.details)) {
            detailsStr = " (" + res.details.join(", ") + ")";
          }
        }
        throw new Error((res.message || (res as any).error || "Failed to create promo code") + detailsStr);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create promo code.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end overflow-hidden font-sans">
      {/* Full Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Right Panel */}
      <div className="relative w-full max-w-xl sm:max-w-2xl bg-white dark:bg-[#181818] h-full shadow-2xl border-l border-gray-200 dark:border-[#262626] flex flex-col justify-between z-10 animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-[#262626] bg-white/95 dark:bg-[#181818]/95 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Create Promo Code
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E] mt-0.5">
              Target discounts to customers, specific products, and manage profit margins
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form
          id="promoCreateForm"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-xs"
        >
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Promo Code Name & Generator */}
          <div className="space-y-2">
            <label className="block font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
              Promo Code <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GTS-SAVE20"
                  className="w-full px-3.5 py-2.5 font-mono text-sm font-bold tracking-wider rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2C2C2C] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>
              <button
                type="button"
                onClick={() => setCode(generateRandomCode())}
                className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-gray-100 dark:bg-[#222222] hover:bg-gray-200 dark:hover:bg-[#2C2C2C] text-gray-700 dark:text-gray-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Generate another unique code"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Random</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Auto-generated unique code. You can also customize or type your own.
            </p>
          </div>

          {/* Section 2: Customer Eligibility */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-[#262626]">
            <label className="block font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
              Customer Eligibility <span className="text-red-500">*</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setTargetType("all")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  targetType === "all"
                    ? "bg-amber-500/10 border-[#EDCF5D] text-gray-900 dark:text-white"
                    : "border-gray-200 dark:border-[#2C2C2C] hover:bg-gray-50 dark:hover:bg-[#1E1E1E]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "all"}
                    onChange={() => setTargetType("all")}
                    className="accent-[#EDCF5D]"
                  />
                  <span className="font-bold text-xs">All Customers</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Any customer or guest with this code can apply it
                </p>
              </div>

              <div
                onClick={() => {
                  setTargetType("specific_customers");
                  if (selectedCustomerIds.length === 0) setShowCustomerModal(true);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  targetType === "specific_customers"
                    ? "bg-amber-500/10 border-[#EDCF5D] text-gray-900 dark:text-white"
                    : "border-gray-200 dark:border-[#2C2C2C] hover:bg-gray-50 dark:hover:bg-[#1E1E1E]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "specific_customers"}
                    onChange={() => setTargetType("specific_customers")}
                    className="accent-[#EDCF5D]"
                  />
                  <span className="font-bold text-xs">Specific Customer(s)</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Restricted to chosen customer account IDs only
                </p>
              </div>
            </div>

            {/* If Specific Customers selected, show full customer list */}
            {targetType === "specific_customers" && (
              <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2C2C2C]">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-[#242424]">
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {selectedCustomerIds.length === 0
                        ? "No customers selected yet"
                        : `${selectedCustomerIds.length} customer(s) targeted`}
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Only these accounts can apply this promotional code
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCustomerIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerIds([]);
                          setSelectedCustomers([]);
                        }}
                        className="text-[11px] text-rose-500 hover:underline cursor-pointer font-semibold"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowCustomerModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#EDCF5D] text-black font-bold text-xs hover:bg-[#e2c34d] transition-colors cursor-pointer"
                    >
                      {selectedCustomerIds.length > 0 ? "Edit Customers" : "+ Select Customers"}
                    </button>
                  </div>
                </div>

                {/* List of Targeted Customers */}
                {selectedCustomerIds.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1 [scrollbar-width:thin]">
                    {selectedCustomerIds.map((custId) => {
                      const cust = selectedCustomers.find((c) => c.id === custId);
                      const name = cust?.fullName || `Customer ID: ${custId.slice(0, 8)}...`;
                      const email = cust?.email || "";
                      const phone = cust?.phone || "";

                      return (
                        <div
                          key={custId}
                          className="p-2 rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-white dark:bg-[#1E1E1E] flex items-center justify-between shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {(name || "C").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {name}
                              </div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate">
                                {email} {phone ? `• ${phone}` : ""}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCustomer(custId)}
                            className="p-1 rounded-md text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 ml-2"
                            title="Remove customer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Product Scope */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-[#262626]">
            <label className="block font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
              Product Scope <span className="text-red-500">*</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setProductScope("all")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  productScope === "all"
                    ? "bg-amber-500/10 border-[#EDCF5D] text-gray-900 dark:text-white"
                    : "border-gray-200 dark:border-[#2C2C2C] hover:bg-gray-50 dark:hover:bg-[#1E1E1E]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="productScope"
                    checked={productScope === "all"}
                    onChange={() => setProductScope("all")}
                    className="accent-[#EDCF5D]"
                  />
                  <span className="font-bold text-xs">All Products</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Applies storewide across every product in the catalog
                </p>
              </div>

              <div
                onClick={() => {
                  setProductScope("specific_products");
                  if (selectedProducts.length === 0) setShowProductModal(true);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  productScope === "specific_products"
                    ? "bg-amber-500/10 border-[#EDCF5D] text-gray-900 dark:text-white"
                    : "border-gray-200 dark:border-[#2C2C2C] hover:bg-gray-50 dark:hover:bg-[#1E1E1E]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="productScope"
                    checked={productScope === "specific_products"}
                    onChange={() => setProductScope("specific_products")}
                    className="accent-[#EDCF5D]"
                  />
                  <span className="font-bold text-xs">Specific Product(s)</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Applies only when the chosen product(s) are in the cart
                </p>
              </div>
            </div>

            {/* If Specific Products selected, show list of products with real images */}
            {productScope === "specific_products" && (
              <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2C2C2C]">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-[#242424]">
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {selectedProducts.length === 0
                        ? "No products selected yet"
                        : `${selectedProducts.length} product(s) eligible`}
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Discounts will only apply when these items are in the cart
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedProducts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedProducts([])}
                        className="text-[11px] text-rose-500 hover:underline cursor-pointer font-semibold"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#EDCF5D] text-black font-bold text-xs hover:bg-[#e2c34d] transition-colors cursor-pointer"
                    >
                      {selectedProducts.length > 0 ? "Edit Products" : "+ Select Products"}
                    </button>
                  </div>
                </div>

                {/* List of Products with Images */}
                {selectedProducts.length > 0 && (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pt-1 [scrollbar-width:thin]">
                    {selectedProducts.map((prod) => {
                      const discountKobo = discountPercent > 0 ? Math.round((prod.base_price * discountPercent) / 100) : 0;
                      const discountedPrice = prod.base_price - discountKobo;
                      const isLoss = prod.cost_price ? discountedPrice < prod.cost_price : false;

                      return (
                        <div
                          key={prod.id}
                          className="p-2.5 rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-white dark:bg-[#1E1E1E] flex items-center justify-between shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-[#2A2A2A] overflow-hidden flex items-center justify-center shrink-0 border border-gray-200 dark:border-[#333]">
                              <img
                                src={prod.image_url || "/products/denim_jacket.png"}
                                alt={prod.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/products/denim_jacket.png";
                                }}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {prod.name}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2 flex-wrap">
                                <span>Selling: {formatKobo(prod.base_price)}</span>
                                {prod.cost_price ? (
                                  <span className="text-gray-400">• Cost: {formatKobo(prod.cost_price)}</span>
                                ) : null}
                              </div>
                              {discountPercent > 0 && (
                                <div className="text-[10px] font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                    <span>{formatKobo(discountedPrice)} (-{discountPercent}%)</span>
                                  </span>
                                  {isLoss && (
                                    <span className="text-rose-500 font-bold inline-flex items-center gap-1">
                                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                      <span>Sells below cost!</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeProduct(prod.id)}
                            className="p-1 rounded-md text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 ml-2"
                            title="Remove product"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Percentage Discount */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-[#262626]">
            <div>
              <label className="block font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                Percentage Discount (%) <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-gray-500 dark:text-[#8E8E8E] mt-0.5">
                Pick a preset discount or type your own percentage
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[5, 10, 15, 20, 25, 30, 50].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentPreset(pct)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    discountPercent === pct
                      ? "bg-[#EDCF5D] text-black shadow-sm"
                      : "bg-gray-100 dark:bg-[#222222] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2C2C2C]"
                  }`}
                >
                  {pct}%
                </button>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <span className="text-gray-400 text-xs font-semibold">Custom:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="%"
                  value={customPercent}
                  onChange={(e) => handleCustomPercentChange(e.target.value)}
                  className="w-16 px-2.5 py-1.5 text-xs text-center font-bold rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-gray-50 dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
                <span className="text-gray-400 font-bold">%</span>
              </div>
            </div>

            {/* Margin Safety Comparison Card */}
            {comparisonData && (
              <div
                className={`p-4 rounded-xl border transition-all ${
                  comparisonData.isBelowCost
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-emerald-500/10 border-emerald-500/30"
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200/50 dark:border-[#333]/50">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">
                    Profit Margin Analysis ({comparisonData.productName})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      comparisonData.isBelowCost
                        ? "bg-red-500 text-white"
                        : "bg-emerald-500 text-white"
                    }`}
                  >
                    {comparisonData.isBelowCost ? "Negative Margin" : "Profitable"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2 rounded-lg bg-white/60 dark:bg-[#181818]/60">
                    <div className="text-[10px] text-gray-500">Retail Price</div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      {formatKobo(comparisonData.baseKobo)}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-white/60 dark:bg-[#181818]/60">
                    <div className="text-[10px] text-gray-500">After Discount</div>
                    <div className="font-bold text-amber-600 dark:text-[#EDCF5D]">
                      {formatKobo(comparisonData.sellingPriceKobo)}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-white/60 dark:bg-[#181818]/60">
                    <div className="text-[10px] text-gray-500">Net Profit Unit</div>
                    <div
                      className={`font-bold ${
                        comparisonData.isBelowCost
                          ? "text-red-500"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {formatKobo(comparisonData.unitMarginKobo)}
                    </div>
                  </div>
                </div>

                {comparisonData.isBelowCost && (
                  <div className="mt-2 text-[11px] text-red-500 font-semibold flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                      Warning: At {discountPercent}% off, this product will sell below its cost price
                      (loss of {formatKobo(Math.abs(comparisonData.unitMarginKobo))} per unit).
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 5: Usage Limit Per Person & Mandatory Global Cap */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-[#262626]">
            <div>
              <label className="block font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                Usage Limits & Redemptions <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-gray-500 dark:text-[#8E8E8E] mt-0.5">
                Set individual user limits and a mandatory global redemption cap.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">
                  Limit Per Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxUsesPerCustomer}
                  onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-gray-50 dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Max uses per shopper</span>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">
                  Total Redemptions (Global) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={globalMaxUses}
                  onChange={(e) => setGlobalMaxUses(e.target.value)}
                  placeholder="e.g. 50 (Mandatory cap)"
                  className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-gray-50 dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
                <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block">
                  Mandatory cap (cannot be unlimited)
                </span>
              </div>
            </div>

            {globalMaxUses && maxUsesPerCustomer && parseInt(globalMaxUses, 10) < parseInt(maxUsesPerCustomer, 10) && (
              <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Global cap must be greater than or equal to the per-person limit.</span>
              </p>
            )}
          </div>

          {/* Section 6: Date Range & Duration Subtitle */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-[#262626]">
            <div>
              <label className="block font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                Promo Validity & Schedule <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-gray-500 dark:text-[#8E8E8E] mt-0.5">
                Dates during which the promo code will be active and redeemable.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-gray-50 dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">
                  Expiry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-[#2C2C2C] bg-gray-50 dark:bg-[#141414] text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>
            </div>

            {durationSubtitle && (
              <div
                className={`p-2.5 rounded-lg border font-semibold text-xs flex items-center gap-2 ${
                  durationSubtitle.isError
                    ? "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}
              >
                {durationSubtitle.isError ? (
                  <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span>{durationSubtitle.text}</span>
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] flex items-center justify-end gap-3 sticky bottom-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-[#2C2C2C] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#222] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="promoCreateForm"
              disabled={!isFormValid || saving}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#121316] hover:bg-[#EDCF5D] hover:text-[#010101] dark:hover:bg-white transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Creating Promo Code..." : "Save & Launch Promo Code"}
            </button>
          </div>
        </div>
      </div>

      {/* Customer Selection Modal */}
      <CustomerSelectModal
        isOpen={showCustomerModal}
        selectedIds={selectedCustomerIds}
        onClose={() => setShowCustomerModal(false)}
        onConfirm={(ids, customers) => {
          setSelectedCustomerIds(ids);
          if (customers) {
            setSelectedCustomers(customers);
          }
        }}
      />

      {/* Product Selection Modal */}
      <ProductSelectModal
        isOpen={showProductModal}
        selectedIds={selectedProducts.map((p) => p.id)}
        onClose={() => setShowProductModal(false)}
        onConfirm={(prods) => setSelectedProducts(prods)}
      />
    </div>,
    document.body
  );
}
