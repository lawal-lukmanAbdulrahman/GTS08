"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ProductItem } from "./page";

interface ProductInfoDrawerProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: ProductItem) => void;
}

function getVariantImageForColor(color: string = "", defaultImg: string = "", productName: string = ""): string {
  const c = color.toLowerCase();
  const p = productName.toLowerCase();

  // Nexus Washing Machine
  if (p.includes("nexus") || p.includes("wash") || p.includes("twin tub")) {
    if (c.includes("blue") || c.includes("royal")) return "/products/hero/nexus_washing_machine_blue.png";
    if (c.includes("grey") || c.includes("gray") || c.includes("metallic")) return "/products/hero/nexus_washing_machine_grey.png";
    if (c.includes("white") || c.includes("classic")) return "/products/hero/nexus_washing_machine_white.png";
    if (c.includes("green") || c.includes("mint")) return "/products/hero/nexus_washing_machine_green.png";
    if (c.includes("yellow") || c.includes("solar")) return "/products/hero/nexus_washing_machine_yellow.png";
  }

  // Samsung Fridge
  if (p.includes("samsung") || p.includes("fridge") || p.includes("refrigerator") || p.includes("bespoke")) {
    if (c.includes("black") || c.includes("matte")) return "/products/hero/samsung_fridge_black.png";
    if (c.includes("grey") || c.includes("gray") || c.includes("silver") || c.includes("metallic")) return "/products/hero/samsung_fridge_grey.png";
    if (c.includes("white") || c.includes("cream") || c.includes("classic")) return "/products/hero/samsung_fridge_white.png";
    if (c.includes("bronze") || c.includes("tuscan") || c.includes("brown")) return "/products/hero/samsung_fridge_bronze.png";
  }

  // Pixel 10 Pro
  if (p.includes("pixel")) {
    if (c.includes("metal") || c.includes("titanium") || c.includes("silver")) return "/products/hero/pixel_10_metal.png";
    if (c.includes("green") || c.includes("hazel")) return "/products/hero/pixel_10_green.png";
    if (c.includes("purple") || c.includes("obsidian")) return "/products/hero/pixel_10_purple.png";
    if (c.includes("red") || c.includes("coral")) return "/products/hero/pixel_10_red.png";
  }

  // Air Jordan
  if (p.includes("jordan")) {
    if (c.includes("blue") || c.includes("royal")) return "/products/hero/air_jordan_retro_1_blue.png";
    if (c.includes("red") || c.includes("chicago")) return "/products/hero/air_jordan_retro_1_red.png";
    if (c.includes("black") || c.includes("shadow")) return "/products/hero/air_jordan_retro_1_black.png";
  }

  return defaultImg;
}

function getColorHex(colorName: string, fallbackHex?: string): string {
  if (fallbackHex && fallbackHex !== "#111827" && fallbackHex !== "#000000") return fallbackHex;
  const c = colorName.toLowerCase();
  if (c.includes("blue") || c.includes("royal")) return "#2563EB";
  if (c.includes("grey") || c.includes("gray") || c.includes("silver") || c.includes("metallic")) return "#6B7280";
  if (c.includes("white") || c.includes("cream") || c.includes("classic")) return "#FFFFFF";
  if (c.includes("green") || c.includes("mint") || c.includes("hazel")) return "#10B981";
  if (c.includes("yellow") || c.includes("solar")) return "#F59E0B";
  if (c.includes("bronze") || c.includes("tuscan") || c.includes("brown")) return "#78350F";
  if (c.includes("purple") || c.includes("obsidian")) return "#7C3AED";
  if (c.includes("red") || c.includes("coral") || c.includes("chicago")) return "#DC2626";
  if (c.includes("black") || c.includes("matte") || c.includes("shadow")) return "#181818";
  return fallbackHex || "#3B82F6";
}

const sampleCustomerReviews = [
  {
    id: "r1",
    name: "Helen M.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    date: "Yesterday",
    rating: 5,
    comment: "Absolutely incredible quality! Fast delivery and exceeded all expectations. 10/10 purchase.",
    likes: 42,
  },
  {
    id: "r2",
    name: "Ann D.",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    date: "2 days ago",
    rating: 5,
    comment: "Super durable build quality. Premium feel and beautiful finish. Very satisfied with GTS!",
    likes: 35,
  },
  {
    id: "r3",
    name: "Andrew G.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    date: "4 days ago",
    rating: 4,
    comment: "Great product. Performs exactly as advertised. Would definitely recommend to others.",
    likes: 18,
  },
];

