"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BRAND_REGISTRY } from "../../_data/products";

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  groups: {
    title: string;
    items: { label: string; href: string }[];
  }[];
  brands?: { name: string; href: string }[];
}

// ─── Category name → search category mapping ──────────────────────────────────
// Each mega-menu category maps to one of the product `category` values.
// The top-level click navigates to /search?category=X
// Each subcategory item navigates to /search?category=X&q=Y (pre-fills both filter + search)
const CAT = {
  appliances: "Appliances",
  phonesTablets: "Phones & Tablets",
  electronics: "Electronics",
  fashion: "Fashion",
  gaming: "Gaming",
  healthBeauty: "Health & Beauty",
  homeOffice: "Home & Office",
  supermarket: "Supermarket",
  computing: "Computing",
  baby: "Baby Products",
} as const;

function searchHref(category: string, q?: string) {
  const base = `/search?category=${encodeURIComponent(category)}`;
  return q ? `${base}&q=${encodeURIComponent(q)}` : base;
}

/** Brand link — pre-checks the brand sidebar filter + shows Brand: X chip */
function brandHref(category: string | null, brand: string) {
  if (category) {
    return `/search?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}`;
  }
  return `/search?brand=${encodeURIComponent(brand)}`;
}

export const MEGA_CATEGORIES: CategoryItem[] = [
  {
    id: "appliances",
    name: "Appliances",
    icon: "appliance",
    groups: [
      {
        title: "SMALL APPLIANCES",
        items: [
          { label: "Blenders", href: searchHref(CAT.appliances, "Blenders") },
          { label: "Deep Fryers", href: searchHref(CAT.appliances, "Deep Fryers") },
          { label: "Juicers", href: searchHref(CAT.appliances, "Juicers") },
          { label: "Air Fryers", href: searchHref(CAT.appliances, "Air Fryers") },
          { label: "Rice Cookers", href: searchHref(CAT.appliances, "Rice Cookers") },
          { label: "Toasters & Ovens", href: searchHref(CAT.appliances, "Toasters & Ovens") },
          { label: "Microwaves", href: searchHref(CAT.appliances, "Microwaves") },
          { label: "Bundles", href: searchHref(CAT.appliances, "Bundles") },
          { label: "Vacuum Cleaners", href: searchHref(CAT.appliances, "Vacuum Cleaners") },
          { label: "Kettles", href: searchHref(CAT.appliances, "Kettles") },
          { label: "Yam Pounders", href: searchHref(CAT.appliances, "Yam Pounders") },
          { label: "Irons", href: searchHref(CAT.appliances, "Irons") },
          { label: "Electric Cookware", href: searchHref(CAT.appliances, "Electric Cookware") },
          { label: "Electric Drink Mixers", href: searchHref(CAT.appliances, "Electric Drink Mixers") },
          { label: "Food Processors", href: searchHref(CAT.appliances, "Food Processors") },
          { label: "Coffee Makers", href: searchHref(CAT.appliances, "Coffee Makers") },
          { label: "Electric Pressure Cookers", href: searchHref(CAT.appliances, "Electric Pressure Cookers") },
        ],
      },
      {
        title: "LARGE APPLIANCES",
        items: [
          { label: "Washing Machines", href: searchHref(CAT.appliances, "Washing Machines") },
          { label: "Fridges", href: searchHref(CAT.appliances, "Fridges") },
          { label: "Freezers", href: searchHref(CAT.appliances, "Freezers") },
          { label: "Air Conditioners", href: searchHref(CAT.appliances, "Air Conditioners") },
          { label: "Heaters", href: searchHref(CAT.appliances, "Heaters") },
          { label: "Fans", href: searchHref(CAT.appliances, "Fans") },
          { label: "Air Purifiers", href: searchHref(CAT.appliances, "Air Purifiers") },
          { label: "Water Dispensers", href: searchHref(CAT.appliances, "Water Dispensers") },
          { label: "Generators & Inverters", href: searchHref(CAT.appliances, "Generators & Inverters") },
        ],
      },
      {
        title: "HOME APPLIANCES",
        items: [
          { label: "Air Quality Control", href: searchHref(CAT.appliances, "Air Quality Control") },
          { label: "Cleaning Equipment", href: searchHref(CAT.appliances, "Cleaning Equipment") },
          { label: "Sewing Machines", href: searchHref(CAT.appliances, "Sewing Machines") },
          { label: "Water Heaters", href: searchHref(CAT.appliances, "Water Heaters") },
        ],
      },
    ],
    brands: [
      { name: "Nexus", href: brandHref(CAT.appliances, "Nexus") },
      { name: "Hisense", href: brandHref(CAT.appliances, "Hisense") },
      { name: "Polystar", href: brandHref(CAT.appliances, "Polystar") },
      { name: "TCL", href: brandHref(CAT.appliances, "TCL") },
      { name: "LG", href: brandHref(CAT.appliances, "LG") },
      { name: "Samsung", href: brandHref(CAT.appliances, "Samsung") },
    ],
  },
  {
    id: "official-store",
    name: "Official Store",
    icon: "store",
    groups: [
      {
        title: "FEATURED STORES",
        // Derives from BRAND_REGISTRY — all brands with category: null are Official / cross-category
        items: BRAND_REGISTRY
          .filter((b) => b.category === null)
          .map((b) => ({ label: `${b.label} Store`, href: brandHref(null, b.key) })),
      },
      {
        title: "EXCLUSIVE DEALS",
        items: [
          { label: "Flash Sales", href: "/search?tag=flash-sale" },
          { label: "Brand Week Offers", href: "/search?tag=brand-week" },
          { label: "Manufacturer Warranty Products", href: "/search?tag=warranty" },
        ],
      },
    ],
  },
  {
    id: "phones-tablets",
    name: "Phones & Tablets",
    icon: "phone",
    groups: [
      {
        title: "MOBILE PHONES",
        items: [
          { label: "Smartphones", href: searchHref(CAT.phonesTablets, "Smartphones") },
          { label: "iOS Phones", href: searchHref(CAT.phonesTablets, "iOS Phones") },
          { label: "Android Phones", href: searchHref(CAT.phonesTablets, "Android Phones") },
          { label: "Basic Phones", href: searchHref(CAT.phonesTablets, "Basic Phones") },
          { label: "Refurbished Phones", href: searchHref(CAT.phonesTablets, "Refurbished Phones") },
        ],
      },
      {
        title: "TABLETS",
        items: [
          { label: "iPads", href: searchHref(CAT.phonesTablets, "iPads") },
          { label: "Android Tablets", href: searchHref(CAT.phonesTablets, "Android Tablets") },
          { label: "Educational Tablets", href: searchHref(CAT.phonesTablets, "Educational Tablets") },
          { label: "Graphics Tablets", href: searchHref(CAT.phonesTablets, "Graphics Tablets") },
        ],
      },
      {
        title: "ACCESSORIES",
        items: [
          { label: "Cases & Covers", href: searchHref(CAT.phonesTablets, "Cases & Covers") },
          { label: "Screen Protectors", href: searchHref(CAT.phonesTablets, "Screen Protectors") },
          { label: "Power Banks", href: searchHref(CAT.phonesTablets, "Power Banks") },
          { label: "Chargers & Cables", href: searchHref(CAT.phonesTablets, "Chargers & Cables") },
          { label: "Earphones & Headsets", href: searchHref(CAT.phonesTablets, "Earphones & Headsets") },
          { label: "Smartwatches & Bands", href: searchHref(CAT.phonesTablets, "Smartwatches & Bands") },
        ],
      },
    ],
    brands: [
      { name: "Apple", href: brandHref(CAT.phonesTablets, "Apple") },
      { name: "Samsung", href: brandHref(CAT.phonesTablets, "Samsung") },
      { name: "Google Pixel", href: brandHref(CAT.phonesTablets, "Google") },
      { name: "Xiaomi", href: brandHref(CAT.phonesTablets, "Xiaomi") },
      { name: "Infinix", href: brandHref(CAT.phonesTablets, "Infinix") },
      { name: "Tecno", href: brandHref(CAT.phonesTablets, "Tecno") },
    ],
  },
  {
    id: "health-beauty",
    name: "Health & Beauty",
    icon: "beauty",
    groups: [
      {
        title: "SKINCARE",
        items: [
          { label: "Face Cleansers", href: searchHref(CAT.healthBeauty, "Face Cleansers") },
          { label: "Moisturizers & Creams", href: searchHref(CAT.healthBeauty, "Moisturizers & Creams") },
          { label: "Sunscreen & SPF", href: searchHref(CAT.healthBeauty, "Sunscreen & SPF") },
          { label: "Serums & Oils", href: searchHref(CAT.healthBeauty, "Serums & Oils") },
          { label: "Face Masks", href: searchHref(CAT.healthBeauty, "Face Masks") },
        ],
      },
      {
        title: "FRAGRANCES",
        items: [
          { label: "Men's Perfumes", href: searchHref(CAT.healthBeauty, "Men's Perfumes") },
          { label: "Women's Perfumes", href: searchHref(CAT.healthBeauty, "Women's Perfumes") },
          { label: "Body Mists & Sprays", href: searchHref(CAT.healthBeauty, "Body Mists & Sprays") },
          { label: "Deodorants", href: searchHref(CAT.healthBeauty, "Deodorants") },
        ],
      },
      {
        title: "HAIR CARE",
        items: [
          { label: "Shampoos & Conditioners", href: searchHref(CAT.healthBeauty, "Shampoos & Conditioners") },
          { label: "Styling Tools & Irons", href: searchHref(CAT.healthBeauty, "Styling Tools & Irons") },
          { label: "Wigs & Extensions", href: searchHref(CAT.healthBeauty, "Wigs & Extensions") },
        ],
      },
    ],
    brands: [
      { name: "Nivea", href: brandHref(CAT.healthBeauty, "Nivea") },
      { name: "CeraVe", href: brandHref(CAT.healthBeauty, "CeraVe") },
      { name: "Maybelline", href: brandHref(CAT.healthBeauty, "Maybelline") },
      { name: "Fenty Beauty", href: brandHref(CAT.healthBeauty, "Fenty Beauty") },
    ],
  },
  {
    id: "home-office",
    name: "Home & Office",
    icon: "home",
    groups: [
      {
        title: "FURNITURE",
        items: [
          { label: "Office Chairs", href: searchHref(CAT.homeOffice, "Office Chairs") },
          { label: "Executive Desks", href: searchHref(CAT.homeOffice, "Executive Desks") },
          { label: "Living Room Sofas", href: searchHref(CAT.homeOffice, "Living Room Sofas") },
          { label: "Bed Frames & Tables", href: searchHref(CAT.homeOffice, "Bed Frames & Tables") },
        ],
      },
      {
        title: "BEDDING & BATH",
        items: [
          { label: "Bed Sheets & Pillowcases", href: searchHref(CAT.homeOffice, "Bed Sheets & Pillowcases") },
          { label: "Duvets & Comforters", href: searchHref(CAT.homeOffice, "Duvets & Comforters") },
          { label: "Bath Towels", href: searchHref(CAT.homeOffice, "Bath Towels") },
        ],
      },
      {
        title: "DECOR & LIGHTING",
        items: [
          { label: "Table Lamps & Bulbs", href: searchHref(CAT.homeOffice, "Table Lamps & Bulbs") },
          { label: "Wall Art & Clocks", href: searchHref(CAT.homeOffice, "Wall Art & Clocks") },
          { label: "Rugs & Carpets", href: searchHref(CAT.homeOffice, "Rugs & Carpets") },
        ],
      },
    ],
    brands: [
      { name: "IKEA", href: brandHref(CAT.homeOffice, "IKEA") },
      { name: "Bedmate", href: brandHref(CAT.homeOffice, "Bedmate") },
      { name: "Century", href: brandHref(CAT.homeOffice, "Century") },
    ],
  },
  {
    id: "electronics",
    name: "Electronics",
    icon: "tv",
    groups: [
      {
        title: "TELEVISION & VIDEO",
        items: [
          { label: "Smart TVs", href: searchHref(CAT.electronics, "Smart TVs") },
          { label: "OLED & QLED TVs", href: searchHref(CAT.electronics, "OLED & QLED TVs") },
          { label: "4K UHD TVs", href: searchHref(CAT.electronics, "4K UHD TVs") },
          { label: "Projectors & Screens", href: searchHref(CAT.electronics, "Projectors & Screens") },
        ],
      },
      {
        title: "AUDIO & SOUND",
        items: [
          { label: "Soundbars & Subwoofers", href: searchHref(CAT.electronics, "Soundbars & Subwoofers") },
          { label: "Home Theatre Systems", href: searchHref(CAT.electronics, "Home Theatre Systems") },
          { label: "Bluetooth Speakers", href: searchHref(CAT.electronics, "Bluetooth Speakers") },
        ],
      },
    ],
    brands: [
      { name: "Sony", href: brandHref(CAT.electronics, "Sony") },
      { name: "Samsung", href: brandHref(CAT.electronics, "Samsung") },
      { name: "Hisense", href: brandHref(CAT.electronics, "Hisense") },
      { name: "LG", href: brandHref(CAT.electronics, "LG") },
      { name: "JBL", href: brandHref(CAT.electronics, "JBL") },
    ],
  },
  {
    id: "fashion",
    name: "Fashion",
    icon: "fashion",
    groups: [
      {
        title: "WOMEN'S FASHION",
        items: [
          { label: "Dresses", href: searchHref(CAT.fashion, "Dresses") },
          { label: "Tops & Blouses", href: searchHref(CAT.fashion, "Tops & Blouses") },
          { label: "Footwear & Heels", href: searchHref(CAT.fashion, "Footwear & Heels") },
          { label: "Handbags & Clutches", href: searchHref(CAT.fashion, "Handbags & Clutches") },
        ],
      },
      {
        title: "MEN'S FASHION",
        items: [
          { label: "Casual T-Shirts", href: searchHref(CAT.fashion, "Casual T-Shirts") },
          { label: "Formal Shirts", href: searchHref(CAT.fashion, "Formal Shirts") },
          { label: "Jeans & Trousers", href: searchHref(CAT.fashion, "Jeans & Trousers") },
          { label: "Sneakers & Boots", href: searchHref(CAT.fashion, "Sneakers & Boots") },
        ],
      },
    ],
    brands: [
      { name: "Nike", href: brandHref(CAT.fashion, "Nike") },
      { name: "Adidas", href: brandHref(CAT.fashion, "Adidas") },
      { name: "Zara", href: brandHref(CAT.fashion, "Zara") },
    ],
  },
  {
    id: "supermarket",
    name: "Supermarket",
    icon: "supermarket",
    groups: [
      {
        title: "BEVERAGES",
        items: [
          { label: "Juices & Drinks", href: searchHref(CAT.supermarket, "Juices & Drinks") },
          { label: "Coffee & Tea", href: searchHref(CAT.supermarket, "Coffee & Tea") },
          { label: "Energy & Soft Drinks", href: searchHref(CAT.supermarket, "Energy & Soft Drinks") },
        ],
      },
      {
        title: "FOOD STAPLES",
        items: [
          { label: "Rice & Grains", href: searchHref(CAT.supermarket, "Rice & Grains") },
          { label: "Pasta & Noodles", href: searchHref(CAT.supermarket, "Pasta & Noodles") },
          { label: "Cooking Oils", href: searchHref(CAT.supermarket, "Cooking Oils") },
        ],
      },
    ],
  },
  {
    id: "computing",
    name: "Computing",
    icon: "computing",
    groups: [
      {
        title: "LAPTOPS",
        items: [
          { label: "Gaming Laptops", href: searchHref(CAT.computing, "Gaming Laptops") },
          { label: "MacBooks", href: searchHref(CAT.computing, "MacBooks") },
          { label: "Ultrabooks & Slims", href: searchHref(CAT.computing, "Ultrabooks & Slims") },
          { label: "Business Laptops", href: searchHref(CAT.computing, "Business Laptops") },
        ],
      },
      {
        title: "PERIPHERALS & STORAGE",
        items: [
          { label: "Monitors & Screens", href: searchHref(CAT.computing, "Monitors & Screens") },
          { label: "External Hard Drives", href: searchHref(CAT.computing, "External Hard Drives") },
          { label: "SSDs & Flash Drives", href: searchHref(CAT.computing, "SSDs & Flash Drives") },
          { label: "Keyboards & Mice", href: searchHref(CAT.computing, "Keyboards & Mice") },
        ],
      },
    ],
    brands: [
      { name: "HP", href: brandHref(CAT.computing, "HP") },
      { name: "Dell", href: brandHref(CAT.computing, "Dell") },
      { name: "Lenovo", href: brandHref(CAT.computing, "Lenovo") },
      { name: "Apple", href: brandHref(CAT.computing, "Apple") },
      { name: "Asus", href: brandHref(CAT.computing, "Asus") },
    ],
  },
  {
    id: "baby-products",
    name: "Baby Products",
    icon: "baby",
    groups: [
      {
        title: "DIAPERING & FEEDING",
        items: [
          { label: "Diapers & Wipes", href: searchHref(CAT.baby, "Diapers & Wipes") },
          { label: "Baby Bottles", href: searchHref(CAT.baby, "Baby Bottles") },
          { label: "High Chairs", href: searchHref(CAT.baby, "High Chairs") },
        ],
      },
      {
        title: "BABY GEAR",
        items: [
          { label: "Strollers & Prams", href: searchHref(CAT.baby, "Strollers & Prams") },
          { label: "Car Seats", href: searchHref(CAT.baby, "Car Seats") },
          { label: "Walkers", href: searchHref(CAT.baby, "Walkers") },
        ],
      },
    ],
  },
  {
    id: "gaming",
    name: "Gaming",
    icon: "gaming",
    groups: [
      {
        title: "CONSOLES & GEAR",
        items: [
          { label: "PlayStation 5", href: searchHref(CAT.gaming, "PlayStation 5") },
          { label: "Xbox Series X/S", href: searchHref(CAT.gaming, "Xbox Series X/S") },
          { label: "Nintendo Switch", href: searchHref(CAT.gaming, "Nintendo Switch") },
        ],
      },
      {
        title: "ACCESSORIES",
        items: [
          { label: "Wireless Controllers", href: searchHref(CAT.gaming, "Wireless Controllers") },
          { label: "Gaming Headsets", href: searchHref(CAT.gaming, "Gaming Headsets") },
          { label: "Gaming Chairs", href: searchHref(CAT.gaming, "Gaming Chairs") },
        ],
      },
    ],
    brands: [
      { name: "PlayStation", href: brandHref(CAT.gaming, "PlayStation") },
      { name: "Xbox", href: brandHref(CAT.gaming, "Xbox") },
      { name: "Nintendo", href: brandHref(CAT.gaming, "Nintendo") },
      { name: "Razer", href: brandHref(CAT.gaming, "Razer") },
    ],
  },
  {
    id: "other-categories",
    name: "Other categories",
    icon: "grid",
    groups: [
      {
        title: "AUTOMOTIVE & SPORTS",
        items: [
          { label: "Car Care & Polish", href: "/search?q=car+care" },
          { label: "Auto Electronics", href: "/search?q=auto+electronics" },
          { label: "Fitness Equipment", href: "/search?q=fitness" },
        ],
      },
    ],
  },
];

