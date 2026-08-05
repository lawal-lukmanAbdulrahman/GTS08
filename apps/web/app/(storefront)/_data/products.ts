export interface ProductColorOption {
  color: string;
  label: string;
  main: string;
  thumbnails: string[];
}

export interface ProductItem {
  id: string;
  brand: string;
  sku: string;
  title: string;
  price: string;
  originalPrice?: string;
  priceNum: number;
  badge?: string;
  rating: number;
  reviewsCount: number;
  reviews: string;
  description: string;
  category: string;
  subCategory: string;
  image: string;
  images: ProductColorOption[];
  sizes: string[];
  tags: string[];
  hasTransparentBg?: boolean;
}

// ─── Central Brand Registry ───────────────────────────────────────────────────
// This is the SINGLE SOURCE OF TRUTH for brand names.
// • key     → used in ?brand=KEY URL param (lowercase, URL-safe)
// • label   → displayed in sidebar, mega-menu, breadcrumbs
// • category → which mega-menu category this brand appears under (null = Official Store / cross-category)
export interface BrandEntry {
  key: string;
  label: string;
  category: string | null;
}

export const BRAND_REGISTRY: BrandEntry[] = [
  // Official / cross-category stores
  { key: "Apple",         label: "Apple",          category: null },
  { key: "Samsung",       label: "Samsung",        category: null },
  { key: "Google",        label: "Google",         category: null },
  { key: "Nike",          label: "Nike",           category: null },
  { key: "Sony",          label: "Sony",           category: null },
  { key: "LG",            label: "LG",             category: null },

  // Phones & Tablets
  { key: "Xiaomi",        label: "Xiaomi",         category: "Phones & Tablets" },
  { key: "Infinix",       label: "Infinix",        category: "Phones & Tablets" },
  { key: "Tecno",         label: "Tecno",          category: "Phones & Tablets" },

  // Electronics
  { key: "Hisense",       label: "Hisense",        category: "Electronics" },
  { key: "JBL",           label: "JBL",            category: "Electronics" },

  // Appliances
  { key: "Nexus",         label: "Nexus",          category: "Appliances" },
  { key: "Philips",       label: "Philips",        category: "Appliances" },
  { key: "Ninja",         label: "Ninja",          category: "Appliances" },
  { key: "Hurom",         label: "Hurom",          category: "Appliances" },
  { key: "MasterChef",    label: "MasterChef",     category: "Appliances" },
  { key: "DeLonghi",      label: "DeLonghi",       category: "Appliances" },
  { key: "Haier",         label: "Haier",          category: "Appliances" },
  { key: "OX",            label: "OX",             category: "Appliances" },
  { key: "TCL",           label: "TCL",            category: "Appliances" },
  { key: "Polystar",      label: "Polystar",       category: "Appliances" },

  // Fashion
  { key: "Air Jordan",    label: "Air Jordan",     category: "Fashion" },
  { key: "Adidas",        label: "Adidas",         category: "Fashion" },
  { key: "Zara",          label: "Zara",           category: "Fashion" },
  { key: "GTS",           label: "GTS",            category: "Fashion" },

  // Computing
  { key: "HP",            label: "HP",             category: "Computing" },
  { key: "Dell",          label: "Dell",           category: "Computing" },
  { key: "Lenovo",        label: "Lenovo",         category: "Computing" },
  { key: "Asus",          label: "Asus",           category: "Computing" },

  // Health & Beauty
  { key: "Nivea",         label: "Nivea",          category: "Health & Beauty" },
  { key: "CeraVe",        label: "CeraVe",         category: "Health & Beauty" },
  { key: "Maybelline",    label: "Maybelline",     category: "Health & Beauty" },
  { key: "Fenty Beauty",  label: "Fenty Beauty",   category: "Health & Beauty" },

  // Gaming
  { key: "PlayStation",   label: "PlayStation",    category: "Gaming" },
  { key: "Xbox",          label: "Xbox",           category: "Gaming" },
  { key: "Nintendo",      label: "Nintendo",       category: "Gaming" },
  { key: "Razer",         label: "Razer",          category: "Gaming" },

  // Home & Office
  { key: "IKEA",          label: "IKEA",           category: "Home & Office" },
];

