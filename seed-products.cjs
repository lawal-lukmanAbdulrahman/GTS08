const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      if (key && !key.startsWith("#")) {
        process.env[key] = val;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates",
};

const CATEGORIES_TREE = [
  {
    name: "Fashion",
    slug: "fashion",
    subs: ["Sneakers & Boots", "Men's Clothing", "Outerwear"],
  },
  {
    name: "Phones & Tablets",
    slug: "phones-tablets",
    subs: ["Smartphones"],
  },
  {
    name: "Electronics",
    slug: "electronics",
    subs: ["Smart TVs"],
  },
  {
    name: "Gaming",
    slug: "gaming",
    subs: ["PlayStation 5"],
  },
  {
    name: "Appliances",
    slug: "appliances",
    subs: [
      "Washing Machines",
      "Fridges",
      "Air Fryers",
      "Blenders",
      "Microwaves",
      "Fans",
      "Juicers",
      "Electric Cookware",
      "Toasters & Ovens",
    ],
  },
];

const REAL_PRODUCTS = [
  {
    id: "air-jordan-1",
    brand: "Air Jordan",
    sku: "AJ1-OG-2026",
    title: "Air Jordan 1 Retro High OG",
    priceNum: 450000,
    origPriceNum: 520000,
    rating: 4.9,
    reviewsCount: 3200,
    description:
      "Crafted with premium full-grain leather, classic Air cushioning, and timeless heritage design. The Air Jordan 1 Retro High OG combines legendary street culture with unmatched modern comfort.",
    category: "Fashion",
    subCategory: "Sneakers & Boots",
    image: "/products/hero/air_jordan_retro_1_blue.png",
    colors: [
      { color: "Blue", label: "University Blue", hex: "#1E40AF" },
      { color: "Brown", label: "Mocha Brown", hex: "#78350F" },
      { color: "Green", label: "Pine Green", hex: "#065F46" },
    ],
    sizes: ["40.5", "41", "42", "43", "44", "45"],
    tags: ["Sneakers", "Men", "Limited", "Footwear", "Premium"],
  },
  {
    id: "denim-jacket",
    brand: "GTS",
    sku: "GTS-DNM-JKT-01",
    title: "Urban Vintage Denim Jacket",
    priceNum: 32400,
    origPriceNum: 64800,
    rating: 4.6,
    reviewsCount: 892,
    description:
      "Heavyweight 14oz cotton denim jacket featuring a classic vintage wash, button front closure, adjustable waist tabs, and dual chest flap pockets.",
    category: "Fashion",
    subCategory: "Men's Clothing",
    image: "/products/denim_jacket.png",
    colors: [{ color: "Blue", label: "Vintage Wash Blue", hex: "#2563EB" }],
    sizes: ["S", "M", "L", "XL"],
    tags: ["Men", "Jacket", "Casual", "Fashion", "Streetwear"],
  },
  {
    id: "oxford-shirt",
    brand: "GTS",
    sku: "GTS-OXF-SHT-02",
    title: "Classic Cotton Oxford Shirt",
    priceNum: 32400,
    origPriceNum: 48000,
    rating: 4.5,
    reviewsCount: 560,
    description:
      "Tailored 100% long-staple cotton Oxford shirt featuring a button-down collar, chest patch pocket, and breathable basketweave fabric.",
    category: "Fashion",
    subCategory: "Men's Clothing",
    image: "/products/oxford_shirt.png",
    colors: [{ color: "Blue", label: "Light Blue", hex: "#60A5FA" }],
    sizes: ["S", "M", "L", "XL"],
    tags: ["Men", "Formal", "Shirt", "Fashion"],
  },
  {
    id: "hoodie",
    brand: "GTS",
    sku: "GTS-STR-HDD-03",
    title: "Heavyweight Oversized Streetwear Hoodie",
    priceNum: 32400,
    origPriceNum: 64800,
    rating: 4.7,
    reviewsCount: 1100,
    description:
      "Ultra-soft 450GSM cotton fleece hoodie built with a drop-shoulder cut, double-lined hood, seamless kangaroo pocket, and heavy ribbed hems.",
    category: "Fashion",
    subCategory: "Men's Clothing",
    image: "/products/hoodie.png",
    colors: [{ color: "Black", label: "Jet Black", hex: "#111827" }],
    sizes: ["S", "M", "L", "XL"],
    tags: ["Men", "Casual", "Streetwear", "Fashion"],
  },
  {
    id: "linen-coat",
    brand: "GTS",
    sku: "GTS-LX-LNN-04",
    title: "Tailored Lightweight Linen Coat",
    priceNum: 32400,
    origPriceNum: 64800,
    rating: 4.9,
    reviewsCount: 1500,
    description:
      "Exquisite European linen overcoat tailored with notch lapels, unlined interior for summer ventilation, and deep welt pockets.",
    category: "Fashion",
    subCategory: "Outerwear",
    image: "/products/linen_coat.png",
    colors: [{ color: "Beige", label: "Natural Beige", hex: "#D97706" }],
    sizes: ["M", "L", "XL"],
    tags: ["Men", "Formal", "Premium", "Fashion"],
  },
  {
    id: "pixel-10",
    brand: "Google",
    sku: "G-PX10-PRO",
    title: "Google Pixel 10 Pro 5G",
    priceNum: 1250000,
    origPriceNum: 1400000,
    rating: 4.8,
    reviewsCount: 2300,
    description:
      "Next-generation AI computational photography, pro-level triple camera system with 5× telephoto zoom, and ultra-smooth OLED display powered by the Tensor G5 chip.",
    category: "Phones & Tablets",
    subCategory: "Smartphones",
    image: "/products/hero/pixel_10_metal.png",
    colors: [
      { color: "Metal", label: "Titanium Metal", hex: "#94A3B8" },
      { color: "Green", label: "Hazel Green", hex: "#059669" },
      { color: "Purple", label: "Obsidian Purple", hex: "#7C3AED" },
      { color: "Red", label: "Coral Red", hex: "#DC2626" },
    ],
    sizes: ["128GB", "256GB", "512GB", "1TB"],
    tags: ["Smartphone", "Tech", "Android", "5G", "Hot"],
  },
  {
    id: "tv",
    brand: "Sony",
    sku: "SN-TV-55-4K",
    title: "Sony BRAVIA 55\" 4K HDR Smart Google TV",
    priceNum: 380000,
    origPriceNum: 450000,
    rating: 4.7,
    reviewsCount: 1900,
    description:
      "Stunning 4K Processor X1 with TRILUMINOS PRO colors, Google TV smart interface with voice search, and Dolby Vision/Atmos immersive audio.",
    category: "Electronics",
    subCategory: "Smart TVs",
    image: "/products/tv-removebg-preview.png",
    colors: [{ color: "Black", label: "Matte Black", hex: "#000000" }],
    sizes: ["55 inch"],
    tags: ["Tech", "Home", "Entertainment", "Electronics"],
  },
  {
    id: "spiderman-ps5",
    brand: "PlayStation",
    sku: "PS5-SM2-BNDL",
    title: "PlayStation 5 Console Spider-Man 2 Bundle",
    priceNum: 180000,
    origPriceNum: 220000,
    rating: 4.9,
    reviewsCount: 4100,
    description:
      "Experience lightning-fast loading with an ultra-high speed SSD, deeper immersion with haptic feedback, and a custom Symbiote takeover console design.",
    category: "Gaming",
    subCategory: "PlayStation 5",
    image: "/products/spiderman_ps5.png",
    colors: [{ color: "Red/Black", label: "Symbiote Red/Black", hex: "#991B1B" }],
    sizes: ["Disc Edition"],
    tags: ["Gaming", "Tech", "Limited", "Console"],
  },
  {
    id: "nexus-washing-machine",
    brand: "Nexus",
    sku: "NX-WM-TT-2026",
    title: "Nexus Twin Tub Washing Machine",
    priceNum: 185000,
    origPriceNum: 220000,
    rating: 4.7,
    reviewsCount: 840,
    description:
      "Heavy-duty twin tub washer with rust-free plastic body, powerful pulsator washing technology, and high-speed spin dry cycle for efficient laundry care.",
    category: "Appliances",
    subCategory: "Washing Machines",
    image: "/products/hero/nexus_washing_machine_blue.png",
    colors: [
      { color: "Blue", label: "Royal Blue", hex: "#1D4ED8" },
      { color: "Grey", label: "Metallic Grey", hex: "#6B7280" },
      { color: "White", label: "Classic White", hex: "#F9FAFB" },
      { color: "Green", label: "Mint Green", hex: "#10B981" },
    ],
    sizes: ["7.5kg", "9kg", "12kg"],
    tags: ["Appliance", "Home", "Laundry", "New"],
  },
  {
    id: "samsung-fridge",
    brand: "Samsung",
    sku: "SS-BS-4D-2026",
    title: "Samsung Bespoke 4-Door French Door Refrigerator",
    priceNum: 2450000,
    origPriceNum: 2800000,
    rating: 5.0,
    reviewsCount: 1900,
    description:
      "Customizable color door panels, Beverage Center with AutoFill Pitcher, and Dual Auto Ice Maker for ultimate modern kitchen luxury and smart cooling.",
    category: "Appliances",
    subCategory: "Fridges",
    image: "/products/hero/samsung_fridge_black.png",
    colors: [
      { color: "Black", label: "Matte Black", hex: "#111827" },
      { color: "Bronze", label: "Tuscan Bronze", hex: "#92400E" },
      { color: "Grey", label: "Stainless Grey", hex: "#64748B" },
      { color: "White", label: "Custom White", hex: "#FFFFFF" },
    ],
    sizes: ["24 cu. ft.", "29 cu. ft."],
    tags: ["Appliance", "Home", "Kitchen", "Luxury"],
  },
  {
    id: "airfryer",
    brand: "Philips",
    sku: "PHP-AF-55L-01",
    title: "Digital Air Fryer 5.5L Rapid Air",
    priceNum: 85000,
    origPriceNum: 110000,
    rating: 4.6,
    reviewsCount: 740,
    description:
      "Cook with up to 90% less fat using 360° rapid air circulation. Features a 5.5-liter family capacity basket, 8 touch presets, and dishwasher-safe parts.",
    category: "Appliances",
    subCategory: "Air Fryers",
    image: "/products/airfryer.png",
    colors: [{ color: "Black", label: "Piano Black", hex: "#000000" }],
    sizes: ["5.5L"],
    tags: ["Appliance", "Home", "Cooking", "Kitchen"],
  },
  {
    id: "blender",
    brand: "Ninja",
    sku: "NJ-BLD-1200",
    title: "Pro Series 1200W High Speed Blender",
    priceNum: 45000,
    origPriceNum: 65000,
    rating: 4.4,
    reviewsCount: 380,
    description:
      "1200-watt commercial grade motor with 6 Total Crushing stainless steel blades to pulverize ice, frozen fruit, and seeds into smooth purees.",
    category: "Appliances",
    subCategory: "Blenders",
    image: "/products/blender-removebg-preview.png",
    colors: [{ color: "Silver", label: "Brushed Steel", hex: "#9CA3AF" }],
    sizes: ["1.5L", "2.0L"],
    tags: ["Appliance", "Home", "Cooking", "Kitchen"],
  },
  {
    id: "microwave",
    brand: "LG",
    sku: "LG-MW-25L-INV",
    title: "LG NeoChef Inverter Microwave Oven",
    priceNum: 72000,
    origPriceNum: 95000,
    rating: 4.5,
    reviewsCount: 510,
    description:
      "Smart Inverter technology ensures precise temperature control for uniform heating and defrosting, featuring an EasyClean anti-bacterial interior coating.",
    category: "Appliances",
    subCategory: "Microwaves",
    image: "/products/microwave-removebg-preview.png",
    colors: [{ color: "Black", label: "Black Stainless", hex: "#1F2937" }],
    sizes: ["25L"],
    tags: ["Appliance", "Home", "Kitchen"],
  },
  {
    id: "standing-fan",
    brand: "OX",
    sku: "OX-FAN-18-HD",
    title: "OX Heavy Duty 18\" Standing Pedestal Fan",
    priceNum: 35000,
    origPriceNum: 48000,
    rating: 4.4,
    reviewsCount: 290,
    description:
      "5-blade high-velocity aluminum fan with 3-speed heavy-duty copper motor, smooth 90° oscillation, and height-adjustable heavy pedestal base.",
    category: "Appliances",
    subCategory: "Fans",
    image: "/products/standing_fan-removebg-preview.png",
    colors: [{ color: "Black", label: "Industrial Black", hex: "#111827" }],
    sizes: ["18 inch"],
    tags: ["Appliance", "Home", "Cooling"],
  },
  {
    id: "juicer",
    brand: "Hurom",
    sku: "HRM-JCR-1200",
    title: "Hurom Slow Masticating Cold Press Juicer",
    priceNum: 55000,
    origPriceNum: 72000,
    rating: 4.6,
    reviewsCount: 410,
    description:
      "Slow 43RPM masticating technology preserves vitamins, enzymes, and natural flavors. Self-feeding hopper handles whole apples and leafy greens effortlessly.",
    category: "Appliances",
    subCategory: "Juicers",
    image: "/products/juicer-removebg-preview.png",
    colors: [{ color: "Silver", label: "Brushed Aluminum", hex: "#D1D5DB" }],
    sizes: ["1.2L"],
    tags: ["Appliance", "Home", "Kitchen", "Cooking"],
  },
  {
    id: "pot",
    brand: "MasterChef",
    sku: "MC-POT-SS-28",
    title: "Tri-Ply Heavy Duty Stainless Steel Stock Pot",
    priceNum: 28000,
    origPriceNum: 38000,
    rating: 4.8,
    reviewsCount: 620,
    description:
      "Premium 18/10 stainless steel construction with encapsulated aluminum core for rapid, even heat distribution across gas, induction, and electric stovetops.",
    category: "Appliances",
    subCategory: "Electric Cookware",
    image: "/products/pot-removebg-preview.png",
    colors: [{ color: "Silver", label: "Polished Steel", hex: "#E5E7EB" }],
    sizes: ["24cm", "28cm"],
    tags: ["Kitchen", "Cookware", "Home"],
  },
  {
    id: "toaster",
    brand: "DeLonghi",
    sku: "DLG-TST-2S-SLV",
    title: "DeLonghi 2-Slice Retro Electric Toaster",
    priceNum: 22000,
    origPriceNum: 30000,
    rating: 4.5,
    reviewsCount: 310,
    description:
      "Extra-wide slots with self-centering bread guides, electronic browning control, high-lift lever, and removable crumb tray for effortless breakfast prep.",
    category: "Appliances",
    subCategory: "Toasters & Ovens",
    image: "/products/toasters-removebg-preview.png",
    colors: [{ color: "Silver", label: "Chrome Silver", hex: "#F3F4F6" }],
    sizes: ["2-Slice"],
    tags: ["Kitchen", "Appliance", "Home"],
  },
  {
    id: "four-fridge",
    brand: "Haier",
    sku: "HT-4D-FRG-2026",
    title: "Haier Thermocool 4-Door Luxury Refrigerator",
    priceNum: 1850000,
    origPriceNum: 2100000,
    rating: 4.9,
    reviewsCount: 780,
    description:
      "Multi-airflow 360 cooling system, MyZone convertible compartment, T-ABT anti-bacterial technology, and digital touch temperature control.",
    category: "Appliances",
    subCategory: "Fridges",
    image: "/products/four_fridge.png",
    colors: [{ color: "Grey", label: "Inox Grey", hex: "#4B5563" }],
    sizes: ["28 cu. ft."],
    tags: ["Appliance", "Home", "Kitchen", "Luxury"],
  },
];

