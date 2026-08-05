"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, use, useRef, useEffect } from "react";
import { Footer } from "../../_components/landing/footer";
import { ProductCard } from "../../_components/ui/product-card";
import { getProductById, REAL_PRODUCTS } from "../../_data/products";
import { useCart } from "../../_components/cart-context";
import { useWishlist } from "../../_components/wishlist-context";
import { ProductZoomLightbox } from "../../_components/ui/product-zoom-lightbox";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const product = getProductById(slug) || REAL_PRODUCTS[0]!;
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState(product.sizes[1] || product.sizes[0]);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const isWishlisted = isInWishlist(product.id);

  const handleToggleWishlist = () => {
    toggleWishlist(product.id);
  };

  const activeColor = product.images[selectedColorIndex] || product.images[0]!;
  const activeMainImage =
    activeColor.thumbnails[selectedImageIndex] || activeColor.main;
  const hasTransparentBg = product.hasTransparentBg !== false;

  const handleAddToCart = () => {
    addToCart(product, selectedSize, activeColor.label, quantity);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white text-[#010101]">

      {/* ── Two-Column Product Layout ── */}
      <div className="w-full px-5 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">

          {/* ── LEFT: Sticky panel on desktop (breadcrumb + image + thumbnails) ── */}
          <div className="lg:col-span-7 flex flex-col gap-3 sm:gap-4 lg:sticky lg:top-[100px] lg:h-[calc(100vh-100px)] pb-3">
            {/* Breadcrumb — pinned here so it sticks with the image */}
            <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-gray-500 font-medium flex items-center gap-2 flex-wrap shrink-0 pt-2 font-sans">
              <Link href="/" className="hover:text-[#010101] transition-colors">Home</Link>
              <span>›</span>
              <Link href={`/search?category=${encodeURIComponent(product.category)}`} className="hover:text-[#010101] transition-colors">
                {product.category}
              </Link>
              <span>›</span>
              <Link href={`/search?category=${encodeURIComponent(product.category)}&q=${encodeURIComponent(product.subCategory)}`} className="hover:text-[#010101] transition-colors text-gray-500">
                {product.subCategory}
              </Link>
              <span>›</span>
              <Link href={`/search?brand=${encodeURIComponent(product.brand)}`} className="text-[#010101] font-bold hover:underline transition-all">
                {product.brand}
              </Link>
            </nav>

            {/* Main Showcase Image Box — compact half-height on mobile so details peek out below */}
            <div
              onClick={() => setIsZoomOpen(true)}
              className={`w-full h-[290px] sm:h-[380px] lg:h-auto lg:flex-1 lg:min-h-0 rounded-[24px] sm:rounded-[32px] overflow-hidden relative border border-gray-200/80 shadow-2xs group transition-all cursor-zoom-in shrink-0 lg:shrink ${
                hasTransparentBg ? "" : "bg-[#F2F0EA]"
              }`}
              style={
                hasTransparentBg
                  ? { background: "radial-gradient(ellipse at center, #ECEAE6 0%, #DDDAD4 100%)" }
                  : undefined
              }
            >
              <Image
                src={activeMainImage}
                alt={product.title}
                fill
                className={`group-hover:scale-105 transition-transform duration-300 drop-shadow-xl ${
                  hasTransparentBg
                    ? "object-contain p-6 sm:p-12"
                    : "object-cover p-0"
                }`}
                sizes="(max-width: 1024px) 100vw, 58vw"
                priority
              />
            </div>

            {/* Thumbnail Row — always pinned at bottom, no clip on selected */}
            <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto shrink-0 py-0.5" style={{ scrollbarWidth: "none" }}>
              {activeColor.thumbnails.map((thumb, idx) => {
                const isSelected = selectedImageIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 sm:w-24 sm:h-24 rounded-2xl border flex items-center justify-center shrink-0 transition-all overflow-hidden relative ${
                      hasTransparentBg ? "p-1.5" : "p-0"
                    } ${
                      isSelected
                        ? "border-2 border-[#010101] bg-[#ECEAE6] shadow-md"
                        : "border-gray-200 bg-[#F9F8F5] hover:bg-[#F2F0EA]"
                    }`}
                  >
                    <Image
                      src={thumb}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      className={hasTransparentBg ? "object-contain p-1.5" : "object-cover p-0"}
                    />
                  </button>
                );
              })}

              {/* +4 More Placeholder */}
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl border border-gray-200 bg-[#F9F8F5] flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 cursor-pointer hover:bg-gray-100 transition-colors">
                +4 more
              </div>
            </div>
          </div>

          {/* ── RIGHT: Normal page-flow content ── */}
          <div className="lg:col-span-5 space-y-6 lg:pt-[38px]">
            {/* Top Brand & SKU Row */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#010101] text-white font-black text-xs flex items-center justify-center">
                  ✓
                </span>
                <span className="text-sm font-bold text-[#010101] uppercase tracking-wide">
                  {product.brand}
                </span>
              </div>
              <span className="text-xs text-gray-400 font-mono">{product.sku}</span>
            </div>

            {/* Product Title */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#010101] tracking-tight leading-snug">
              {product.title}
            </h1>

            {/* Ratings Row */}
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <div className="flex items-center text-[#EDCF5D]">
                {"★".repeat(Math.floor(product.rating))}
                {"☆".repeat(5 - Math.floor(product.rating))}
              </div>
              <span className="font-bold text-[#010101]">{product.rating}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500 font-medium underline underline-offset-2 cursor-pointer">
                {product.reviewsCount} reviews
              </span>
            </div>

            {/* Price Display */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-extrabold text-[#010101]">
                {product.price}
              </span>
              {product.originalPrice && (
                <span className="text-base sm:text-lg text-gray-400 line-through font-normal">
                  {product.originalPrice}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-600 font-normal leading-relaxed">
              {product.description}
            </p>

            {/* ── Color Selection ── */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-gray-500">
                  Color <span className="text-[#010101] font-bold ml-1">· {activeColor.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                {product.images.map((img, idx) => {
                  const isColorSelected = selectedColorIndex === idx;
                  return (
                    <button
                      key={img.color}
                      onClick={() => {
                        setSelectedColorIndex(idx);
                        setSelectedImageIndex(0);
                      }}
                      className={`w-14 h-14 rounded-xl border flex items-center justify-center p-1.5 transition-all ${
                        isColorSelected
                          ? "border-2 border-[#010101] bg-[#ECEAE6] shadow-2xs scale-105"
                          : "border-gray-200 bg-[#F9F8F5] hover:bg-gray-100"
                      }`}
                    >
                      <Image
                        src={img.main}
                        alt={img.label}
                        width={50}
                        height={50}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Size Selection ── */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-gray-500">
                  Size <span className="text-[#010101] font-bold ml-1">· EU Men</span>
                </span>
                <button className="text-xs text-[#010101] underline font-medium hover:opacity-80">
                  Size guide
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {product.sizes.map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                        isSelected
                          ? "bg-[#010101] text-white border-[#010101] shadow-xs"
                          : "bg-white text-[#010101] border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Add to Cart & Wishlist with Quantity Stepper ── */}
            <div className="pt-2 flex items-center gap-2.5 sm:gap-3">
              {/* Quantity Stepper */}
              <div className="flex items-center gap-3 sm:gap-4 bg-[#F9F8F5] border border-gray-200 rounded-full px-4 py-2.5 shrink-0">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="text-[#010101] hover:text-[#EDCF5D] flex items-center justify-center transition-all active:scale-90 p-1"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>

                <span className="text-sm sm:text-base font-black text-[#010101] min-w-[20px] text-center tabular-nums font-sans">
                  {quantity}
                </span>

                <button
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="text-[#010101] hover:text-[#EDCF5D] flex items-center justify-center transition-all active:scale-90 p-1"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                className="flex-1 bg-[#010101] hover:bg-black text-white font-bold py-3 sm:py-3.5 px-5 rounded-full shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs sm:text-sm font-sans"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span>{addedToCart ? "Added to Cart!" : "Add to cart"}</span>
              </button>

              <button
                aria-label="Add to wishlist"
                onClick={handleToggleWishlist}
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                  isWishlisted
                    ? "bg-[#EDCF5D] border-[#EDCF5D] text-[#010101] shadow-xs"
                    : "bg-[#F9F8F5] border-gray-200 text-[#010101] hover:bg-gray-100"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill={isWishlisted ? "#010101" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            </div>

            {/* ── Delivery Info ── */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 font-medium pb-2 sm:pb-6">
              <svg className="w-4 h-4 text-[#010101] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              <span>Free delivery on orders over ₦30,000</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Product Tabs Section: Details, Reviews, Discussion ── */}
      <ProductTabs rating={product.rating} reviewsCount={product.reviewsCount} />

      {/* ── Similar Finds Section: Landing page style carousel ── */}
      <SimilarFinds />

      {/* ── Product Full-Screen Pan & Zoom Lightbox ── */}
      <ProductZoomLightbox
        isOpen={isZoomOpen}
        onClose={() => setIsZoomOpen(false)}
        images={activeColor.thumbnails}
        initialIndex={selectedImageIndex}
        productTitle={product.title}
        hasTransparentBg={hasTransparentBg}
      />

      <Footer />
    </div>
  );
}

// ─── Reviews Custom Sort Dropdown ─────────────────────────────────────────────
function ReviewsSortDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const options = ["Newest", "Highest Rating", "Lowest Rating"];

  return (
    <div ref={dropdownRef} className="relative inline-block text-left font-sans">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#010101] bg-[#F2F0EA] hover:bg-[#EDCF5D] px-4 py-2 rounded-full transition-colors cursor-pointer select-none"
      >
        <span>{value}</span>
        <svg
          className={`w-3.5 h-3.5 text-[#010101] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden min-w-[175px] animate-in fade-in duration-150 py-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors font-sans flex items-center justify-between cursor-pointer ${
                value === opt
                  ? "bg-[#EDCF5D] text-[#010101]"
                  : "text-[#010101] hover:bg-[#F2F0EA]"
              }`}
            >
              <span>{opt}</span>
              {value === opt && (
                <svg className="w-3.5 h-3.5 text-[#010101]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Product Tabs Component ──────────────────────────────────────────────────
function ProductTabs({ rating, reviewsCount }: { rating: number; reviewsCount: number }) {
  const [activeTab, setActiveTab] = useState<"details" | "reviews" | "discussion">("reviews");
  const [sortOption, setSortOption] = useState("Newest");

  const reviewsList = [
    {
      id: "r1",
      name: "Helen M.",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      date: "Yesterday",
      rating: 5,
      comment: "Excellent running shoes. It turns very sharply on the foot.",
      likes: 42,
      dislikes: 0,
    },
    {
      id: "r2",
      name: "Ann D.",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      date: "2 days ago",
      rating: 4,
      comment: "Good shoes",
      likes: 35,
      dislikes: 2,
    },
    {
      id: "r3",
      name: "Andrew G.",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      date: "2 days ago",
      rating: 5,
      comment: "Is it suitable for running?",
      likes: 18,
      dislikes: 1,
    },
  ];

  const ratingCounts = [
    { stars: 5, count: 28, percentage: 65 },
    { stars: 4, count: 9, percentage: 21 },
    { stars: 3, count: 4, percentage: 9 },
    { stars: 2, count: 1, percentage: 2 },
    { stars: 1, count: 1, percentage: 2 },
  ];

  const [reactions, setReactions] = useState<Record<string, "like" | "dislike" | null>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({
    r1: 42,
    r2: 35,
    r3: 18,
  });
  const [dislikeCounts, setDislikeCounts] = useState<Record<string, number>>({
    r1: 0,
    r2: 2,
    r3: 1,
  });

  const handleLike = (id: string) => {
    const current = reactions[id];
    if (current === "like") {
      setReactions((prev) => ({ ...prev, [id]: null }));
      setLikeCounts((prev) => ({ ...prev, [id]: (prev[id] || 1) - 1 }));
    } else {
      if (current === "dislike") {
        setDislikeCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 1) - 1) }));
      }
      setReactions((prev) => ({ ...prev, [id]: "like" }));
      setLikeCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    }
  };

  const handleDislike = (id: string) => {
    const current = reactions[id];
    if (current === "dislike") {
      setReactions((prev) => ({ ...prev, [id]: null }));
      setDislikeCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 1) - 1) }));
    } else {
      if (current === "like") {
        setLikeCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 1) - 1) }));
      }
      setReactions((prev) => ({ ...prev, [id]: "dislike" }));
      setDislikeCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    }
  };

  return (
    <section className="w-full px-5 md:px-8 pt-2 sm:pt-5 pb-4 mt-2 sm:mt-8">
      {/* ── Tabs Bar — no dividers ── */}
      <div className="flex items-center gap-8 mb-3 sm:mb-6">
        {(["details", "reviews", "discussion"] as const).map((tab) => {
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-lg sm:text-xl font-bold transition-colors capitalize ${
                isActive ? "text-[#010101]" : "text-gray-400 hover:text-gray-600 font-medium"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Permanent 2-Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left Column: Dynamic Tab Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Tab Content: Reviews */}
          {activeTab === "reviews" && (
            <div className="space-y-6">
              {/* Custom GTS Pill Dropdown */}
              <div className="flex items-center justify-between">
                <ReviewsSortDropdown value={sortOption} onChange={setSortOption} />
              </div>

              {/* User Reviews List */}
              <div className="space-y-6 divide-y divide-gray-100">
                {reviewsList.map((rev, i) => (
                  <div key={rev.id} className={`${i > 0 ? "pt-6" : ""} flex gap-3.5 items-start`}>
                    {/* Avatar */}
                    <Image
                      src={rev.avatar}
                      alt={rev.name}
                      width={40}
                      height={40}
                      unoptimized
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200"
                    />

                    {/* Review Content */}
                    <div className="space-y-1.5 flex-1">
                      {/* Name & Timestamp */}
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#010101]">{rev.name}</span>
                        <span className="text-xs text-gray-400 font-normal">{rev.date}</span>
                      </div>

                      {/* Star Rating */}
                      <div className="flex items-center text-[#EDCF5D] text-xs">
                        {"★".repeat(rev.rating)}
                        {"☆".repeat(5 - rev.rating)}
                      </div>

                      {/* Comment text */}
                      <p className="text-xs sm:text-sm text-[#010101] font-semibold pt-0.5 leading-relaxed">
                        {rev.comment}
                      </p>

                      {/* Action Bar: Reply, Thumbs Up SVG, Thumbs Down SVG */}
                      <div className="flex items-center gap-4 text-xs text-gray-400 font-medium pt-1">
                        <button className="hover:text-gray-700 transition-colors">Reply</button>

                        {/* Thumbs Up SVG Icon — Reactive */}
                        <button
                          onClick={() => handleLike(rev.id)}
                          className={`flex items-center gap-1.5 transition-colors ${
                            reactions[rev.id] === "like"
                              ? "text-[#010101] font-bold"
                              : "hover:text-gray-700"
                          }`}
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-current"
                            fill={reactions[rev.id] === "like" ? "currentColor" : "none"}
                            viewBox="0 0 24 24"
                            strokeWidth={1.8}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.5a4.5 4.5 0 01-4.5-4.5V10.5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 10.5H3.75a.75.75 0 00-.75.75v8.25c0 .414.336.75.75.75h3" />
                          </svg>
                          <span>{likeCounts[rev.id] ?? rev.likes}</span>
                        </button>

                        {/* Thumbs Down SVG Icon — Reactive */}
                        <button
                          onClick={() => handleDislike(rev.id)}
                          className={`flex items-center gap-1.5 transition-colors ${
                            reactions[rev.id] === "dislike"
                              ? "text-[#010101] font-bold"
                              : "hover:text-gray-700"
                          }`}
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-current"
                            fill={reactions[rev.id] === "dislike" ? "currentColor" : "none"}
                            viewBox="0 0 24 24"
                            strokeWidth={1.8}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.367 13.5c-.806 0-1.533.446-2.031 1.08a9.041 9.041 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75A2.25 2.25 0 017.5 19.5c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 012.25 12c0-2.825.976-5.424 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h5.996a4.5 4.5 0 014.5 4.5v5.25z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 13.5h3a.75.75 0 00.75-.75V4.5a.75.75 0 00-.75-.75h-3" />
                          </svg>
                          <span>{dislikeCounts[rev.id] ?? rev.dislikes}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content: Details */}
          {activeTab === "details" && (
            <div className="space-y-4 max-w-2xl text-xs sm:text-sm text-gray-600 leading-relaxed pt-2">
              <h3 className="font-bold text-base text-[#010101]">Product Specifications</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>Full-grain premium leather upper with suede accents</li>
                <li>Encapsulated Air-Sole unit for lightweight cushioning</li>
                <li>Solid rubber outsole with deep flex grooves for enhanced traction</li>
                <li>Padded collar and tongue for ankle support and all-day comfort</li>
                <li>Imported / 100% Authentic Guaranteed</li>
              </ul>
            </div>
          )}

          {/* Tab Content: Discussion */}
          {activeTab === "discussion" && (
            <div className="space-y-4 max-w-2xl text-xs sm:text-sm text-gray-600 pt-2">
              <p>Have questions about sizing, delivery, or authenticity? Join the community discussion below.</p>
              <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Ask a question about this product...</span>
                <button className="px-4 py-2 bg-[#010101] text-white rounded-full text-xs font-bold">Ask Question</button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Permanent Rating Breakdown & Popular Brands Card (4 cols - aligned flush right) */}
        <div className="lg:col-span-4 space-y-6 max-w-[320px] w-full ml-auto">
          {/* Rating Stars & Score */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-[#EDCF5D] text-xl tracking-wider">
                {"★".repeat(Math.floor(rating))}
                {"☆".repeat(5 - Math.floor(rating))}
              </div>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#010101]">{rating}</span>
            </div>

            {/* Progress Bars */}
            <div className="space-y-2">
              {ratingCounts.map((item) => (
                <div key={item.stars} className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="w-3 font-semibold text-gray-700">{item.stars}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-[#EDCF5D] rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="w-5 text-right font-medium text-gray-600">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Brands Promo Card */}
          <div
            className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-5 border border-black/5"
            style={{ background: "#E2DEC5" }}
          >
            <h3 className="text-base sm:text-lg font-extrabold text-[#010101] leading-snug">
              Popular brands<br />with discounts<br />over 25%
            </h3>

            {/* Overlapping Brand Icons */}
            <div className="flex items-center -space-x-2">
              <div className="w-7 h-7 rounded-full bg-black text-white font-black text-[9px] flex items-center justify-center border-2 border-[#E2DEC5] shadow-xs">
                DK
              </div>
              <div className="w-7 h-7 rounded-full bg-[#004725] text-white font-black text-[9px] flex items-center justify-center border-2 border-[#E2DEC5] shadow-xs">
                🐊
              </div>
              <div className="w-7 h-7 rounded-full bg-[#001489] text-white font-black text-[9px] flex items-center justify-center border-2 border-[#E2DEC5] shadow-xs">
                a
              </div>
              <div className="w-7 h-7 rounded-full bg-[#D40026] text-white font-black text-[9px] flex items-center justify-center border-2 border-[#E2DEC5] shadow-xs">
                TNF
              </div>
            </div>

            {/* Outlined Pill Button */}
            <Link
              href="/search"
              className="self-start px-4 py-1.5 rounded-xl border border-gray-800/50 text-[#010101] text-xs font-semibold hover:bg-black/5 transition-colors"
            >
              View more
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Similar Finds Component ─────────────────────────────────────────────────
const SIMILAR_PRODUCTS = [
  {
    id: "denim-jacket",
    badge: "50% OFF",
    title: "Urban Classic Denim Jacket",
    price: "₦32,400",
    originalPrice: "₦64,800",
    rating: 4.8,
    reviews: "1.2k",
    image: "/products/denim_jacket.png",
  },
  {
    id: "oxford-shirt",
    badge: "50% OFF",
    title: "Classic Oxford Shirt",
    price: "₦32,400",
    originalPrice: "₦64,800",
    rating: 4.9,
    reviews: "850",
    image: "/products/oxford_shirt.png",
  },
  {
    id: "hoodie",
    badge: "50% OFF",
    title: "Premium Streetwear Hoodie",
    price: "₦32,400",
    originalPrice: "₦64,800",
    rating: 4.7,
    reviews: "2.1k",
    image: "/products/hoodie.png",
  },
  {
    id: "linen-coat",
    badge: "50% OFF",
    title: "Urban Tailored Linen Coat",
    price: "₦32,400",
    originalPrice: "₦64,800",
    rating: 4.9,
    reviews: "1.5k",
    image: "/products/linen_coat.png",
  },
  {
    id: "pixel-10-pro",
    badge: "HOT",
    title: "Google Pixel 10 Pro 5G",
    price: "₦1,350,000",
    originalPrice: "₦1,450,000",
    rating: 4.9,
    reviews: "940",
    image: "/products/pixel_10.png",
  },
  {
    id: "ps5-spiderman",
    badge: "LIMITED",
    title: "PlayStation 5 Console Spider-Man Edition",
    price: "₦850,000",
    originalPrice: "₦950,000",
    rating: 4.9,
    reviews: "2.1k",
    image: "/products/spiderman_ps5.png",
  },
];

function SimilarFinds() {
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateScrollState = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      updateScrollState();
      container.addEventListener("scroll", updateScrollState, { passive: true });
      window.addEventListener("resize", updateScrollState);
      return () => {
        container.removeEventListener("scroll", updateScrollState);
        window.removeEventListener("resize", updateScrollState);
      };
    }
  }, []);

  const toggleWishlist = (id: string) =>
    setWishlisted((prev) => ({ ...prev, [id]: !prev[id] }));

  const scrollBy = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "left" ? -290 : 290, behavior: "smooth" });

  return (
    <section className="w-full px-5 md:px-8 pt-10 sm:pt-14 pb-10">
      {/* ── Section Header — matches landing page style ── */}
      <div className="flex justify-between items-end mb-6 sm:mb-8">
        <div>
          <h2 className="text-lg sm:text-xl md:text-3xl font-normal text-[#010101] tracking-tight flex items-center gap-2">
            Similar{" "}
            <span className="text-[#EDCF5D] font-bold">✦</span>
            <span className="font-serif italic font-bold text-[#010101]">Finds</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            More styles you might love
          </p>
        </div>

        <Link
          href="/search"
          className="text-xs sm:text-sm text-gray-700 font-normal hover:text-black flex items-center gap-1 transition-colors group shrink-0"
        >
          <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-700">
            View all
          </span>
          <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
        </Link>
      </div>

      {/* ── Scrollable Cards Row ── */}
      <div className="relative group overflow-hidden">
        {/* Left Fade */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-r from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Left Arrow */}
        <button
          aria-label="Scroll similar finds left"
          onClick={() => scrollBy("left")}
          className={`absolute left-3 sm:left-4 top-[36%] -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-black hover:bg-white transition-all active:scale-95 shadow-md ${
            canScrollLeft ? "opacity-100 flex" : "opacity-0 pointer-events-none hidden"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Cards */}
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth py-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {SIMILAR_PRODUCTS.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              title={product.title}
              price={product.price}
              originalPrice={product.originalPrice}
              badge={product.badge}
              rating={product.rating}
              reviews={product.reviews}
              image={product.image}
              isWishlisted={wishlisted[product.id]}
              onToggleWishlist={toggleWishlist}
              className="w-[180px] sm:w-[200px] md:w-[220px] shrink-0"
            />
          ))}
        </div>

        {/* Right Fade */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-10 sm:w-14 bg-gradient-to-l from-white/80 via-white/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Right Arrow */}
        <button
          aria-label="Scroll similar finds right"
          onClick={() => scrollBy("right")}
          className={`absolute right-3 sm:right-4 top-[36%] -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-black hover:bg-white transition-all active:scale-95 shadow-md ${
            canScrollRight ? "opacity-100 flex" : "opacity-0 pointer-events-none hidden"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}