/** Look up a brand entry by its key (case-insensitive). */
export function getBrandByKey(key: string): BrandEntry | undefined {
  return BRAND_REGISTRY.find((b) => b.key.toLowerCase() === key.toLowerCase());
}

/** All unique brand keys, sorted alphabetically. */
export const ALL_BRAND_KEYS: string[] = BRAND_REGISTRY.map((b) => b.key).sort();



export const REAL_PRODUCTS: ProductItem[] = [
  // ── FASHION ───────────────────────────────────────────────────────────────
  {
    id: "air-jordan-1",
    brand: "Air Jordan",
    sku: "AJ1-OG-2026",
    title: "Air Jordan 1 Retro High OG",
    price: "₦450,000",
    originalPrice: "₦520,000",
    priceNum: 450000,
    badge: "POPULAR",
    rating: 4.9,
    reviewsCount: 3200,
    reviews: "3.2k",
    description:
      "Crafted with premium full-grain leather, classic Air cushioning, and timeless heritage design. The Air Jordan 1 Retro High OG combines legendary street culture with unmatched modern comfort.",
    category: "Fashion",
    subCategory: "Sneakers & Boots",
    image: "/products/hero/air_jordan_retro_1_blue.png",
    images: [
      {
        color: "blue",
        label: "University Blue",
        main: "/products/hero/air_jordan_retro_1_blue.png",
        thumbnails: [
          "/products/hero/air_jordan_retro_1_blue.png",
          "/products/hero/air_jordan_retro_1_brown.png",
          "/products/hero/air_jordan_retro_1_green.png",
        ],
      },
      {
        color: "brown",
        label: "Mocha Brown",
        main: "/products/hero/air_jordan_retro_1_brown.png",
        thumbnails: [
          "/products/hero/air_jordan_retro_1_brown.png",
          "/products/hero/air_jordan_retro_1_blue.png",
          "/products/hero/air_jordan_retro_1_green.png",
        ],
      },
      {
        color: "green",
        label: "Pine Green",
        main: "/products/hero/air_jordan_retro_1_green.png",
        thumbnails: [
          "/products/hero/air_jordan_retro_1_green.png",
          "/products/hero/air_jordan_retro_1_blue.png",
          "/products/hero/air_jordan_retro_1_brown.png",
        ],
      },
    ],
    sizes: ["40.5", "41", "42", "43", "44", "45"],
    tags: ["Sneakers", "Men", "Limited", "Footwear", "Premium"],
  },
  {
    id: "denim-jacket",
    brand: "GTS",
    sku: "GTS-DNM-JKT-01",
    title: "Urban Vintage Denim Jacket",
    price: "₦32,400",
    originalPrice: "₦64,800",
    priceNum: 32400,
    badge: "50% OFF",
    rating: 4.6,
    reviewsCount: 892,
    reviews: "892",
    description:
      "Heavyweight 14oz cotton denim jacket featuring a classic vintage wash, button front closure, adjustable waist tabs, and dual chest flap pockets.",
    category: "Fashion",
    subCategory: "Men's Clothing",
    image: "/products/denim_jacket.png",
    images: [
      {
        color: "blue",
        label: "Vintage Wash Blue",
        main: "/products/denim_jacket.png",
        thumbnails: [
          "/products/denim_jacket.png",
          "/products/hoodie.png",
          "/products/oxford_shirt.png",
        ],
      },
    ],
    sizes: ["S", "M", "L", "XL"],
    tags: ["Men", "Jacket", "Casual", "Fashion", "Streetwear"],
  },
  {
    id: "oxford-shirt",
    brand: "GTS",
    sku: "GTS-OXF-SHT-02",
    title: "Classic Cotton Oxford Shirt",
    price: "₦32,400",
    originalPrice: "₦48,000",
    priceNum: 32400,
    badge: "BESTSELLER",
    rating: 4.5,
    reviewsCount: 560,
    reviews: "560",
    description:
      "Tailored 100% long-staple cotton Oxford shirt featuring a button-down collar, chest patch pocket, and breathable basketweave fabric.",
    category: "Fashion",
    subCategory: "Men's Clothing",
    image: "/products/oxford_shirt.png",
    images: [
      {
        color: "blue",
        label: "Light Blue",
        main: "/products/oxford_shirt.png",
        thumbnails: ["/products/oxford_shirt.png", "/products/linen_coat.png"],
      },
    ],
    sizes: ["S", "M", "L", "XL"],
    tags: ["Men", "Formal", "Shirt", "Fashion"],
  },
  {
    id: "hoodie",
    brand: "GTS",
    sku: "GTS-STR-HDD-03",
    title: "Heavyweight Oversized Streetwear Hoodie",
    price: "₦32,400",
    originalPrice: "₦64,800",
    priceNum: 32400,
    badge: "50% OFF",
    rating: 4.7,
    reviewsCount: 1100,
    reviews: "1.1k",
    description:
      "Ultra-soft 450GSM cotton fleece hoodie built with a drop-shoulder cut, double-lined hood, seamless kangaroo pocket, and heavy ribbed hems.",
    category: "Fashion",
    subCategory: "Men's Clothing",
    image: "/products/hoodie.png",
    images: [
      {
        color: "black",
        label: "Jet Black",
        main: "/products/hoodie.png",
        thumbnails: ["/products/hoodie.png", "/products/denim_jacket.png"],
      },
    ],
    sizes: ["S", "M", "L", "XL"],
    tags: ["Men", "Casual", "Streetwear", "Fashion"],
  },
  {
    id: "linen-coat",
    brand: "GTS",
    sku: "GTS-LX-LNN-04",
    title: "Tailored Lightweight Linen Coat",
    price: "₦32,400",
    originalPrice: "₦64,800",
    priceNum: 32400,
    badge: "50% OFF",
    rating: 4.9,
    reviewsCount: 1500,
    reviews: "1.5k",
    description:
      "Exquisite European linen overcoat tailored with notch lapels, unlined interior for summer ventilation, and deep welt pockets.",
    category: "Fashion",
    subCategory: "Outerwear",
    image: "/products/linen_coat.png",
    images: [
      {
        color: "beige",
        label: "Natural Beige",
        main: "/products/linen_coat.png",
        thumbnails: ["/products/linen_coat.png", "/products/oxford_shirt.png"],
      },
    ],
    sizes: ["M", "L", "XL"],
    tags: ["Men", "Formal", "Premium", "Fashion"],
  },

  // ── PHONES & TABLETS ──────────────────────────────────────────────────────
  {
    id: "pixel-10",
    brand: "Google",
    sku: "G-PX10-PRO",
    title: "Google Pixel 10 Pro 5G",
    price: "₦1,250,000",
    originalPrice: "₦1,400,000",
    priceNum: 1250000,
    badge: "HOT",
    rating: 4.8,
    reviewsCount: 2300,
    reviews: "2.3k",
    description:
      "Next-generation AI computational photography, pro-level triple camera system with 5× telephoto zoom, and ultra-smooth OLED display powered by the Tensor G5 chip.",
    category: "Phones & Tablets",
    subCategory: "Smartphones",
    image: "/products/hero/pixel_10_metal.png",
    images: [
      {
        color: "metal",
        label: "Titanium Metal",
        main: "/products/hero/pixel_10_metal.png",
        thumbnails: [
          "/products/hero/pixel_10_metal.png",
          "/products/hero/pixel_10_green.png",
          "/products/hero/pixel_10_purple.png",
          "/products/hero/pixel_10_red.png",
        ],
      },
      {
        color: "green",
        label: "Hazel Green",
        main: "/products/hero/pixel_10_green.png",
        thumbnails: [
          "/products/hero/pixel_10_green.png",
          "/products/hero/pixel_10_metal.png",
          "/products/hero/pixel_10_purple.png",
          "/products/hero/pixel_10_red.png",
        ],
      },
      {
        color: "purple",
        label: "Obsidian Purple",
        main: "/products/hero/pixel_10_purple.png",
        thumbnails: [
          "/products/hero/pixel_10_purple.png",
          "/products/hero/pixel_10_metal.png",
          "/products/hero/pixel_10_green.png",
          "/products/hero/pixel_10_red.png",
        ],
      },
      {
        color: "red",
        label: "Coral Red",
        main: "/products/hero/pixel_10_red.png",
        thumbnails: [
          "/products/hero/pixel_10_red.png",
          "/products/hero/pixel_10_metal.png",
          "/products/hero/pixel_10_green.png",
          "/products/hero/pixel_10_purple.png",
        ],
      },
    ],
    sizes: ["128GB", "256GB", "512GB", "1TB"],
    tags: ["Smartphone", "Tech", "Android", "5G", "Hot"],
  },

  // ── ELECTRONICS ───────────────────────────────────────────────────────────
  {
    id: "tv",
    brand: "Sony",
    sku: "SN-TV-55-4K",
    title: "Sony BRAVIA 55\" 4K HDR Smart Google TV",
    price: "₦380,000",
    originalPrice: "₦450,000",
    priceNum: 380000,
    badge: "POPULAR",
    rating: 4.7,
    reviewsCount: 1900,
    reviews: "1.9k",
    description:
      "Stunning 4K Processor X1 with TRILUMINOS PRO colors, Google TV smart interface with voice search, and Dolby Vision/Atmos immersive audio.",
    category: "Electronics",
    subCategory: "Smart TVs",
    image: "/products/tv-removebg-preview.png",
    images: [
      {
        color: "black",
        label: "Matte Black",
        main: "/products/tv-removebg-preview.png",
        thumbnails: [
          "/products/tv-removebg-preview.png",
          "/products/spiderman_ps5.png",
        ],
      },
    ],
    sizes: ["55 inch"],
    tags: ["Tech", "Home", "Entertainment", "Electronics"],
  },

  // ── GAMING ────────────────────────────────────────────────────────────────
  {
    id: "spiderman-ps5",
    brand: "PlayStation",
    sku: "PS5-SM2-BNDL",
    title: "PlayStation 5 Console Spider-Man 2 Bundle",
    price: "₦180,000",
    originalPrice: "₦220,000",
    priceNum: 180000,
    badge: "LIMITED",
    rating: 4.9,
    reviewsCount: 4100,
    reviews: "4.1k",
    description:
      "Experience lightning-fast loading with an ultra-high speed SSD, deeper immersion with haptic feedback, and a custom Symbiote takeover console design.",
    category: "Gaming",
    subCategory: "PlayStation 5",
    image: "/products/spiderman_ps5.png",
    images: [
      {
        color: "custom",
        label: "Symbiote Red/Black",
        main: "/products/spiderman_ps5.png",
        thumbnails: [
          "/products/spiderman_ps5.png",
          "/products/tv-removebg-preview.png",
        ],
      },
    ],
    sizes: ["Disc Edition"],
    tags: ["Gaming", "Tech", "Limited", "Console"],
  },

  // ── APPLIANCES ────────────────────────────────────────────────────────────
  {
    id: "nexus-washing-machine",
    brand: "Nexus",
    sku: "NX-WM-TT-2026",
    title: "Nexus Twin Tub Washing Machine",
    price: "₦185,000",
    originalPrice: "₦220,000",
    priceNum: 185000,
    badge: "NEW",
    rating: 4.7,
    reviewsCount: 840,
    reviews: "840",
    description:
      "Heavy-duty twin tub washer with rust-free plastic body, powerful pulsator washing technology, and high-speed spin dry cycle for efficient laundry care.",
    category: "Appliances",
    subCategory: "Washing Machines",
    image: "/products/hero/nexus_washing_machine_blue.png",
    images: [
      {
        color: "blue",
        label: "Royal Blue",
        main: "/products/hero/nexus_washing_machine_blue.png",
        thumbnails: [
          "/products/hero/nexus_washing_machine_blue.png",
          "/products/hero/nexus_washing_machine_grey.png",
          "/products/hero/nexus_washing_machine_white.png",
          "/products/hero/nexus_washing_machine_green.png",
        ],
      },
      {
        color: "grey",
        label: "Metallic Grey",
        main: "/products/hero/nexus_washing_machine_grey.png",
        thumbnails: [
          "/products/hero/nexus_washing_machine_grey.png",
          "/products/hero/nexus_washing_machine_blue.png",
          "/products/hero/nexus_washing_machine_white.png",
          "/products/hero/nexus_washing_machine_yellow.png",
        ],
      },
      {
        color: "white",
        label: "Classic White",
        main: "/products/hero/nexus_washing_machine_white.png",
        thumbnails: [
          "/products/hero/nexus_washing_machine_white.png",
          "/products/hero/nexus_washing_machine_blue.png",
          "/products/hero/nexus_washing_machine_grey.png",
        ],
      },
      {
        color: "green",
        label: "Mint Green",
        main: "/products/hero/nexus_washing_machine_green.png",
        thumbnails: [
          "/products/hero/nexus_washing_machine_green.png",
          "/products/hero/nexus_washing_machine_blue.png",
          "/products/hero/nexus_washing_machine_grey.png",
        ],
      },
      {
        color: "yellow",
        label: "Solar Yellow",
        main: "/products/hero/nexus_washing_machine_yellow.png",
        thumbnails: [
          "/products/hero/nexus_washing_machine_yellow.png",
          "/products/hero/nexus_washing_machine_blue.png",
          "/products/hero/nexus_washing_machine_white.png",
        ],
      },
    ],
    sizes: ["7.5kg", "9kg", "12kg"],
    tags: ["Appliance", "Home", "Laundry", "New"],
  },
  {
    id: "samsung-fridge",
    brand: "Samsung",
    sku: "SS-BS-4D-2026",
    title: "Samsung Bespoke 4-Door French Door Refrigerator",
    price: "₦2,450,000",
    originalPrice: "₦2,800,000",
    priceNum: 2450000,
    badge: "PREMIUM",
    rating: 5.0,
    reviewsCount: 1900,
    reviews: "1.9k",
    description:
      "Customizable color door panels, Beverage Center with AutoFill Pitcher, and Dual Auto Ice Maker for ultimate modern kitchen luxury and smart cooling.",
    category: "Appliances",
    subCategory: "Fridges",
    image: "/products/hero/samsung_fridge_black.png",
    images: [
      {
        color: "black",
        label: "Matte Black",
        main: "/products/hero/samsung_fridge_black.png",
        thumbnails: [
          "/products/hero/samsung_fridge_black.png",
          "/products/hero/samsung_fridge_grey.png",
          "/products/hero/samsung_fridge_white.png",
          "/products/hero/samsung_fridge_bronze.png",
        ],
      },
      {
        color: "bronze",
        label: "Tuscan Bronze",
        main: "/products/hero/samsung_fridge_bronze.png",
        thumbnails: [
          "/products/hero/samsung_fridge_bronze.png",
          "/products/hero/samsung_fridge_black.png",
          "/products/hero/samsung_fridge_grey.png",
          "/products/hero/samsung_fridge_white.png",
        ],
      },
      {
        color: "grey",
        label: "Stainless Grey",
        main: "/products/hero/samsung_fridge_grey.png",
        thumbnails: [
          "/products/hero/samsung_fridge_grey.png",
          "/products/hero/samsung_fridge_black.png",
          "/products/hero/samsung_fridge_white.png",
        ],
      },
      {
        color: "white",
        label: "Custom White",
        main: "/products/hero/samsung_fridge_white.png",
        thumbnails: [
          "/products/hero/samsung_fridge_white.png",
          "/products/hero/samsung_fridge_black.png",
          "/products/hero/samsung_fridge_grey.png",
        ],
      },
    ],
    sizes: ["24 cu. ft.", "29 cu. ft."],
    tags: ["Appliance", "Home", "Kitchen", "Luxury"],
  },
  {
    id: "airfryer",
    brand: "Philips",
    sku: "PHP-AF-55L-01",
    title: "Digital Air Fryer 5.5L Rapid Air",
    price: "₦85,000",
    originalPrice: "₦110,000",
    priceNum: 85000,
    badge: "DEAL",
    rating: 4.6,
    reviewsCount: 740,
    reviews: "740",
    description:
      "Cook with up to 90% less fat using 360° rapid air circulation. Features a 5.5-liter family capacity basket, 8 touch presets, and dishwasher-safe parts.",
    category: "Appliances",
    subCategory: "Air Fryers",
    image: "/products/airfryer.png",
    images: [
      {
        color: "black",
        label: "Piano Black",
        main: "/products/airfryer.png",
        thumbnails: [
          "/products/airfryer.png",
          "/products/blender-removebg-preview.png",
          "/products/pot-removebg-preview.png",
        ],
      },
    ],
    sizes: ["5.5L"],
    tags: ["Appliance", "Home", "Cooking", "Kitchen"],
  },
  {
    id: "blender",
    brand: "Ninja",
    sku: "NJ-BLD-1200",
    title: "Pro Series 1200W High Speed Blender",
    price: "₦45,000",
    originalPrice: "₦65,000",
    priceNum: 45000,
    badge: "SALE",
    rating: 4.4,
    reviewsCount: 380,
    reviews: "380",
    description:
      "1200-watt commercial grade motor with 6 Total Crushing stainless steel blades to pulverize ice, frozen fruit, and seeds into smooth purees.",
    category: "Appliances",
    subCategory: "Blenders",
    image: "/products/blender-removebg-preview.png",
    images: [
      {
        color: "silver",
        label: "Brushed Steel",
        main: "/products/blender-removebg-preview.png",
        thumbnails: [
          "/products/blender-removebg-preview.png",
          "/products/juicer-removebg-preview.png",
        ],
      },
    ],
    sizes: ["1.5L", "2.0L"],
    tags: ["Appliance", "Home", "Cooking", "Kitchen"],
  },
  {
    id: "microwave",
    brand: "LG",
    sku: "LG-MW-25L-INV",
    title: "LG NeoChef Inverter Microwave Oven",
    price: "₦72,000",
    originalPrice: "₦95,000",
    priceNum: 72000,
    badge: "DEAL",
    rating: 4.5,
    reviewsCount: 510,
    reviews: "510",
    description:
      "Smart Inverter technology ensures precise temperature control for uniform heating and defrosting, featuring an EasyClean anti-bacterial interior coating.",
    category: "Appliances",
    subCategory: "Microwaves",
    image: "/products/microwave-removebg-preview.png",
    images: [
      {
        color: "black",
        label: "Black Stainless",
        main: "/products/microwave-removebg-preview.png",
        thumbnails: [
          "/products/microwave-removebg-preview.png",
          "/products/airfryer.png",
        ],
      },
    ],
    sizes: ["25L"],
    tags: ["Appliance", "Home", "Kitchen"],
  },
  {
    id: "standing-fan",
    brand: "OX",
    sku: "OX-FAN-18-HD",
    title: "OX Heavy Duty 18\" Standing Pedestal Fan",
    price: "₦35,000",
    originalPrice: "₦48,000",
    priceNum: 35000,
    badge: "NEW",
    rating: 4.4,
    reviewsCount: 290,
    reviews: "290",
    description:
      "5-blade high-velocity aluminum fan with 3-speed heavy-duty copper motor, smooth 90° oscillation, and height-adjustable heavy pedestal base.",
    category: "Appliances",
    subCategory: "Fans",
    image: "/products/standing_fan-removebg-preview.png",
    images: [
      {
        color: "black",
        label: "Industrial Black",
        main: "/products/standing_fan-removebg-preview.png",
        thumbnails: ["/products/standing_fan-removebg-preview.png"],
      },
    ],
    sizes: ["18 inch"],
    tags: ["Appliance", "Home", "Cooling"],
  },
  {
    id: "juicer",
    brand: "Hurom",
    sku: "HRM-JCR-1200",
    title: "Hurom Slow Masticating Cold Press Juicer",
    price: "₦55,000",
    originalPrice: "₦72,000",
    priceNum: 55000,
    badge: "POPULAR",
    rating: 4.6,
    reviewsCount: 410,
    reviews: "410",
    description:
      "Slow 43RPM masticating technology preserves vitamins, enzymes, and natural flavors. Self-feeding hopper handles whole apples and leafy greens effortlessly.",
    category: "Appliances",
    subCategory: "Juicers",
    image: "/products/juicer-removebg-preview.png",
    images: [
      {
        color: "silver",
        label: "Brushed Aluminum",
        main: "/products/juicer-removebg-preview.png",
        thumbnails: [
          "/products/juicer-removebg-preview.png",
          "/products/blender-removebg-preview.png",
        ],
      },
    ],
    sizes: ["1.2L"],
    tags: ["Appliance", "Home", "Kitchen", "Cooking"],
  },
  {
    id: "pot",
    brand: "MasterChef",
    sku: "MC-POT-SS-28",
    title: "Tri-Ply Heavy Duty Stainless Steel Stock Pot",
    price: "₦28,000",
    originalPrice: "₦38,000",
    priceNum: 28000,
    badge: "ESSENTIAL",
    rating: 4.8,
    reviewsCount: 620,
    reviews: "620",
    description:
      "Premium 18/10 stainless steel construction with encapsulated aluminum core for rapid, even heat distribution across gas, induction, and electric stovetops.",
    category: "Appliances",
    subCategory: "Electric Cookware",
    image: "/products/pot-removebg-preview.png",
    images: [
      {
        color: "silver",
        label: "Polished Steel",
        main: "/products/pot-removebg-preview.png",
        thumbnails: ["/products/pot-removebg-preview.png"],
      },
    ],
    sizes: ["24cm", "28cm"],
    tags: ["Kitchen", "Cookware", "Home"],
  },
  {
    id: "toaster",
    brand: "DeLonghi",
    sku: "DLG-TST-2S-SLV",
    title: "DeLonghi 2-Slice Retro Electric Toaster",
    price: "₦22,000",
    originalPrice: "₦30,000",
    priceNum: 22000,
    badge: "SALE",
    rating: 4.5,
    reviewsCount: 310,
    reviews: "310",
    description:
      "Extra-wide slots with self-centering bread guides, electronic browning control, high-lift lever, and removable crumb tray for effortless breakfast prep.",
    category: "Appliances",
    subCategory: "Toasters & Ovens",
    image: "/products/toasters-removebg-preview.png",
    images: [
      {
        color: "silver",
        label: "Chrome Silver",
        main: "/products/toasters-removebg-preview.png",
        thumbnails: ["/products/toasters-removebg-preview.png"],
      },
    ],
    sizes: ["2-Slice"],
    tags: ["Kitchen", "Appliance", "Home"],
  },
  {
    id: "four-fridge",
    brand: "Haier",
    sku: "HT-4D-FRG-2026",
    title: "Haier Thermocool 4-Door Luxury Refrigerator",
    price: "₦1,850,000",
    originalPrice: "₦2,100,000",
    priceNum: 1850000,
    badge: "LUXURY",
    rating: 4.9,
    reviewsCount: 780,
    reviews: "780",
    description:
      "Multi-airflow 360 cooling system, MyZone convertible compartment, T-ABT anti-bacterial technology, and digital touch temperature control.",
    category: "Appliances",
    subCategory: "Fridges",
    image: "/products/four_fridge.png",
    images: [
      {
        color: "grey",
        label: "Inox Grey",
        main: "/products/four_fridge.png",
        thumbnails: [
          "/products/four_fridge.png",
          "/products/hero/samsung_fridge_black.png",
        ],
      },
    ],
    sizes: ["28 cu. ft."],
    tags: ["Appliance", "Home", "Kitchen", "Luxury"],
  },
];

