// Navigation data for the storefront preview: brands shown in the menus. Not product data; products come from the database.
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
  { key: "La Roche-Posay", label: "La Roche-Posay", category: "Health & Beauty" },
  { key: "Dettol",        label: "Dettol",         category: "Health & Beauty" },
  { key: "Maison Francis", label: "Maison Francis", category: "Health & Beauty" },

  // Gaming
  { key: "PlayStation",   label: "PlayStation",    category: "Gaming" },
  { key: "Xbox",          label: "Xbox",           category: "Gaming" },
  { key: "Nintendo",      label: "Nintendo",       category: "Gaming" },
  { key: "Razer",         label: "Razer",          category: "Gaming" },

  // Home & Office
  { key: "IKEA",          label: "IKEA",           category: "Home & Office" },

  // Baby Products
  { key: "Chicco",        label: "Chicco",         category: "Baby Products" },
  { key: "Fisher-Price",  label: "Fisher-Price",   category: "Baby Products" },
  { key: "VTech",         label: "VTech",          category: "Baby Products" },
  { key: "Pampers",       label: "Pampers",        category: "Baby Products" },
];

/** Look up a brand entry by its key (case-insensitive). */
export function getBrandByKey(key: string): BrandEntry | undefined {
  return BRAND_REGISTRY.find((b) => b.key.toLowerCase() === key.toLowerCase());
}

/** All unique brand keys, sorted alphabetically. */
export const ALL_BRAND_KEYS: string[] = BRAND_REGISTRY.map((b) => b.key).sort();
