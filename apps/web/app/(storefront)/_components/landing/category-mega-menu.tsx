"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

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

export const MEGA_CATEGORIES: CategoryItem[] = [
  {
    id: "appliances",
    name: "Appliances",
    icon: "appliance",
    groups: [
      {
        title: "SMALL APPLIANCES",
        items: [
          { label: "Blenders", href: "/categories/appliances/blenders" },
          { label: "Deep Fryers", href: "/categories/appliances/deep-fryers" },
          { label: "Juicers", href: "/categories/appliances/juicers" },
          { label: "Air Fryers", href: "/categories/appliances/air-fryers" },
          { label: "Rice Cookers", href: "/categories/appliances/rice-cookers" },
          { label: "Toasters & Ovens", href: "/categories/appliances/toasters-ovens" },
          { label: "Microwaves", href: "/categories/appliances/microwaves" },
          { label: "Bundles", href: "/categories/appliances/bundles" },
          { label: "Vacuum Cleaners", href: "/categories/appliances/vacuum-cleaners" },
          { label: "Kettles", href: "/categories/appliances/kettles" },
          { label: "Yam Pounders", href: "/categories/appliances/yam-pounders" },
          { label: "Irons", href: "/categories/appliances/irons" },
          { label: "Electric Cookware", href: "/categories/appliances/cookware" },
          { label: "Electric Drink Mixers", href: "/categories/appliances/mixers" },
          { label: "Food Processors", href: "/categories/appliances/food-processors" },
          { label: "Coffee Makers", href: "/categories/appliances/coffee-makers" },
          { label: "Electric Pressure Cookers", href: "/categories/appliances/pressure-cookers" },
        ],
      },
      {
        title: "LARGE APPLIANCES",
        items: [
          { label: "Washing Machines", href: "/categories/appliances/washers" },
          { label: "Fridges", href: "/categories/appliances/fridges" },
          { label: "Freezers", href: "/categories/appliances/freezers" },
          { label: "Air Conditioners", href: "/categories/appliances/ac" },
          { label: "Heaters", href: "/categories/appliances/heaters" },
          { label: "Fans", href: "/categories/appliances/fans" },
          { label: "Air Purifiers", href: "/categories/appliances/purifiers" },
          { label: "Water Dispensers", href: "/categories/appliances/water-dispensers" },
          { label: "Generators & Inverters", href: "/categories/appliances/generators" },
        ],
      },
      {
        title: "HOME APPLIANCES",
        items: [
          { label: "Air Quality Control", href: "/categories/appliances/air-quality" },
          { label: "Cleaning Equipment", href: "/categories/appliances/cleaning" },
          { label: "Sewing Machines", href: "/categories/appliances/sewing" },
          { label: "Water Heaters", href: "/categories/appliances/water-heaters" },
        ],
      },
    ],
    brands: [
      { name: "Nexus", href: "/brands/nexus" },
      { name: "Hisense", href: "/brands/hisense" },
      { name: "Polystar", href: "/brands/polystar" },
      { name: "TCL", href: "/brands/tcl" },
      { name: "LG", href: "/brands/lg" },
      { name: "Samsung", href: "/brands/samsung" },
    ],
  },
  {
    id: "official-store",
    name: "Official Store",
    icon: "store",
    groups: [
      {
        title: "FEATURED STORES",
        items: [
          { label: "Apple Store", href: "/official/apple" },
          { label: "Samsung Store", href: "/official/samsung" },
          { label: "Google Pixel Store", href: "/official/google" },
          { label: "Nike Store", href: "/official/nike" },
          { label: "Sony Store", href: "/official/sony" },
          { label: "LG Official", href: "/official/lg" },
        ],
      },
      {
        title: "EXCLUSIVE DEALS",
        items: [
          { label: "Flash Sales", href: "/official/flash-sales" },
          { label: "Brand Week Offers", href: "/official/brand-week" },
          { label: "Manufacturer Warranty Products", href: "/official/warranty" },
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
          { label: "Smartphones", href: "/categories/phones/smartphones" },
          { label: "iOS Phones", href: "/categories/phones/ios" },
          { label: "Android Phones", href: "/categories/phones/android" },
          { label: "Basic Phones", href: "/categories/phones/basic" },
          { label: "Refurbished Phones", href: "/categories/phones/refurbished" },
        ],
      },
      {
        title: "TABLETS",
        items: [
          { label: "iPads", href: "/categories/tablets/ipads" },
          { label: "Android Tablets", href: "/categories/tablets/android" },
          { label: "Educational Tablets", href: "/categories/tablets/kids" },
          { label: "Graphics Tablets", href: "/categories/tablets/graphics" },
        ],
      },
      {
        title: "ACCESSORIES",
        items: [
          { label: "Cases & Covers", href: "/categories/phone-accessories/cases" },
          { label: "Screen Protectors", href: "/categories/phone-accessories/screens" },
          { label: "Power Banks", href: "/categories/phone-accessories/powerbanks" },
          { label: "Chargers & Cables", href: "/categories/phone-accessories/chargers" },
          { label: "Earphones & Headsets", href: "/categories/phone-accessories/earphones" },
          { label: "Smartwatches & Bands", href: "/categories/phone-accessories/smartwatches" },
        ],
      },
    ],
    brands: [
      { name: "Apple", href: "/brands/apple" },
      { name: "Samsung", href: "/brands/samsung" },
      { name: "Google Pixel", href: "/brands/google" },
      { name: "Xiaomi", href: "/brands/xiaomi" },
      { name: "Infinix", href: "/brands/infinix" },
      { name: "Tecno", href: "/brands/tecno" },
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
          { label: "Face Cleansers", href: "/categories/beauty/cleansers" },
          { label: "Moisturizers & Creams", href: "/categories/beauty/moisturizers" },
          { label: "Sunscreen & SPF", href: "/categories/beauty/sunscreen" },
          { label: "Serums & Oils", href: "/categories/beauty/serums" },
          { label: "Face Masks", href: "/categories/beauty/masks" },
        ],
      },
      {
        title: "FRAGRANCES",
        items: [
          { label: "Men's Perfumes", href: "/categories/beauty/mens-fragrance" },
          { label: "Women's Perfumes", href: "/categories/beauty/womens-fragrance" },
          { label: "Body Mists & Sprays", href: "/categories/beauty/mists" },
          { label: "Deodorants", href: "/categories/beauty/deodorants" },
        ],
      },
      {
        title: "HAIR CARE",
        items: [
          { label: "Shampoos & Conditioners", href: "/categories/beauty/shampoos" },
          { label: "Styling Tools & Irons", href: "/categories/beauty/hair-tools" },
          { label: "Wigs & Extensions", href: "/categories/beauty/wigs" },
        ],
      },
    ],
    brands: [
      { name: "Nivea", href: "/brands/nivea" },
      { name: "CeraVe", href: "/brands/cerave" },
      { name: "Maybelline", href: "/brands/maybelline" },
      { name: "Fenty Beauty", href: "/brands/fenty" },
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
          { label: "Office Chairs", href: "/categories/home-office/chairs" },
          { label: "Executive Desks", href: "/categories/home-office/desks" },
          { label: "Living Room Sofas", href: "/categories/home-office/sofas" },
          { label: "Bed Frames & Tables", href: "/categories/home-office/bedroom" },
        ],
      },
      {
        title: "BEDDING & BATH",
        items: [
          { label: "Bed Sheets & Pillowcases", href: "/categories/home-office/sheets" },
          { label: "Duvets & Comforters", href: "/categories/home-office/duvets" },
          { label: "Bath Towels", href: "/categories/home-office/towels" },
        ],
      },
      {
        title: "DECOR & LIGHTING",
        items: [
          { label: "Table Lamps & Bulbs", href: "/categories/home-office/lamps" },
          { label: "Wall Art & Clocks", href: "/categories/home-office/wall-art" },
          { label: "Rugs & Carpets", href: "/categories/home-office/rugs" },
        ],
      },
    ],
    brands: [
      { name: "IKEA", href: "/brands/ikea" },
      { name: "Bedmate", href: "/brands/bedmate" },
      { name: "Century", href: "/brands/century" },
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
          { label: "Smart TVs", href: "/categories/electronics/smart-tvs" },
          { label: "OLED & QLED TVs", href: "/categories/electronics/oled" },
          { label: "4K UHD TVs", href: "/categories/electronics/4k-tvs" },
          { label: "Projectors & Screens", href: "/categories/electronics/projectors" },
        ],
      },
      {
        title: "AUDIO & SOUND",
        items: [
          { label: "Soundbars & Subwoofers", href: "/categories/electronics/soundbars" },
          { label: "Home Theatre Systems", href: "/categories/electronics/home-theatre" },
          { label: "Bluetooth Speakers", href: "/categories/electronics/bluetooth-speakers" },
        ],
      },
    ],
    brands: [
      { name: "Sony", href: "/brands/sony" },
      { name: "Samsung", href: "/brands/samsung" },
      { name: "Hisense", href: "/brands/hisense" },
      { name: "LG", href: "/brands/lg" },
      { name: "JBL", href: "/brands/jbl" },
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
          { label: "Dresses", href: "/categories/fashion/dresses" },
          { label: "Tops & Blouses", href: "/categories/fashion/tops" },
          { label: "Footwear & Heels", href: "/categories/fashion/heels" },
          { label: "Handbags & Clutches", href: "/categories/fashion/bags" },
        ],
      },
      {
        title: "MEN'S FASHION",
        items: [
          { label: "Casual T-Shirts", href: "/categories/fashion/tshirts" },
          { label: "Formal Shirts", href: "/categories/fashion/shirts" },
          { label: "Jeans & Trousers", href: "/categories/fashion/jeans" },
          { label: "Sneakers & Boots", href: "/categories/fashion/sneakers" },
        ],
      },
    ],
    brands: [
      { name: "Nike", href: "/brands/nike" },
      { name: "Adidas", href: "/brands/adidas" },
      { name: "Zara", href: "/brands/zara" },
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
          { label: "Juices & Drinks", href: "/categories/groceries/juices" },
          { label: "Coffee & Tea", href: "/categories/groceries/coffee" },
          { label: "Energy & Soft Drinks", href: "/categories/groceries/soft-drinks" },
        ],
      },
      {
        title: "FOOD STAPLES",
        items: [
          { label: "Rice & Grains", href: "/categories/groceries/rice" },
          { label: "Pasta & Noodles", href: "/categories/groceries/pasta" },
          { label: "Cooking Oils", href: "/categories/groceries/oils" },
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
          { label: "Gaming Laptops", href: "/categories/computing/gaming-laptops" },
          { label: "MacBooks", href: "/categories/computing/macbooks" },
          { label: "Ultrabooks & Slims", href: "/categories/computing/ultrabooks" },
          { label: "Business Laptops", href: "/categories/computing/business" },
        ],
      },
      {
        title: "PERIPHERALS & STORAGE",
        items: [
          { label: "Monitors & Screens", href: "/categories/computing/monitors" },
          { label: "External Hard Drives", href: "/categories/computing/hard-drives" },
          { label: "SSDs & Flash Drives", href: "/categories/computing/ssds" },
          { label: "Keyboards & Mice", href: "/categories/computing/keyboards" },
        ],
      },
    ],
    brands: [
      { name: "HP", href: "/brands/hp" },
      { name: "Dell", href: "/brands/dell" },
      { name: "Lenovo", href: "/brands/lenovo" },
      { name: "Apple", href: "/brands/apple" },
      { name: "Asus", href: "/brands/asus" },
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
          { label: "Diapers & Wipes", href: "/categories/baby/diapers" },
          { label: "Baby Bottles", href: "/categories/baby/bottles" },
          { label: "High Chairs", href: "/categories/baby/high-chairs" },
        ],
      },
      {
        title: "BABY GEAR",
        items: [
          { label: "Strollers & Prams", href: "/categories/baby/strollers" },
          { label: "Car Seats", href: "/categories/baby/car-seats" },
          { label: "Walkers", href: "/categories/baby/walkers" },
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
          { label: "PlayStation 5", href: "/categories/gaming/ps5" },
          { label: "Xbox Series X/S", href: "/categories/gaming/xbox" },
          { label: "Nintendo Switch", href: "/categories/gaming/switch" },
        ],
      },
      {
        title: "ACCESSORIES",
        items: [
          { label: "Wireless Controllers", href: "/categories/gaming/controllers" },
          { label: "Gaming Headsets", href: "/categories/gaming/headsets" },
          { label: "Gaming Chairs", href: "/categories/gaming/chairs" },
        ],
      },
    ],
    brands: [
      { name: "PlayStation", href: "/brands/playstation" },
      { name: "Xbox", href: "/brands/xbox" },
      { name: "Nintendo", href: "/brands/nintendo" },
      { name: "Razer", href: "/brands/razer" },
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
          { label: "Car Care & Polish", href: "/categories/auto/car-care" },
          { label: "Auto Electronics", href: "/categories/auto/electronics" },
          { label: "Fitness Equipment", href: "/categories/sports/fitness" },
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
        className={`flex items-center justify-between min-w-[125px] sm:min-w-[165px] h-9 sm:h-[38px] text-[#010101] text-xs sm:text-sm font-medium pl-4 sm:pl-5 pr-1 rounded-full transition-colors duration-200 group shrink-0 ${
          isOpen ? "bg-[#EDCF5D]" : "bg-[#F2F0EA] hover:bg-[#EDCF5D]"
        }`}
      >
        <span className="font-semibold text-[#010101]">Categories</span>
        <div
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#010101] shrink-0 transition-transform duration-300 ${
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