/** Helper function to get product by ID/slug with fuzzy fallback */
export function getProductById(id: string): ProductItem | undefined {
  if (!id) return REAL_PRODUCTS[0];
  const decoded = decodeURIComponent(id).toLowerCase();

  // 1. Direct ID match
  const exact = REAL_PRODUCTS.find((p) => p.id.toLowerCase() === decoded);
  if (exact) return exact;

  // 2. Partial ID or slug match
  const partial = REAL_PRODUCTS.find(
    (p) =>
      p.id.toLowerCase().includes(decoded) ||
      decoded.includes(p.id.toLowerCase()) ||
      p.title.toLowerCase().includes(decoded) ||
      decoded.replace(/-/g, " ").includes(p.title.toLowerCase())
  );
  if (partial) return partial;

  // 3. Known fallback map
  const fallbackMap: Record<string, string> = {
    "1": "air-jordan-1",
    "2": "denim-jacket",
    "3": "oxford-shirt",
    "4": "hoodie",
    "5": "linen-coat",
    "6": "pixel-10-pro",
    "7": "ps5-spiderman",
    "8": "airfryer-pro",
    "na-1": "denim-jacket",
    "na-2": "oxford-shirt",
    "na-3": "hoodie",
    "na-4": "linen-coat",
    "aj-blue": "air-jordan-1",
    "aj-brown": "air-jordan-1",
  };

  const targetId = fallbackMap[decoded];
  if (targetId) {
    return REAL_PRODUCTS.find((p) => p.id === targetId);
  }

  return REAL_PRODUCTS[0];
}