async function seed() {
  console.log("🚀 Starting Upsert for ALL 18 GTS Storefront Products & Categories...");

  // 1. Upsert Categories & Sub-categories
  const categoryIdMap = {};

  for (const cat of CATEGORIES_TREE) {
    await fetch(`${supabaseUrl}/rest/v1/categories?on_conflict=slug`, {
      method: "POST",
      headers,
      body: JSON.stringify([
        {
          name: cat.name,
          slug: cat.slug,
          description: `${cat.name} collection at GTS Storefront`,
          is_active: true,
        },
      ]),
    });

    const fetchCatRes = await fetch(
      `${supabaseUrl}/rest/v1/categories?slug=eq.${cat.slug}&select=id`,
      { headers }
    );
    const catData = await fetchCatRes.json();
    const parentId = catData[0]?.id;
    if (parentId) {
      categoryIdMap[cat.name] = parentId;

      for (let i = 0; i < cat.subs.length; i++) {
        const subName = cat.subs[i];
        const subSlug = subName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        await fetch(`${supabaseUrl}/rest/v1/categories?on_conflict=slug`, {
          method: "POST",
          headers,
          body: JSON.stringify([
            {
              name: subName,
              slug: subSlug,
              description: `${subName} sub-category under ${cat.name}`,
              parent_id: parentId,
              is_active: true,
              sort_order: i + 1,
            },
          ]),
        });

        const fetchSubRes = await fetch(
          `${supabaseUrl}/rest/v1/categories?slug=eq.${subSlug}&select=id`,
          { headers }
        );
        const subData = await fetchSubRes.json();
        if (subData[0]?.id) {
          categoryIdMap[`${cat.name} > ${subName}`] = subData[0].id;
        }
      }
    }
  }

  console.log("✅ Categories & Sub-categories upserted!");

  // 2. Upsert Products with on_conflict=slug
  let seededCount = 0;
  for (const p of REAL_PRODUCTS) {
    const categoryId =
      categoryIdMap[`${p.category} > ${p.subCategory}`] ||
      categoryIdMap[p.category] ||
      null;

    const basePriceKobo = p.priceNum * 100;
    const compareAtKobo = p.origPriceNum ? p.origPriceNum * 100 : null;
    const costPriceKobo = Math.round(p.priceNum * 0.42) * 100;

    const prodPayload = {
      name: p.title,
      slug: p.id,
      sku: p.sku,
      short_description: p.description.slice(0, 200),
      description: p.description,
      material: p.tags.includes("Men") ? "Premium Cotton / Blend" : "Standard Build",
      category_id: categoryId,
      base_price: basePriceKobo,
      compare_at_price: compareAtKobo,
      cost_price: costPriceKobo,
      status: "active",
      is_featured: ["air-jordan-1", "pixel-10", "samsung-fridge", "spiderman-ps5"].includes(p.id),
      tags: p.tags,
      total_sold: Math.floor(Math.random() * 85) + 15,
      average_rating: p.rating,
      review_count: p.reviewsCount,
    };

    const prodPostRes = await fetch(`${supabaseUrl}/rest/v1/products?on_conflict=slug`, {
      method: "POST",
      headers,
      body: JSON.stringify([prodPayload]),
    });

    if (!prodPostRes.ok) {
      console.error(`⚠️ Failed to upsert product ${p.title}:`, await prodPostRes.text());
    }

    const fetchProd = await fetch(
      `${supabaseUrl}/rest/v1/products?slug=eq.${p.id}&select=id`,
      { headers }
    );
    const prodRows = await fetchProd.json();
    const productId = prodRows[0]?.id;

    if (!productId) {
      console.error(`❌ Could not get ID for ${p.title}`);
      continue;
    }

    // Primary Image
    await fetch(`${supabaseUrl}/rest/v1/product_images`, {
      method: "POST",
      headers,
      body: JSON.stringify([
        {
          product_id: productId,
          cloudinary_public_id: p.image,
          alt_text: p.title,
          is_primary: true,
          sort_order: 0,
        },
      ]),
    });

    // Variants & Inventory
    const varRowsToInsert = [];
    for (const colorObj of p.colors) {
      for (const size of p.sizes) {
        const variantSku = `${p.sku}-${colorObj.color.slice(0, 3).toUpperCase()}-${size.replace(/[^a-zA-Z0-9]/g, "")}`;
        varRowsToInsert.push({
          product_id: productId,
          size,
          color: colorObj.label,
          color_hex: colorObj.hex,
          sku: variantSku,
          price_modifier: 0,
          is_active: true,
        });
      }
    }

    const varRes = await fetch(`${supabaseUrl}/rest/v1/product_variants?on_conflict=sku`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(varRowsToInsert),
    });

    const insertedVariants = await varRes.json();
    if (Array.isArray(insertedVariants) && insertedVariants.length > 0) {
      const invRowsToInsert = insertedVariants.map((vRow, idx) => {
        const isLowStock = idx % 4 === 0;
        const quantity = isLowStock ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 35) + 12;
        return {
          variant_id: vRow.id,
          quantity,
          reserved_quantity: 0,
          low_stock_threshold: 5,
        };
      });

      await fetch(`${supabaseUrl}/rest/v1/inventory?on_conflict=variant_id`, {
        method: "POST",
        headers,
        body: JSON.stringify(invRowsToInsert),
      });
    }

    seededCount++;
    console.log(`[${seededCount}/18] Seeded ${p.title}`);
  }

  console.log(`🎉 ALL ${seededCount} STOREFRONT PRODUCTS & VARIANTS BULK SEEDED SUCCESSFULLY!`);
}

seed().catch((err) => {
  console.error("Bulk seeding failed:", err);
  process.exit(1);
});
