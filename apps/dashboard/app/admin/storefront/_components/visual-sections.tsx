"use client";

import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// 1. STOREFRONT HEADER PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewHeader() {
  return (
    <div className="w-full bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-xs select-none">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tighter text-[#010101] font-mono">GTS</span>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
          <span>Categories</span>
          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-6">
        <div className="w-full bg-[#F5F5F5] rounded-full px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <span>Search products, brands and categories...</span>
          <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
        <span className="hidden md:inline">About</span>
        <span className="hidden md:inline">FAQs</span>
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
          ♡
        </div>
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
          👜
        </div>
        <div className="w-7 h-7 rounded-full bg-[#010101] text-white flex items-center justify-center text-xs font-bold">
          U
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HERO SHOWCASE PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewHero({ selectedHeroProductIds: _selectedHeroProductIds }: { selectedHeroProductIds?: string[] }) {
  const [activeSlide, setActiveSlide] = useState<number>(0);

  const heroSlides = [
    {
      id: "nexus-washing-machine",
      badge: "15% OFF",
      title: "Nexus V8 Pro Smart Washer",
      subtitle: "Inverter Direct Drive with AI Fabric Care",
      price: "₦185,000",
      origPrice: "₦210,000",
      rating: 4.9,
      reviews: "1.2k reviews",
      bgGradient: "radial-gradient(ellipse at center, #1B3828 0%, #08150E 100%)",
      mainImage: "/products/hero/nexus_washing_machine_blue.png",
      leftImage: "/products/hero/pixel_10_green.png",
      rightImage: "/products/hero/samsung_fridge_black.png",
      colors: ["#2B4C3F", "#1A2530", "#3E3B32"],
    },
    {
      id: "samsung-fridge",
      badge: "HOT DEAL",
      title: "Samsung French Door Refrigerator",
      subtitle: "Twin Cooling Plus & Digital Inverter Compressor",
      price: "₦750,000",
      origPrice: "₦820,000",
      rating: 5.0,
      reviews: "840 reviews",
      bgGradient: "radial-gradient(ellipse at center, #182538 0%, #060E18 100%)",
      mainImage: "/products/hero/samsung_fridge_black.png",
      leftImage: "/products/hero/nexus_washing_machine_blue.png",
      rightImage: "/products/hero/air_jordan_retro_1_blue.png",
      colors: ["#1B2228", "#343A40", "#6C757D"],
    },
    {
      id: "air-jordan-1",
      badge: "LIMITED EDITION",
      title: "Air Jordan Retro 1 High OG",
      subtitle: "Signature University Blue with Premium Leather",
      price: "₦85,000",
      origPrice: "₦110,000",
      rating: 4.9,
      reviews: "2.4k reviews",
      bgGradient: "radial-gradient(ellipse at center, #261E38 0%, #0D0917 100%)",
      mainImage: "/products/hero/air_jordan_retro_1_blue.png",
      leftImage: "/products/hero/samsung_fridge_black.png",
      rightImage: "/products/hero/pixel_10_green.png",
      colors: ["#4A7BD0", "#1C1C1E", "#C93B2B"],
    },
  ];

  const slide = heroSlides[activeSlide % heroSlides.length]!;

  return (
    <div className="w-full p-3 md:p-4 bg-white select-none">
      <div
        className="relative w-full h-[460px] sm:h-[540px] rounded-[18px] overflow-hidden border border-white/10 shadow-xl flex flex-col justify-between p-6 sm:p-8 text-white transition-all duration-700"
        style={{ background: slide.bgGradient }}
      >
        {/* Top Tag & Discount Badge */}
        <div className="flex items-start justify-between z-20">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/60 font-semibold">
              GTS Flagship Collection
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight max-w-sm leading-tight">
              {slide.title}
            </h2>
            <p className="text-xs sm:text-sm text-white/75 max-w-xs">{slide.subtitle}</p>
          </div>

          <span className="bg-[#EDCF5D] text-[#010101] text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-bl-xl tracking-wider shadow-md">
            {slide.badge}
          </span>
        </div>

        {/* 3D Center Stage Product Display */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          {/* Left Background Product */}
          <div className="w-40 sm:w-56 h-40 sm:h-56 -translate-x-32 sm:-translate-x-48 opacity-30 scale-75 blur-[1px]">
            <img src={slide.leftImage} alt="Side" className="w-full h-full object-contain" />
          </div>

          {/* Center Main Product */}
          <div className="w-64 sm:w-80 h-64 sm:h-80 relative z-20 filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
            <img src={slide.mainImage} alt={slide.title} className="w-full h-full object-contain" />
          </div>

          {/* Right Background Product */}
          <div className="w-40 sm:w-56 h-40 sm:h-56 translate-x-32 sm:translate-x-48 opacity-30 scale-75 blur-[1px]">
            <img src={slide.rightImage} alt="Side" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Bottom Slide Controls, Color Dots & Pricing */}
        <div className="flex items-end justify-between z-20 pt-4">
          {/* Color Dots */}
          <div className="flex items-center gap-2">
            {slide.colors.map((c, i) => (
              <span
                key={i}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full border border-white/40 ${i === 0 ? "ring-2 ring-[#EDCF5D]" : ""}`}
              />
            ))}
            <div className="flex items-center gap-1.5 ml-4">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${activeSlide === i ? "w-6 bg-[#EDCF5D]" : "w-2 bg-white/40"}`}
                />
              ))}
            </div>
          </div>

          {/* Price Tag & CTA */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#EDCF5D]">
                {slide.price}
              </span>
              <span className="text-xs sm:text-sm text-white/50 line-through">
                {slide.origPrice}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-white/80">
              <span className="text-[#EDCF5D]">★★★★★</span>
              <span>({slide.reviews})</span>
            </div>
            <div className="mt-1 px-5 py-2 rounded-full bg-[#EDCF5D] text-black font-bold text-xs shadow-lg">
              Shop Now →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BESTSELLING PRODUCTS PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewBestsellers() {
  const products = [
    { name: "Air Jordan Retro 1 High", brand: "Nike", price: "₦85,000", orig: "₦110,000", image: "/products/hero/air_jordan_retro_1_blue.png", tag: "Hot" },
    { name: "Samsung Sound Tower", brand: "Samsung", price: "₦140,000", orig: "₦165,000", image: "/products/appliance_section.webp", tag: "Sale" },
    { name: "Double Door Refrigerator", brand: "Haier", price: "₦420,000", orig: "₦480,000", image: "/products/four_fridge.png", tag: "Popular" },
    { name: "Digital Air Fryer 6L", brand: "Philips", price: "₦65,000", orig: "₦78,000", image: "/products/airfryer.png", tag: "15% Off" },
    { name: "Nutri Quick Blender", brand: "Ninja", price: "₦38,000", orig: "₦45,000", image: "/products/blender-removebg-preview.png", tag: "Best" },
    { name: "Solo Smart Microwave", brand: "Panasonic", price: "₦72,000", orig: "₦85,000", image: "/products/microwave-removebg-preview.png", tag: "New" },
  ];

  return (
    <div className="w-full bg-white py-6 select-none">
      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-[#010101] tracking-tight">Bestselling Products</h3>
            <p className="text-xs text-gray-500">Most coveted products chosen by verified customers</p>
          </div>
          <span className="text-xs font-bold text-[#010101] hover:underline cursor-pointer">View All →</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {products.map((p, i) => (
            <div key={i} className="border border-gray-200/80 rounded-xl p-2.5 bg-white shadow-xs flex flex-col justify-between">
              <div className="relative w-full aspect-square bg-[#F8F8F6] rounded-lg overflow-hidden flex items-center justify-center p-2 mb-2">
                <span className="absolute top-1 left-1 bg-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  {p.tag}
                </span>
                <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-medium uppercase">{p.brand}</span>
                <h4 className="text-xs font-bold text-[#010101] truncate">{p.name}</h4>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xs font-black text-[#010101]">{p.price}</span>
                  <span className="text-[10px] text-gray-400 line-through">{p.orig}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FEATURED CATEGORIES PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewCategories() {
  const cats = [
    { title: "Living Room", count: "48 Items", image: "/products/home_and_office_section.jpg" },
    { title: "Kitchen Gear", count: "64 Items", image: "/products/kitchen_finds.avif" },
    { title: "Gaming Setup", count: "32 Items", image: "/products/gaming_section.jpg" },
    { title: "Smart Gadgets", count: "89 Items", image: "/products/tech_finds.jpg" },
    { title: "Modern Fashion", count: "120 Items", image: "/products/fashion_section.jpg" },
    { title: "Personal Care", count: "55 Items", image: "/products/health_and_beauty_section.jpg" },
  ];

  return (
    <div className="w-full bg-white py-6 select-none border-t border-gray-100">
      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-[#010101] tracking-tight">Featured Categories</h3>
            <p className="text-xs text-gray-500">Explore department collections curated for luxury and functionality</p>
          </div>
          <span className="text-xs font-bold text-[#010101] hover:underline cursor-pointer">Explore All →</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {cats.map((c, i) => (
            <div
              key={i}
              className="relative aspect-[3/4.2] rounded-xl overflow-hidden shadow-xs group border border-gray-200/80 flex flex-col justify-end p-3 text-white"
            >
              <img src={c.image} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="relative z-10">
                <span className="text-[10px] text-gray-300 font-medium">{c.count}</span>
                <h4 className="text-xs sm:text-sm font-black leading-tight truncate">{c.title}</h4>
                <div className="mt-1.5 inline-block px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-semibold text-white">
                  Shop →
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. UPGRADE YOUR APPLIANCES PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewAppliances() {
  const appliances = [
    { name: "Pro Chef Air Fryer", price: "₦55,000", image: "/products/airfryer.png" },
    { name: "Power Pulse Blender", price: "₦32,000", image: "/products/blender-removebg-preview.png" },
    { name: "Compact Microwave Oven", price: "₦68,000", image: "/products/microwave-removebg-preview.png" },
    { name: "Cold Press Juicer", price: "₦42,000", image: "/products/juicer-removebg-preview.png" },
    { name: "Non-Stick Stockpot", price: "₦26,000", image: "/products/pot-removebg-preview.png" },
    { name: "Double Slice Toaster", price: "₦18,000", image: "/products/toasters-removebg-preview.png" },
  ];

  return (
    <div className="w-full bg-[#FAFAF8] py-7 select-none border-t border-b border-gray-200/80">
      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#EDCF5D]/20 text-[#9E821B] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1">
              Kitchen & Home
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[#010101] tracking-tight">Upgrade Your Appliances</h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold overflow-x-auto pb-1">
            <span className="px-3 py-1 rounded-full bg-black text-white cursor-pointer">All Essentials</span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 cursor-pointer">Cooking</span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 cursor-pointer">Cooling</span>
            <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 cursor-pointer">Laundry</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {appliances.map((a, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200/80 p-3 flex flex-col justify-between shadow-xs">
              <div className="w-full aspect-square bg-[#F5F5F3] rounded-lg p-2 flex items-center justify-center mb-2">
                <img src={a.image} alt={a.name} className="w-full h-full object-contain" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#010101] truncate">{a.name}</h4>
                <span className="text-xs font-black text-[#9E821B] block mt-0.5">{a.price}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. BABY SPECIALS PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewBabySpecials() {
  const items = [
    { name: "Chicco Quick-Fold Stroller", price: "₦185,000", image: "/products/baby_stroller.jpg" },
    { name: "Deluxe Baby Play Gym", price: "₦45,000", image: "/products/baby_play_gym.jpg" },
    { name: "Interactive Walker Toy", price: "₦38,000", image: "/products/baby_walker_toy.jpg" },
    { name: "Baby Care Essentials Bundle", price: "₦28,000", image: "/products/baby_products_section.jpg" },
    { name: "Gentle Bath Cleanser", price: "₦14,000", image: "/products/hygiene_soap_care.jpg" },
  ];

  return (
    <div className="w-full bg-white py-6 select-none border-b border-gray-100">
      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1">
              Parenting & Kids
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#010101] tracking-tight">Baby Specials</h3>
          </div>
          <span className="text-xs font-bold text-[#010101] hover:underline cursor-pointer">Shop All →</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {items.map((b, i) => (
            <div key={i} className="border border-gray-200/80 rounded-xl p-2.5 bg-white shadow-xs">
              <div className="w-full aspect-square bg-[#F8F9FA] rounded-lg overflow-hidden mb-2">
                <img src={b.image} alt={b.name} className="w-full h-full object-cover" />
              </div>
              <h4 className="text-xs font-bold text-[#010101] truncate">{b.name}</h4>
              <span className="text-xs font-black text-[#010101] block mt-0.5">{b.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. FRESH SEASON NEW ARRIVALS PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewNewArrivals() {
  const fashionItems = [
    { name: "Air Jordan Retro 1 Blue", price: "₦85,000", image: "/products/hero/air_jordan_retro_1_blue.png" },
    { name: "Orange Utility Overshirt", price: "₦32,000", image: "/products/summer_fashinon_finds.jpg" },
    { name: "Classic Oxford Poplin Shirt", price: "₦24,000", image: "/products/oxford_shirt.png" },
    { name: "Signature Heavyweight Hoodie", price: "₦28,000", image: "/products/hoodie.png" },
  ];

  return (
    <div className="w-full bg-white py-6 select-none border-b border-gray-100">
      {/* Marquee Banner Strip */}
      <div className="w-full bg-[#EDCF5D] text-black py-2 px-4 font-black text-xs uppercase tracking-widest flex items-center justify-between mb-6 shadow-xs">
        <span>★ Fresh Season New Arrivals</span>
        <span>★ Crazy Discounts</span>
        <span>★ Authentic Luxury Only</span>
        <span className="hidden sm:inline">★ Same-Day Delivery Available</span>
      </div>

      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Grid of Fashion Items */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {fashionItems.map((f, i) => (
              <div key={i} className="border border-gray-200/80 rounded-xl p-2.5 bg-white shadow-xs flex flex-col justify-between">
                <div className="w-full aspect-square bg-[#F7F7F7] rounded-lg overflow-hidden flex items-center justify-center p-2 mb-2">
                  <img src={f.image} alt={f.name} className="w-full h-full object-contain" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#010101] truncate">{f.name}</h4>
                  <span className="text-xs font-black text-[#010101] block mt-0.5">{f.price}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Large Feature Hero Banner */}
          <div className="lg:col-span-4 relative rounded-xl overflow-hidden min-h-[260px] shadow-sm flex flex-col justify-end p-5 text-white">
            <img src="/products/fashion_section.jpg" alt="Fashion" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="relative z-10">
              <span className="text-[10px] font-bold text-[#EDCF5D] uppercase tracking-wider">Spotlight</span>
              <h3 className="text-lg font-black leading-tight">Everyday Wardrobe Essentials</h3>
              <p className="text-xs text-gray-300 mt-1">Curated tailoring crafted for timeless luxury.</p>
              <div className="mt-3 inline-block px-4 py-1.5 rounded-full bg-[#EDCF5D] text-black font-bold text-xs">
                Explore Collection →
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. BEAUTY & HYGIENE DEALS PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewBeauty() {
  const beauty = [
    { name: "CeraVe Hydrating Cleanser", price: "₦18,500", image: "/products/cerave_cleanser.jpg" },
    { name: "Baccarat Rouge 540 Extrait", price: "₦165,000", image: "/products/perfume_luxury.jpg" },
    { name: "Hyaluronic Acid Glow Serum", price: "₦22,000", image: "/products/serum_dropper.jpg" },
    { name: "Botanical Gentle Care Soap", price: "₦8,500", image: "/products/hygiene_soap_care.jpg" },
    { name: "Ultra Rich Barrier Cream", price: "₦19,000", image: "/products/moisturizer_cream.jpg" },
  ];

  return (
    <div className="w-full bg-white py-6 select-none border-b border-gray-100">
      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1">
              Glow & Wellness
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#010101] tracking-tight">Beauty & Hygiene Deals</h3>
          </div>
          <span className="text-xs font-bold text-[#010101] hover:underline cursor-pointer">Shop Beauty →</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {beauty.map((b, i) => (
            <div key={i} className="border border-gray-200/80 rounded-xl p-2.5 bg-white shadow-xs">
              <div className="w-full aspect-square bg-[#F8F9FA] rounded-lg overflow-hidden mb-2">
                <img src={b.image} alt={b.name} className="w-full h-full object-cover" />
              </div>
              <h4 className="text-xs font-bold text-[#010101] truncate">{b.name}</h4>
              <span className="text-xs font-black text-[#010101] block mt-0.5">{b.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. SHOWCASE BANNERS PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewShowcase() {
  const banners = [
    { title: "Street Ready Styles", subtitle: "Urban contemporary silhouettes", image: "/products/summer_fashinon_finds.jpg" },
    { title: "Everyday Elevates", subtitle: "Clean comfort for modern life", image: "/products/home_finds.jpg" },
    { title: "Flash Sale Deals", subtitle: "Up to 50% off select appliances", image: "/products/kitchen_finds.avif" },
    { title: "Weekend Escapes", subtitle: "Travel smart with durable carry-ons", image: "/products/game_finds.webp" },
  ];

  return (
    <div className="w-full bg-white py-6 select-none border-b border-gray-100">
      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {banners.map((b, i) => (
            <div
              key={i}
              className="relative h-44 rounded-xl overflow-hidden shadow-xs flex flex-col justify-end p-5 text-white"
            >
              <img src={b.image} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="relative z-10">
                <h4 className="text-base font-black leading-tight">{b.title}</h4>
                <p className="text-xs text-gray-300 mt-0.5">{b.subtitle}</p>
                <span className="mt-2 inline-block px-3 py-1 rounded-full bg-white text-black font-bold text-[11px]">
                  Explore →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. CRAZY FINDS PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewCrazyFinds() {
  const deals = [
    { name: "Oxford Button Down", discount: "-45%", price: "₦18,000", image: "/products/oxford_shirt.png" },
    { name: "Graphic Fleece Hoodie", discount: "-50%", price: "₦22,000", image: "/products/hoodie.png" },
    { name: "Tailored Linen Blazer", discount: "-35%", price: "₦48,000", image: "/products/linen_coat.png" },
    { name: "Air Fryer XL 5.5L", discount: "-40%", price: "₦42,000", image: "/products/airfryer.png" },
    { name: "Power Stand Mixer", discount: "-60%", price: "₦29,000", image: "/products/blender-removebg-preview.png" },
  ];

  return (
    <div className="w-full bg-white py-6 select-none border-b border-gray-100">
      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg sm:text-xl font-black text-[#010101] tracking-tight">Crazy Finds</h3>
            <span className="bg-red-600 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded">
              08h : 42m : 19s
            </span>
          </div>
          <span className="text-xs font-bold text-[#010101] hover:underline cursor-pointer">All Deals →</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {deals.map((d, i) => (
            <div key={i} className="border border-gray-200/80 rounded-xl p-2.5 bg-white shadow-xs relative">
              <span className="absolute top-2 right-2 bg-[#EDCF5D] text-black font-black text-[10px] px-1.5 py-0.5 rounded shadow-xs">
                {d.discount}
              </span>
              <div className="w-full aspect-square bg-[#F8F8F8] rounded-lg p-2 flex items-center justify-center mb-2">
                <img src={d.image} alt={d.name} className="w-full h-full object-contain" />
              </div>
              <h4 className="text-xs font-bold text-[#010101] truncate">{d.name}</h4>
              <span className="text-xs font-black text-red-600 block mt-0.5">{d.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. FAQ PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewFAQ() {
  return (
    <div className="w-full bg-[#FAFAF8] py-8 select-none border-b border-gray-200/80">
      <div className="max-w-[1240px] mx-auto px-3 md:px-4">
        <div className="text-center max-w-md mx-auto mb-6">
          <h3 className="text-xl font-bold text-[#010101] tracking-tight">Frequently Asked Questions</h3>
          <p className="text-xs text-gray-500 mt-1">Everything you need to know about shopping and delivery with GTS.</p>
        </div>

        <div className="max-w-2xl mx-auto space-y-2.5">
          <div className="bg-white border border-[#EDCF5D] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between font-bold text-xs text-[#010101]">
              <span>How fast is nationwide delivery in Nigeria?</span>
              <span className="text-[#9E821B] font-mono">−</span>
            </div>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Lagos & Abuja orders arrive in 24–48 hours. Other states typically take 2–4 business days via our premium insured logistics partners.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex items-center justify-between font-semibold text-xs text-gray-700">
            <span>Are all luxury products 100% verified authentic?</span>
            <span className="text-gray-400 font-mono">+</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex items-center justify-between font-semibold text-xs text-gray-700">
            <span>What is the 7-day return policy?</span>
            <span className="text-gray-400 font-mono">+</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex items-center justify-between font-semibold text-xs text-gray-700">
            <span>Can I pay with credit card, bank transfer or Paystack?</span>
            <span className="text-gray-400 font-mono">+</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. FOOTER PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
export function PreviewFooter() {
  return (
    <div className="w-full bg-[#0E0E0E] text-white pt-10 pb-6 px-4 select-none">
      <div className="max-w-[1240px] mx-auto">
        {/* Newsletter CTA */}
        <div className="bg-[#1C1C1E] rounded-2xl p-6 sm:p-8 mb-8 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-base sm:text-lg font-bold text-white">Step Into Timeless Elegance with GTS</h4>
            <p className="text-xs text-gray-400 mt-1">Subscribe for private sales, drop announcements and VIP events.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Enter your email address..."
              readOnly
              className="bg-black/50 border border-white/20 rounded-full px-4 py-2 text-xs text-white placeholder-gray-500 outline-none w-full sm:w-64"
            />
            <div className="px-5 py-2 rounded-full bg-[#EDCF5D] text-black font-bold text-xs whitespace-nowrap">
              Subscribe
            </div>
          </div>
        </div>

        {/* Links Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs text-gray-400 pb-8 border-b border-white/10">
          <div>
            <h5 className="font-bold text-white uppercase tracking-wider mb-3">About GTS</h5>
            <ul className="space-y-1.5">
              <li>Our Story</li>
              <li>Brand Heritage</li>
              <li>Sustainability</li>
              <li>Careers</li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-white uppercase tracking-wider mb-3">Customer Support</h5>
            <ul className="space-y-1.5">
              <li>Order Tracking</li>
              <li>Returns & Exchanges</li>
              <li>Shipping Information</li>
              <li>Contact Us</li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-white uppercase tracking-wider mb-3">Shop Departments</h5>
            <ul className="space-y-1.5">
              <li>Home Appliances</li>
              <li>Phones & Gadgets</li>
              <li>Designer Fashion</li>
              <li>Baby & Kids</li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-white uppercase tracking-wider mb-3">Verified Guarantee</h5>
            <p className="leading-relaxed text-gray-400">
              Every item sold on GTS undergoes rigorous multi-point authentication and includes a tamper-proof guarantee certificate.
            </p>
          </div>
        </div>

        {/* Bottom Legal */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2">
          <span>© 2026 GTS E-Commerce Luxury Platform. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Security</span>
          </div>
        </div>
      </div>
    </div>
  );
}