// Helper to render category icon
function RenderCategoryIcon({ name, active }: { name: string; active: boolean }) {
  const strokeColor = active ? "#D97706" : "currentColor";
  const fillColor = active ? "#FBBF24" : "none";

  switch (name) {
    case "store":
      return (
        <svg className="w-4 h-4" fill={fillColor} stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
    case "appliance":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    case "phone":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      );
    case "beauty":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      );
    case "home":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      );
    case "tv":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-6-3v3m6-3l-1.5-1.5m-9 1.5L9 17.25m9-10.5h.008v.008H18V6.75zm-12 0h.008v.008H6V6.75zm12 3h.008v.008H18V9.75zm-12 0h.008v.008H6V9.75zM3.75 4.5h16.5c.621 0 1.125.504 1.125 1.125v10.5c0 .621-.504 1.125-1.125 1.125H3.75A1.125 1.125 0 012.625 16.125V5.625C2.625 5.004 3.129 4.5 3.75 4.5z" />
        </svg>
      );
    case "fashion":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      );
    case "supermarket":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 12a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      );
    case "computing":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
        </svg>
      );
    case "baby":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm6 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z" />
        </svg>
      );
    case "gaming":
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.498-.535.808-.71.312-.177.668-.268 1.041-.268.96 0 1.75.79 1.75 1.75 0 .373-.091.729-.268 1.041-.175.31-.42.587-.71.808-.283.215-.604.401-.959.401H14.25V6.087zM8.25 6.087V7.25H6.75c-.355 0-.676-.186-.959-.401-.29-.221-.535-.498-.71-.808A2.046 2.046 0 014.813 5c0-.96.79-1.75 1.75-1.75.373 0 .729.091 1.041.268.31.175.587.42.808.71.215.283.401.604.401.959z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke={strokeColor} viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      );
  }
}

