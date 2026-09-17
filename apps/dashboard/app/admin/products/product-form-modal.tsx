"use client";

import { useEffect, useState } from "react";

export interface VariantRow {
  size: string;
  color: string;
  color_hex: string;
  sku: string;
  quantity: number;
  variant_image_url?: string;
  has_transparent_bg?: boolean;
}

export interface ProductFormData {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  brand: string;
  category_id: string;
  category_name: string;
  sub_category: string;
  base_price_naira: string;
  compare_at_naira: string;
  cost_price_naira: string;
  status: "active" | "draft" | "archived";
  is_featured: boolean;
  image_url: string;
  short_description: string;
  description: string;
  tags: string;
  variants: VariantRow[];
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<ProductFormData> | null;
}

const PRESET_IMAGES = [
  { label: "Denim Jacket", url: "/products/denim_jacket.png" },
  { label: "Oxford Shirt", url: "/products/oxford_shirt.png" },
  { label: "Streetwear Hoodie", url: "/products/hoodie.png" },
  { label: "Linen Coat", url: "/products/linen_coat.png" },
  { label: "Air Jordan 1", url: "/products/hero/air_jordan_retro_1_blue.png" },
  { label: "Pixel 10 Pro", url: "/products/hero/pixel_10_metal.png" },
  { label: "Sony 55\" TV", url: "/products/tv-removebg-preview.png" },
  { label: "PS5 Console", url: "/products/spiderman_ps5.png" },
  { label: "Samsung Fridge", url: "/products/hero/samsung_fridge_black.png" },
  { label: "Philips Air Fryer", url: "/products/airfryer.png" },
];

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: ProductFormModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("GTS");
  const [categoryName, setCategoryName] = useState("Fashion");
  const [subCategory, setSubCategory] = useState("Men's Clothing");
  const [basePriceNaira, setBasePriceNaira] = useState("");
  const [compareAtNaira, setCompareAtNaira] = useState("");
  const [costPriceNaira, setCostPriceNaira] = useState("");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [isFeatured, setIsFeatured] = useState(false);
  const [imageUrl, setImageUrl] = useState("/products/denim_jacket.png");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("Fashion, Men, Casual");

  const [variants, setVariants] = useState<VariantRow[]>([
    { size: "S", color: "Black", color_hex: "#111827", sku: "", quantity: 15 },
    { size: "M", color: "Black", color_hex: "#111827", sku: "", quantity: 25 },
    { size: "L", color: "Black", color_hex: "#111827", sku: "", quantity: 20 },
    { size: "XL", color: "Black", color_hex: "#111827", sku: "", quantity: 10 },
  ]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setSlug(initialData.slug || "");
      setSku(initialData.sku || "");
      setBrand(initialData.brand || "GTS");
      setCategoryName(initialData.category_name || "Fashion");
      setSubCategory(initialData.sub_category || "");
      setBasePriceNaira(initialData.base_price_naira || "");
      setCompareAtNaira(initialData.compare_at_naira || "");
      setCostPriceNaira(initialData.cost_price_naira || "");
      setStatus(initialData.status || "active");
      setIsFeatured(initialData.is_featured || false);
      setImageUrl(initialData.image_url || "/products/denim_jacket.png");
      setShortDescription(initialData.short_description || "");
      setDescription(initialData.description || "");
      setTags(initialData.tags || "");
      if (initialData.variants && initialData.variants.length > 0) {
        setVariants(initialData.variants);
      }
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  const resetForm = () => {
    setName("");
    setSlug("");
    setSku("");
    setBrand("GTS");
    setCategoryName("Fashion");
    setSubCategory("Men's Clothing");
    setBasePriceNaira("");
    setCompareAtNaira("");
    setCostPriceNaira("");
    setStatus("active");
    setIsFeatured(false);
    setImageUrl("/products/denim_jacket.png");
    setShortDescription("");
    setDescription("");
    setTags("Fashion, Men, Casual");
    setVariants([
      { size: "S", color: "Black", color_hex: "#111827", sku: "", quantity: 15 },
      { size: "M", color: "Black", color_hex: "#111827", sku: "", quantity: 25 },
      { size: "L", color: "Black", color_hex: "#111827", sku: "", quantity: 20 },
      { size: "XL", color: "Black", color_hex: "#111827", sku: "", quantity: 10 },
    ]);
    setErrorMsg("");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!initialData?.id) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      );
      if (!sku) {
        const prefix = val
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 4);
        setSku(`GTS-${prefix || "PRD"}-${Math.floor(Math.random() * 90 + 10)}`);
      }
    }
  };

  // Profit Margin Live Calculations
  const baseNum = parseFloat(basePriceNaira) || 0;
  const costNum = parseFloat(costPriceNaira) || 0;
  const profitNum = baseNum - costNum;
  const marginPct = baseNum > 0 && costNum > 0 ? Math.round((profitNum / baseNum) * 100) : null;

  const handleAddVariantRow = () => {
    setVariants([
      ...variants,
      { size: "M", color: "Black", color_hex: "#111827", sku: "", quantity: 10 },
    ]);
  };

  const handleRemoveVariantRow = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index: number, field: keyof VariantRow, val: any) => {
    const next = [...variants];
    next[index] = { ...next[index]!, [field]: val };
    setVariants(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Product name is required.");
      return;
    }
    if (!basePriceNaira || isNaN(baseNum) || baseNum <= 0) {
      setErrorMsg("Please enter a valid base price.");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("gts_token");
      const isEdit = Boolean(initialData?.id);
      const url = "http://localhost:3000/api/v1/products";
      const method = isEdit ? "PUT" : "POST";

      const payload: any = {
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        sku: sku.trim(),
        brand: brand.trim(),
        base_price: Math.round(baseNum * 100), // Kobo
        compare_at_price: compareAtNaira ? Math.round(parseFloat(compareAtNaira) * 100) : null,
        cost_price: costNum ? Math.round(costNum * 100) : null,
        status,
        is_featured: isFeatured,
        image_url: imageUrl.trim(),
        short_description: shortDescription.trim(),
        description: description.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        variants,
      };

      if (isEdit) {
        payload.id = initialData!.id;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save product.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-[#181818] h-full overflow-y-auto border-l border-gray-200 dark:border-[#262626] shadow-2xl flex flex-col justify-between font-sans">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-[#262626] flex items-center justify-between sticky top-0 bg-white/95 dark:bg-[#181818]/95 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {initialData?.id ? "Edit Product" : "Create New Product"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#8E8E8E]">
              Fill product attributes, pricing, variants, and inventory details
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Content */}
        <form id="productForm" onSubmit={handleSubmit} className="p-5 space-y-6 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 font-mono text-xs">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* 1. General Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#9E7B00] dark:text-[#EDCF5D]">
              1. General Details
            </h3>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Product Title / Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. GTS Vintage Denim Jacket"
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Slug (URL Path)
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="gts-vintage-denim-jacket"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white font-mono text-[11px] placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-gray-700 dark:text-gray-300">
                    SKU (Stock Keeping Unit)
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Auto-generated
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={sku || "Auto-assigned"}
                    className="w-full pl-3 pr-7 py-2 rounded-lg bg-gray-100 dark:bg-[#1C1C1C] border border-gray-200 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400 font-mono text-[11px] cursor-not-allowed select-all focus:outline-none"
                  />
                  <svg className="w-3 h-3 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="GTS"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white focus:outline-none focus:border-[#EDCF5D] cursor-pointer"
                >
                  <option value="Fashion">Fashion</option>
                  <option value="Phones & Tablets">Phones & Tablets</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Gaming">Gaming</option>
                  <option value="Appliances">Appliances</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Sub-Category
                </label>
                <input
                  type="text"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  placeholder="e.g. Men's Clothing"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-700 dark:text-gray-300">Publish Status:</span>
                {(["active", "draft", "archived"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                      status === st
                        ? "bg-[#EDCF5D] text-[#121316]"
                        : "bg-gray-100 dark:bg-[#222222] text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded text-[#9E7B00] dark:text-[#EDCF5D] focus:ring-[#EDCF5D]"
                />
                <span className="font-bold text-gray-700 dark:text-gray-300 text-xs">
                  ★ Featured Product
                </span>
              </label>
            </div>
          </div>

          {/* 2. Pricing & Live Margin Calculator */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-[#262626]">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#9E7B00] dark:text-[#EDCF5D]">
              2. Pricing & Live Profit Engine
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Base Price (₦) *
                </label>
                <input
                  type="number"
                  required
                  value={basePriceNaira}
                  onChange={(e) => setBasePriceNaira(e.target.value)}
                  placeholder="32400"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white font-mono font-bold placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Compare At Price (₦)
                </label>
                <input
                  type="number"
                  value={compareAtNaira}
                  onChange={(e) => setCompareAtNaira(e.target.value)}
                  placeholder="64800"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white font-mono placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Cost Price (₦) [Admin Only]
                </label>
                <input
                  type="number"
                  value={costPriceNaira}
                  onChange={(e) => setCostPriceNaira(e.target.value)}
                  placeholder="13600"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white font-mono placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>
            </div>

            {/* Profit Live Engine Indicator Card */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#262626] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-gray-500 dark:text-[#8E8E8E] block">
                  Profit Margin Intelligence
                </span>
                <p className="text-xs font-mono font-bold text-gray-900 dark:text-white mt-0.5">
                  Expected Profit:{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ₦{profitNum > 0 ? profitNum.toLocaleString() : "0"}
                  </span>
                </p>
              </div>

              <div>
                {marginPct !== null ? (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                      marginPct >= 50
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : marginPct >= 30
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30"
                    }`}
                  >
                    {marginPct}% Margin
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-gray-400">
                    Enter cost price to calculate margin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Media Upload */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-[#262626]">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#9E7B00] dark:text-[#EDCF5D]">
              3. Product Image Media
            </h3>

            <div className="flex gap-3 items-center">
              <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] shrink-0 overflow-hidden flex items-center justify-center relative">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-[10px] text-gray-400">No Image</span>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <label className="block font-bold text-gray-700 dark:text-gray-300">
                  Primary Image Path / URL
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="/products/denim_jacket.png"
                  className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white font-mono text-xs placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
                />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-gray-500 dark:text-[#8E8E8E] block mb-1">
                Quick Select Storefront Mock Images:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_IMAGES.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImageUrl(img.url)}
                    className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-[10px] font-mono text-gray-700 dark:text-gray-300 hover:bg-[#EDCF5D] hover:text-[#121316] transition-colors cursor-pointer"
                  >
                    {img.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Variant & Stock Matrix Builder */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-[#262626]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#9E7B00] dark:text-[#EDCF5D]">
                4. Variants & Stock Matrix ({variants.length})
              </h3>
              <button
                type="button"
                onClick={handleAddVariantRow}
                className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] text-[10px] font-mono font-bold text-gray-700 dark:text-gray-200 hover:bg-[#EDCF5D] hover:text-[#121316] transition-colors cursor-pointer"
              >
                + Add Variant Row
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-mono font-bold text-gray-400 dark:text-[#666666] px-1">
                <span className="col-span-3">Size</span>
                <span className="col-span-4">Color Name</span>
                <span className="col-span-2">Hex</span>
                <span className="col-span-2 text-right">Stock Qty</span>
                <span className="col-span-1 text-center"></span>
              </div>

              {variants.map((varRow, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={varRow.size}
                      onChange={(e) => handleVariantChange(idx, "size", e.target.value)}
                      placeholder="S / 41 / 128GB"
                      className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white font-mono text-xs focus:outline-none focus:border-[#EDCF5D]"
                    />
                  </div>

                  <div className="col-span-4">
                    <input
                      type="text"
                      value={varRow.color}
                      onChange={(e) => handleVariantChange(idx, "color", e.target.value)}
                      placeholder="Jet Black"
                      className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white text-xs focus:outline-none focus:border-[#EDCF5D]"
                    />
                  </div>

                  <div className="col-span-2 flex items-center gap-1">
                    <input
                      type="color"
                      value={varRow.color_hex || "#111827"}
                      onChange={(e) => handleVariantChange(idx, "color_hex", e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                    <span className="text-[9px] font-mono text-gray-400 uppercase truncate">
                      {varRow.color_hex}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      value={varRow.quantity}
                      onChange={(e) =>
                        handleVariantChange(idx, "quantity", parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white font-mono font-bold text-xs text-right focus:outline-none focus:border-[#EDCF5D]"
                    />
                  </div>

                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveVariantRow(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Editorial Description & Tags */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-[#262626]">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#9E7B00] dark:text-[#EDCF5D]">
              5. Editorial & Tags
            </h3>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Fashion, Men, Casual, Outerwear"
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white text-xs placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Full Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Heavyweight cotton denim jacket featuring a classic vintage wash..."
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white text-xs placeholder-gray-400 focus:outline-none focus:border-[#EDCF5D]"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-[#262626] bg-white dark:bg-[#181818] flex items-center justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-gray-400 font-bold hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#222222] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="productForm"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#010101] text-white dark:bg-[#EDCF5D] dark:text-[#121316] hover:bg-[#EDCF5D] hover:text-[#010101] dark:hover:bg-white font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving Product..." : initialData?.id ? "Update Product" : "Save & Publish Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
