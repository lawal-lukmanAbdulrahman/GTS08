import * as XLSX from "xlsx";
import { ProductItem } from "./page";

export interface ExcelImportRow {
  name: string;
  category: string;
  sub_category?: string;
  brand?: string;
  base_price: number; // in Naira
  compare_at_price?: number; // in Naira
  cost_price?: number; // in Naira
  sku?: string;
  status: "active" | "draft" | "archived";
  stock_quantity?: number;
  primary_image_url?: string;
  tags?: string;
  short_description?: string;
  description?: string;
  has_transparent_bg?: boolean;
}

export interface ParsedImportResult {
  validRows: ExcelImportRow[];
  invalidRows: { rowNumber: number; raw: any; reason: string }[];
  totalRows: number;
}

/**
 * Exports products list to an Excel (.xlsx) file with professional formatting and column widths.
 */
export function exportProductsToExcel(
  products: ProductItem[],
  fileName: string = `gts-products-export-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const rows = products.map((p, idx) => {
    const baseNaira = p.base_price > 100000 ? p.base_price / 100 : p.base_price;
    const compareNaira = p.compare_at_price
      ? p.compare_at_price > 100000
        ? p.compare_at_price / 100
        : p.compare_at_price
      : "";
    const costNaira = p.cost_price
      ? p.cost_price > 100000
        ? p.cost_price / 100
        : p.cost_price
      : "";

    // Compute variants breakdown summary (e.g., "M / Black: 15 | L / White: 20")
    const variantsSummary =
      p.variants && p.variants.length > 0
        ? p.variants
            .map((v) => `${v.size || "STD"} / ${v.color || "DEF"}: ${v.available ?? v.quantity ?? 0}`)
            .join(" | ")
        : "";

    const totalStock =
      p.total_quantity !== undefined
        ? p.total_quantity
        : p.variants && p.variants.length > 0
        ? p.variants.reduce((acc, v) => acc + (v.available ?? v.quantity ?? 0), 0)
        : p.in_stock
        ? 100
        : 0;

    return {
      "No.": idx + 1,
      "Product ID": p.id,
      "Product Name": p.name,
      "Slug": p.slug,
      "SKU": p.sku || "",
      "Brand": p.brand || "GTS",
      "Category": p.category?.name || "General",
      "Base Price (NGN)": baseNaira,
      "Compare At Price (NGN)": compareNaira,
      "Cost Price (NGN)": costNaira,
      "Profit Margin (%)": p.margin_pct !== null && p.margin_pct !== undefined ? `${p.margin_pct}%` : "",
      "Status": p.status,
      "Stock Status": !p.in_stock ? "Out of Stock" : p.has_low_stock ? "Low Stock" : "In Stock",
      "Total Quantity": totalStock,
      "Variants Breakdown": variantsSummary,
      "Primary Image URL": p.primary_image?.cloudinary_id || "",
      "Tags": Array.isArray(p.tags) ? p.tags.join(", ") : "",
      "Short Description": p.short_description || "",
      "Full Description": p.description || "",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set intelligent column widths for great readability
  const colWidths = [
    { wch: 6 },  // No.
    { wch: 22 }, // Product ID
    { wch: 34 }, // Product Name
    { wch: 26 }, // Slug
    { wch: 18 }, // SKU
    { wch: 16 }, // Brand
    { wch: 18 }, // Category
    { wch: 18 }, // Base Price
    { wch: 22 }, // Compare Price
    { wch: 18 }, // Cost Price
    { wch: 16 }, // Margin
    { wch: 12 }, // Status
    { wch: 16 }, // Stock Status
    { wch: 16 }, // Total Quantity
    { wch: 36 }, // Variants Breakdown
    { wch: 45 }, // Image URL
    { wch: 24 }, // Tags
    { wch: 35 }, // Short Description
    { wch: 50 }, // Full Description
  ];
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "GTS Products");

  XLSX.writeFile(workbook, fileName);
}

/**
 * Downloads a sample formatted Excel template for importing products into GTS.
 */
export function downloadSampleExcelTemplate() {
  const sampleRows = [
    {
      "Product Name": "GTS Premium Oversized Tee",
      "Category": "Apparel",
      "Sub Category": "T-Shirts",
      "Brand": "GTS",
      "Base Price (NGN)": 18500,
      "Compare At Price (NGN)": 24000,
      "Cost Price (NGN)": 9000,
      "SKU": "GTS-TSHIRT-001",
      "Status": "active",
      "Stock Quantity": 85,
      "Primary Image URL": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
      "Tags": "Oversized, Cotton, Streetwear",
      "Short Description": "Heavyweight premium cotton oversized t-shirt for modern streetwear.",
      "Full Description": "# Product Overview\n\nCrafted from 100% 240gsm combed cotton.",
    },
    {
      "Product Name": "Artisan Almond Butter Crunch Snack",
      "Category": "Snacks",
      "Sub Category": "Nuts & Bars",
      "Brand": "GTS Gourmet",
      "Base Price (NGN)": 4500,
      "Compare At Price (NGN)": 5000,
      "Cost Price (NGN)": 2200,
      "SKU": "GTS-SNACK-ALMOND",
      "Status": "active",
      "Stock Quantity": 120,
      "Primary Image URL": "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=800&q=80",
      "Tags": "Organic, Vegan, Snack, Healthy",
      "Short Description": "Delicious stone-ground almond butter crunch with organic sea salt.",
      "Full Description": "Pure natural ingredients with zero artificial preservatives.",
    },
    {
      "Product Name": "Minimalist Ceramic Desk Planter",
      "Category": "Home & Living",
      "Sub Category": "Decor",
      "Brand": "GTS Studio",
      "Base Price (NGN)": 12000,
      "Compare At Price (NGN)": 15000,
      "Cost Price (NGN)": 6000,
      "SKU": "GTS-HOME-PLANTER",
      "Status": "draft",
      "Stock Quantity": 40,
      "Primary Image URL": "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
      "Tags": "Ceramic, Planter, Minimalist",
      "Short Description": "Matte finish ceramic planter for indoor succulents and herbs.",
      "Full Description": "Hand-glazed matte ceramic with drainage tray included.",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);

  worksheet["!cols"] = [
    { wch: 34 }, // Name
    { wch: 18 }, // Category
    { wch: 18 }, // Sub Category
    { wch: 16 }, // Brand
    { wch: 18 }, // Base Price
    { wch: 22 }, // Compare Price
    { wch: 18 }, // Cost Price
    { wch: 18 }, // SKU
    { wch: 12 }, // Status
    { wch: 16 }, // Stock Quantity
    { wch: 45 }, // Image URL
    { wch: 24 }, // Tags
    { wch: 35 }, // Short Description
    { wch: 40 }, // Full Description
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Import Template");

  XLSX.writeFile(workbook, "gts-products-import-template.xlsx");
}

/**
 * Parses an Excel (.xlsx / .xls / .csv) file and extracts valid Product rows for import.
 */
export async function parseProductsFromExcel(file: File): Promise<ParsedImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The uploaded Excel workbook contains no sheets.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error("Unable to read worksheet data.");
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  const validRows: ExcelImportRow[] = [];
  const invalidRows: { rowNumber: number; raw: any; reason: string }[] = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // +1 for 0-index, +1 for header row

    // Helper to find column case-insensitively
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
          return String(row[k]).trim();
        }
      }
      // Check case-insensitive match
      for (const objKey of Object.keys(row)) {
        const cleanObjKey = objKey.toLowerCase().replace(/[^a-z0-9]/g, "");
        for (const k of keys) {
          const cleanTarget = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (cleanObjKey === cleanTarget) {
            return String(row[objKey]).trim();
          }
        }
      }
      return "";
    };

    const name = getVal("Product Name", "Name", "Title", "product_name");
    const category = getVal("Category", "Category Name", "category", "category_name");
    const subCategory = getVal("Sub Category", "SubCategory", "sub_category", "Sub-Category");
    const brand = getVal("Brand", "brand") || "GTS";
    const rawPrice = getVal("Base Price (NGN)", "Base Price", "Price", "base_price", "Selling Price", "Price (NGN)");
    const rawCompare = getVal("Compare At Price (NGN)", "Compare At Price", "compare_at_price", "Original Price");
    const rawCost = getVal("Cost Price (NGN)", "Cost Price", "cost_price");
    const sku = getVal("SKU", "sku", "Product SKU");
    const rawStatus = getVal("Status", "status").toLowerCase();
    const rawQty = getVal("Stock Quantity", "Quantity", "Total Quantity", "quantity", "stock_quantity");
    const imageUrl = getVal("Primary Image URL", "Image URL", "image_url", "Image", "primary_image_url");
    const tags = getVal("Tags", "tags");
    const shortDescription = getVal("Short Description", "short_description", "Highlight");
    const description = getVal("Full Description", "Description", "description");

    const errors: string[] = [];

    if (!name) {
      errors.push("Missing Product Name");
    }

    if (!category) {
      errors.push("Missing Category");
    }

    const cleanPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
    if (isNaN(cleanPrice) || cleanPrice <= 0) {
      errors.push("Invalid or missing Base Price (must be greater than 0)");
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: rowNum,
        raw: row,
        reason: errors.join("; "),
      });
      return;
    }

    const cleanCompare = rawCompare ? parseFloat(rawCompare.replace(/[^0-9.]/g, "")) : undefined;
    const cleanCost = rawCost ? parseFloat(rawCost.replace(/[^0-9.]/g, "")) : undefined;
    const cleanQty = rawQty ? Math.max(0, parseInt(rawQty.replace(/[^0-9]/g, ""), 10) || 100) : 100;

    const status: "active" | "draft" | "archived" = ["active", "draft", "archived"].includes(rawStatus)
      ? (rawStatus as any)
      : "active";

    validRows.push({
      name,
      category,
      sub_category: subCategory || undefined,
      brand,
      base_price: cleanPrice,
      compare_at_price: cleanCompare && !isNaN(cleanCompare) ? cleanCompare : undefined,
      cost_price: cleanCost && !isNaN(cleanCost) ? cleanCost : undefined,
      sku: sku || undefined,
      status,
      stock_quantity: cleanQty,
      primary_image_url: imageUrl || undefined,
      tags: tags || undefined,
      short_description: shortDescription || undefined,
      description: description || undefined,
      has_transparent_bg: true,
    });
  });

  return {
    validRows,
    invalidRows,
    totalRows: rawRows.length,
  };
}