export function CategoryMegaMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("appliances");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeCategory =
    MEGA_CATEGORIES.find((c) => c.id === activeCategoryId) || MEGA_CATEGORIES[0];

  const handleMouseEnter = () => {
    if (typeof window !== "undefined" && window.innerWidth < 640) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (typeof window !== "undefined" && window.innerWidth < 640) return;
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      if (typeof window !== "undefined" && window.innerWidth < 640) return;
      if (isOpen) setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Pill Button */}
      <button
        onClick={toggleMenu}
        aria-expanded={isOpen}
        className={`flex items-center justify-between min-w-[125px] sm:min-w-[155px] h-9 sm:h-[38px] text-[#010101] text-xs sm:text-sm font-medium pl-4 sm:pl-5 pr-[4px] sm:pr-[5px] rounded-full transition-colors duration-200 group shrink-0 ${
          isOpen ? "bg-[#EDCF5D]" : "bg-[#F2F0EA] hover:bg-[#EDCF5D]"
        }`}
      >
        <span className="font-semibold text-[#010101]">Categories</span>
        <div
          className={`w-7 h-7 sm:w-7 sm:h-7 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#010101] shrink-0 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <svg
            className="w-3 h-3 text-[#010101]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dark Screen Backdrop Overlay — Portaled directly to document.body */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40"
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Desktop Mega Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="hidden sm:block absolute left-0 top-full pt-2 z-50 w-[88vw] max-w-[940px] min-w-[720px]"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden flex h-[70vh] max-h-[520px] min-h-[360px] text-[#010101]">
              {/* Left Sidebar Panel */}
              <div className="w-[235px] shrink-0 bg-[#F9F8F5] border-r border-gray-200/80 py-2.5 px-2.5 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-0.5 gts-scrollbar py-0.5 pr-1">
                  {MEGA_CATEGORIES.map((cat) => {
                    const isActive = cat.id === activeCategoryId;
                    return (
                      <button
                        key={cat.id}
                        onMouseEnter={() => setActiveCategoryId(cat.id)}
                        onClick={() => setActiveCategoryId(cat.id)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-colors text-left font-semibold border ${
                          isActive
                            ? "bg-white text-[#D97706] shadow-xs border-amber-200/80"
                            : "border-transparent text-gray-700 hover:bg-white/60 hover:text-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <RenderCategoryIcon name={cat.icon} active={isActive} />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          {isActive && (
                            <svg className="w-3.5 h-3.5 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Content Panel */}
              <div className="flex-1 p-6 overflow-y-auto bg-white h-full gts-scrollbar">
                {activeCategory && (
                  <motion.div
                    key={activeCategory.id}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className="grid grid-cols-3 gap-6"
                  >
                    {/* Top Row: Category Title & Direct Link */}
                    <div className="col-span-3 flex items-center justify-between border-b border-gray-100 pb-2 mb-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest font-sans">
                        {activeCategory.name}
                      </span>
                      <Link
                        href={`/search?category=${encodeURIComponent(activeCategory.name)}`}
                        onClick={() => setIsOpen(false)}
                        className="text-xs font-bold text-[#D97706] hover:text-[#B45309] flex items-center gap-1 transition-colors font-sans"
                      >
                        All {activeCategory.name} products →
                      </Link>
                    </div>

                    {/* Columns 1 & 2: Subcategory Groups */}
                    <div className="col-span-2 grid grid-cols-2 gap-6">
                      {activeCategory.groups.map((group, idx) => (
                        <div key={idx} className="space-y-2.5">
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200/80 pb-1.5">
                            {group.title}
                          </h4>
                          <ul className="space-y-1.5 text-xs text-gray-600 font-normal">
                            {group.items.map((item, i) => (
                              <li key={i}>
                                <Link
                                  href={item.href}
                                  onClick={() => setIsOpen(false)}
                                  className="hover:text-[#D97706] transition-colors block py-0.5 truncate"
                                >
                                  {item.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Column 3: Brands List */}
                    {activeCategory.brands && activeCategory.brands.length > 0 && (
                      <div className="space-y-2.5 border-l border-gray-100 pl-5">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200/80 pb-1.5">
                          TOP BRANDS
                        </h4>
                        <ul className="space-y-1.5 text-xs text-gray-500 font-medium">
                          {activeCategory.brands.map((brand, i) => (
                            <li key={i}>
                              <Link
                                href={brand.href}
                                onClick={() => setIsOpen(false)}
                                className="hover:text-[#D97706] transition-colors block py-0.5"
                              >
                                {brand.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Sheet Panel */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 90 || info.velocity.y > 400) {
                    setIsOpen(false);
                  }
                }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-50 sm:hidden bg-white rounded-t-3xl h-[75vh] max-h-[75vh] flex flex-col p-4 shadow-2xl border-t border-gray-200"
              >
                {/* Drag handle & Header */}
                <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2 shrink-0" />
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
                  <h3 className="text-sm font-bold text-[#010101] uppercase tracking-wide">Categories</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Horizontal Category Chips Track */}
                <div className="flex items-center gap-2 overflow-x-auto py-3 shrink-0 gts-scrollbar border-b border-gray-100">
                  {MEGA_CATEGORIES.map((cat) => {
                    const isActive = cat.id === activeCategoryId;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategoryId(cat.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 border ${
                          isActive
                            ? "bg-[#EDCF5D] text-[#010101] border-amber-300 shadow-2xs"
                            : "bg-[#F2F0EA] text-gray-700 border-transparent hover:bg-gray-200"
                        }`}
                      >
                        <RenderCategoryIcon name={cat.icon} active={isActive} />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Category Subcategories & Brands */}
                <div className="flex-1 overflow-y-auto pt-3 pb-6 space-y-5 gts-scrollbar">
                  {activeCategory && (
                    <motion.div
                      key={`mobile-${activeCategory.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      {activeCategory.groups.map((group, idx) => (
                        <div key={idx} className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-1">
                            {group.title}
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 font-medium pt-1">
                            {group.items.map((item, i) => (
                              <Link
                                key={i}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className="p-2 bg-[#F9F8F5] rounded-xl hover:bg-[#EDCF5D]/20 hover:text-[#D97706] transition-colors truncate"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}

                      {activeCategory.brands && activeCategory.brands.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-1">
                            TOP BRANDS
                          </h4>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {activeCategory.brands.map((brand, i) => (
                              <Link
                                key={i}
                                href={brand.href}
                                onClick={() => setIsOpen(false)}
                                className="px-3 py-1.5 bg-[#F9F8F5] text-xs text-gray-800 font-semibold rounded-lg hover:bg-[#EDCF5D] hover:text-[#010101] transition-colors"
                              >
                                {brand.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