export default function ProductInfoDrawer({
  product,
  isOpen,
  onClose,
  onEdit,
}: ProductInfoDrawerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Zoom Lightbox Modal States
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setSelectedColor(null);
      setSelectedSize(null);
      setIsZoomOpen(false);
      setZoomScale(1);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const primaryImg = product.primary_image?.cloudinary_id || "/products/denim_jacket.png";

  // Build color variant image mappings & gallery list
  const variantColorImages: { [colorName: string]: string } = {};
  const galleryImages: string[] = [primaryImg];
  const colorVariantThumbnails: { color?: string; hex?: string; img: string }[] = [];

  (product.variants || []).forEach((v: any) => {
    const rawImg = v.image_url || primaryImg;
    const colorName = v.color || "Default";
    const resolvedImg = getVariantImageForColor(colorName, rawImg, product.name);
    const resolvedHex = getColorHex(colorName, v.color_hex);

    if (v.color) {
      variantColorImages[v.color] = resolvedImg;
      if (!galleryImages.includes(resolvedImg)) {
        galleryImages.push(resolvedImg);
      }
    }
    const exists = colorVariantThumbnails.some((item) => item.color === v.color);
    if (!exists) {
      colorVariantThumbnails.push({
        color: colorName,
        hex: resolvedHex,
        img: resolvedImg,
      });
    }
  });

  if (colorVariantThumbnails.length === 0) {
    colorVariantThumbnails.push({
      color: "Default",
      hex: "#111827",
      img: primaryImg,
    });
  }

  // Active Main Showcase Image
  const activeImg = selectedImage || (selectedColor && variantColorImages[selectedColor]) || primaryImg;

  const formatNaira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");
  const totalStock = product.total_quantity !== undefined ? product.total_quantity : product.in_stock ? 12 : 0;
  const totalSold = product.total_sold || 18;

  // Financial Calculations for Admin Metrics
  const basePriceKobo = product.base_price || 0;
  const costPriceKobo = product.cost_price || Math.round(basePriceKobo * 0.7);
  const profitPerUnitKobo = Math.max(0, basePriceKobo - costPriceKobo);
  const totalRevenueKobo = totalSold * basePriceKobo;
  const totalProfitKobo = totalSold * profitPerUnitKobo;
  const profitMarginPct = basePriceKobo > 0 ? Math.round((profitPerUnitKobo / basePriceKobo) * 100) : 30;

  // Unique colors and sizes
  const uniqueColors: { color: string; hex: string; img?: string }[] = Array.from(
    new Map(
      (product.variants || []).map((v: any) => [
        v.color,
        { color: v.color, hex: v.color_hex || "#111827", img: v.image_url },
      ])
    ).values()
  );

  // Group and aggregate stock quantities by unique size label
  const sizeMap = new Map<string, number>();

  (product.variants || []).forEach((v: any) => {
    if (selectedColor && v.color && v.color.toLowerCase() !== selectedColor.toLowerCase()) {
      return;
    }
    const sz = (v.size || "Standard").trim();
    const qty = v.quantity !== undefined ? v.quantity : v.available !== undefined ? v.available : 10;
    sizeMap.set(sz, (sizeMap.get(sz) || 0) + qty);
  });

  if (sizeMap.size === 0) {
    (product.variants || []).forEach((v: any) => {
      const sz = (v.size || "Standard").trim();
      const qty = v.quantity !== undefined ? v.quantity : v.available !== undefined ? v.available : 10;
      sizeMap.set(sz, (sizeMap.get(sz) || 0) + qty);
    });
  }

  const uniqueSizes: { size: string; qty: number }[] = Array.from(sizeMap.entries()).map(([size, qty]) => ({
    size,
    qty,
  }));

  // Handle color click (switches active image if color variant has image)
  const handleSelectColor = (c: { color: string; hex: string; img?: string }) => {
    setSelectedColor(c.color);
    if (c.img) {
      setSelectedImage(c.img);
    } else if (variantColorImages[c.color]) {
      setSelectedImage(variantColorImages[c.color] || null);
    }
  };

  // Lightbox Navigation
  const handleOpenZoom = (img: string) => {
    const idx = galleryImages.indexOf(img);
    setZoomIndex(idx >= 0 ? idx : 0);
    setZoomScale(1);
    setIsZoomOpen(true);
  };

  const handleNextZoom = () => {
    setZoomIndex((prev) => (prev + 1) % galleryImages.length);
    setZoomScale(1);
  };

  const handlePrevZoom = () => {
    setZoomIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
    setZoomScale(1);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Slide-over WIDER Side-by-Side Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-12">
        <div className="w-screen max-w-4xl lg:max-w-5xl bg-white dark:bg-[#151515] border-l border-gray-200 dark:border-[#262626] shadow-2xl flex flex-col justify-between animate-slideLeft">
          
          {/* Drawer Top Header Bar */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#242424] flex items-center justify-between bg-white dark:bg-[#151515] sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  product.status === "active"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : product.status === "draft"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-gray-200 dark:bg-[#333333] text-gray-600 dark:text-gray-400"
                }`}
              >
                {product.status}
              </span>
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                SKU: {product.sku || product.slug}
              </span>
              {product.brand && (
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-gray-100 dark:bg-[#222222] text-[10px] font-bold uppercase text-gray-700 dark:text-gray-300">
                  {product.brand}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/admin/products/${product.id}/edit`}
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                <span>Edit Product</span>
              </Link>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#242424] text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawer Body (Side-by-Side 2-Column Grid Layout) */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* ────── LEFT COLUMN (Col-6): STOREFRONT IMAGE SHOWCASE & GALLERY ────── */}
              <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-4">
                
                {/* Main Showcase Image Box */}
                <div
                  onClick={() => handleOpenZoom(activeImg)}
                  className="w-full h-80 sm:h-96 rounded-2xl bg-gradient-to-b from-gray-100 to-gray-200 dark:from-[#202020] dark:to-[#161616] border border-gray-200/80 dark:border-[#2A2A2A] overflow-hidden relative shadow-inner group cursor-zoom-in flex items-center justify-center"
                >
                  <img
                    src={activeImg}
                    alt={product.name}
                    className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Color Variant Image Thumbnails Strip (Matching Storefront Product Detail Page) */}
                <div className="flex items-center gap-3.5 overflow-x-auto p-2" style={{ scrollbarWidth: "none" }}>
                  {colorVariantThumbnails.map((item, idx) => {
                    const isSelected = activeImg === item.img || selectedColor === item.color;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedImage(item.img);
                          if (item.color) setSelectedColor(item.color);
                        }}
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border flex items-center justify-center shrink-0 transition-all relative p-1.5 cursor-pointer ${
                          isSelected
                            ? "border-2 border-gray-900 dark:border-white bg-[#ECEAE6] dark:bg-[#252525] shadow-md scale-105"
                            : "border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#1E1E1E] opacity-80 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-[#242424]"
                        }`}
                        title={item.color || `Image ${idx + 1}`}
                      >
                        <img src={item.img} alt={item.color || "Product variant"} className="w-full h-full object-contain" />
                        
                        {/* Circular Color Badge in Bottom-Left Corner */}
                        {item.hex && (
                          <span
                            className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full border-2 border-white dark:border-[#151515] shadow-xs flex items-center justify-center text-[8px] font-black text-white shrink-0"
                            style={{ backgroundColor: item.hex }}
                          >
                            {item.color ? item.color.charAt(0).toUpperCase() : ""}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ────── RIGHT COLUMN (Col-6): STOREFRONT DETAILS & ADMIN ANALYTICS ────── */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* Title & Pricing Header */}
                <div className="space-y-2 border-b border-gray-100 dark:border-[#242424] pb-4">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-[#EDCF5D] uppercase tracking-wider block">
                    {product.brand ? `${product.brand} · ` : ""}{product.category?.name || "General Catalog"}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    {product.name}
                  </h2>

                  <div className="flex items-baseline gap-3 pt-1">
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight font-sans">
                      {formatNaira(product.base_price)}
                    </span>
                    {product.compare_at_price && product.compare_at_price > product.base_price && (
                      <span className="text-sm text-gray-400 line-through font-mono">
                        {formatNaira(product.compare_at_price)}
                      </span>
                    )}
                  </div>

                  {/* Storefront Star Rating Row */}
                  <div className="flex items-center gap-2 text-xs pt-1">
                    <div className="flex items-center text-[#EDCF5D] text-sm">
                      ★★★★★
                    </div>
                    <span className="font-extrabold text-gray-900 dark:text-white">4.8</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                      1,900 customer reviews
                    </span>
                  </div>
                </div>

                {/* ────── ADMIN FINANCIAL & SALES METRICS CARDS ────── */}
                <div className="space-y-3">

                  <div className="grid grid-cols-2 gap-3">
                    {/* Revenue Card */}
                    <div className="p-3.5 rounded-[6px] bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-emerald-500/20 text-xs space-y-1">
                      <span className="text-[10.5px] uppercase font-mono text-gray-500 dark:text-gray-400 block">Total Revenue Made</span>
                      <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400 block">
                        {formatNaira(totalRevenueKobo)}
                      </span>
                      <span className="text-[10px] text-gray-400 block font-mono">
                        {totalSold} units sold total
                      </span>
                    </div>

                    {/* Profit Margin Card */}
                    <div className="p-3.5 rounded-[6px] bg-gradient-to-br from-amber-500/10 via-transparent to-transparent border border-amber-500/20 text-xs space-y-1">
                      <span className="text-[10.5px] uppercase font-mono text-gray-500 dark:text-gray-400 block">Net Profit / Unit</span>
                      <span className="font-extrabold text-base text-amber-600 dark:text-amber-400 block">
                        {formatNaira(profitPerUnitKobo)}
                      </span>
                      <span className="text-[10px] text-emerald-500 font-bold block font-mono">
                        +{profitMarginPct}% Profit Margin
                      </span>
                    </div>
                  </div>

                  {/* Stock Velocity & Inventory Status */}
                  <div
                    className={`p-3.5 rounded-[6px] border flex items-center justify-between text-xs transition-all ${
                      totalStock <= 5
                        ? "bg-gradient-to-br from-red-500/10 via-red-500/[0.03] to-transparent border-red-500/25 dark:border-red-500/30"
                        : "bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border-emerald-500/20"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono text-gray-500 dark:text-gray-400 block">
                        Warehouse Stock Run-Rate
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white block">
                        {totalStock === 0 ? "Out of Stock" : `${totalStock} Units Remaining`}
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                        totalStock === 0
                          ? "bg-red-500/15 text-red-500 border border-red-500/20"
                          : totalStock <= 5
                          ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20"
                          : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20"
                      }`}
                    >
                      {totalStock === 0 ? "Urgent Restock" : totalStock <= 5 ? "Low Stock Alert" : "Healthy Stock"}
                    </span>
                  </div>
                </div>

                {/* Available Sizes Matrix */}
                {uniqueSizes.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-900 dark:text-gray-200 block uppercase tracking-wider text-[10.5px]">
                      Available Sizes & Inventory Breakdown
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {uniqueSizes.map((sz, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedSize(sz.size)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedSize === sz.size || (i === 0 && !selectedSize)
                              ? "border-[#EDCF5D] bg-[#EDCF5D] text-black shadow-xs"
                              : "border-gray-200 dark:border-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#242424]"
                          }`}
                        >
                          <span>{sz.size}</span>
                          <span className="text-[10px] opacity-75 font-mono">({sz.qty})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product Description */}
                <div className="space-y-2 border-t border-gray-100 dark:border-[#242424] pt-4">
                  <label className="text-xs font-bold text-gray-900 dark:text-gray-200 block uppercase tracking-wider text-[10.5px]">
                    Product Overview & Description
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-sans">
                    {product.description ||
                      product.short_description ||
                      "High quality inventory item registered in GTS store management system."}
                  </p>
                </div>

                {/* Taxonomy Tags */}
                {product.tags && product.tags.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-900 dark:text-gray-200 block uppercase tracking-wider text-[10.5px]">
                      Tags & Taxonomy
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {product.tags.map((tg: string, i: number) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-[#222222] border border-gray-200/60 dark:border-[#303030] text-[11px] font-mono text-gray-600 dark:text-gray-400"
                        >
                          #{tg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ────── STOREFRONT REVIEWS & CUSTOMER COMMENTS ────── */}
                <div className="space-y-4 border-t border-gray-100 dark:border-[#242424] pt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-900 dark:text-gray-200 uppercase tracking-wider text-[10.5px]">
                      Customer Reviews & Feedback (1.9k)
                    </h3>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <span>4.8</span>
                      <span className="text-[#EDCF5D]">★★★★★</span>
                    </div>
                  </div>

                  {/* Vertical Reviews List matching storefront Image 2 */}
                  <div className="space-y-4 divide-y divide-gray-100 dark:divide-[#242424]">
                    {sampleCustomerReviews.map((rev, i) => (
                      <div key={rev.id} className={`${i > 0 ? "pt-4" : ""} flex gap-3 items-start`}>
                        {/* Avatar */}
                        <img
                          src={rev.avatar}
                          alt={rev.name}
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200 dark:border-[#333333]"
                        />

                        {/* Review Body */}
                        <div className="space-y-1 flex-1 min-w-0">
                          {/* Name & Timestamp */}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 dark:text-white">
                              {rev.name}
                            </span>
                            <span className="text-[11px] text-gray-400 font-normal">
                              {rev.date}
                            </span>
                          </div>

                          {/* Star Rating */}
                          <div className="flex items-center text-[#EDCF5D] text-xs">
                            {"★".repeat(rev.rating)}
                            {"☆".repeat(5 - rev.rating)}
                          </div>

                          {/* Comment Text */}
                          <p className="text-xs text-gray-800 dark:text-gray-200 font-semibold pt-0.5 leading-relaxed">
                            {rev.comment}
                          </p>

                          {/* Action Bar (Reply, Thumbs Up, Thumbs Down) */}
                          <div className="flex items-center gap-4 text-[11px] text-gray-400 font-medium pt-1">
                            <button className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer">
                              Reply
                            </button>
                            <button className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.5a4.5 4.5 0 01-4.5-4.5V10.5z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 10.5H3.75a.75.75 0 00-.75.75v8.25c0 .414.336.75.75.75h3" />
                              </svg>
                              <span>{rev.likes}</span>
                            </button>
                            <button className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.367 13.5c-.806 0-1.533.446-2.031 1.08a9.041 9.041 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75A2.25 2.25 0 017.5 19.5c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 012.25 12c0-2.825.976-5.424 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h5.996a4.5 4.5 0 014.5 4.5v5.25z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 13.5h3a.75.75 0 00.75-.75V4.5a.75.75 0 00-.75-.75h-3" />
                              </svg>
                              <span>0</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>



        </div>
      </div>

      {/* ────── INTERACTIVE ZOOM LIGHTBOX MODAL ────── */}
      {isZoomOpen && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col justify-between animate-fadeIn font-sans">
          
          {/* Lightbox Top Control Bar */}
          <div className="px-6 py-4 flex items-center justify-between text-white border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400">
                Image {zoomIndex + 1} of {galleryImages.length}
              </span>
              <span className="text-xs font-bold text-white truncate max-w-xs">
                {product.name}
              </span>
            </div>

            {/* Zoom & Navigation Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomScale((s) => Math.max(1, s - 0.5))}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                - Zoom
              </button>
              <span className="text-xs font-mono text-gray-300 w-12 text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((s) => Math.min(3.5, s + 0.5))}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                + Zoom
              </button>
              <button
                onClick={() => setZoomScale(1)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer ml-2"
                title="Reset Zoom"
              >
                Reset
              </button>
              <button
                onClick={() => setIsZoomOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer ml-4"
                title="Close Lightbox (ESC)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Lightbox Center Zoom Container */}
          <div
            className="flex-1 relative flex items-center justify-center p-8 overflow-hidden cursor-grab active:cursor-grabbing"
            onDoubleClick={() => setZoomScale((s) => (s > 1 ? 1 : 2.5))}
            onWheel={(e) => {
              if (e.deltaY < 0) {
                setZoomScale((s) => Math.min(3.5, s + 0.2));
              } else {
                setZoomScale((s) => Math.max(1, s - 0.2));
              }
            }}
          >
            {/* Prev Image Arrow */}
            {galleryImages.length > 1 && (
              <button
                onClick={handlePrevZoom}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-xl font-bold transition-all z-20 cursor-pointer"
              >
                ‹
              </button>
            )}

            {/* Main Zoomed Image */}
            <div
              className="transition-transform duration-200 ease-out max-w-full max-h-full flex items-center justify-center"
              style={{ transform: `scale(${zoomScale})` }}
            >
              <img
                src={galleryImages[zoomIndex] || activeImg}
                alt={product.name}
                className="max-h-[75vh] max-w-[85vw] object-contain drop-shadow-2xl select-none"
              />
            </div>

            {/* Next Image Arrow */}
            {galleryImages.length > 1 && (
              <button
                onClick={handleNextZoom}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-xl font-bold transition-all z-20 cursor-pointer"
              >
                ›
              </button>
            )}
          </div>

          {/* Lightbox Bottom Thumbnails Strip */}
          {galleryImages.length > 1 && (
            <div className="px-6 py-4 bg-black/60 border-t border-white/10 flex items-center justify-center gap-3 overflow-x-auto">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setZoomIndex(idx);
                    setZoomScale(1);
                  }}
                  className={`w-14 h-14 rounded-xl border overflow-hidden transition-all cursor-pointer p-1 shrink-0 ${
                    zoomIndex === idx
                      ? "border-[#EDCF5D] ring-2 ring-[#EDCF5D] scale-110 bg-white/10"
                      : "border-white/20 opacity-50 hover:opacity-100 bg-black/40"
                  }`}
                >
                  <img src={img} alt="Thumb" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
