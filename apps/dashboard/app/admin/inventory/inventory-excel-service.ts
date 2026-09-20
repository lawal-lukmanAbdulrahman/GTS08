import * as XLSX from "xlsx";

export interface InventoryExportItem {
  id: string;
  variant_id: string;
  product_name: string;
  sku?: string;
  barcode?: string;
  category_name?: string;
  brand?: string;
  variant_size?: string;
  variant_color?: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  low_stock_threshold: number;
  unit_price: number;
  cost_price?: number;
  total_valuation?: number;
  last_restocked_at?: string;
  last_sold_at?: string;
}

/**
 * Exports inventory records to an Excel (.xlsx) file with professional formatting and auto column widths.
 */
export function exportInventoryToExcel(
  items: InventoryExportItem[],
  fileName: string = `gts-inventory-audit-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const rows = items.map((inv, idx) => {
    const unitPriceNaira = inv.unit_price > 100000 ? inv.unit_price / 100 : inv.unit_price;
    const costPriceNaira = inv.cost_price ? (inv.cost_price > 100000 ? inv.cost_price / 100 : inv.cost_price) : "";
    const valuationNaira =
      inv.total_valuation !== undefined
        ? inv.total_valuation
        : unitPriceNaira * inv.available_quantity;

    const stockStatus =
      inv.available_quantity === 0
        ? "OUT OF STOCK"
        : inv.available_quantity <= inv.low_stock_threshold
        ? "LOW STOCK"
        : "IN STOCK";

    const restockedDate = inv.last_restocked_at
      ? new Date(inv.last_restocked_at).toLocaleDateString("en-NG", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A";

    const soldDate = inv.last_sold_at
      ? new Date(inv.last_sold_at).toLocaleDateString("en-NG", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A";

    return {
      "S/N": idx + 1,
      "Product Name": inv.product_name,
      "SKU": inv.sku || "N/A",
      "Barcode": inv.barcode || "N/A",
      "Category": inv.category_name || "General",
      "Brand": inv.brand || "GTS",
      "Size": inv.variant_size || "Standard",
      "Color": inv.variant_color || "Default",
      "Physical Stock": inv.quantity,
      "Reserved": inv.reserved_quantity,
      "Available Stock": inv.available_quantity,
      "Low Stock Threshold": inv.low_stock_threshold,
      "Stock Status": stockStatus,
      "Unit Price (₦)": unitPriceNaira,
      "Cost Price (₦)": costPriceNaira,
      "Total Valuation (₦)": valuationNaira,
      "Last Restocked": restockedDate,
      "Last Sold": soldDate,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = [
    { wch: 6 },  // S/N
    { wch: 32 }, // Product Name
    { wch: 18 }, // SKU
    { wch: 16 }, // Barcode
    { wch: 16 }, // Category
    { wch: 14 }, // Brand
    { wch: 12 }, // Size
    { wch: 14 }, // Color
    { wch: 14 }, // Physical Stock
    { wch: 10 }, // Reserved
    { wch: 14 }, // Available Stock
    { wch: 18 }, // Low Stock Threshold
    { wch: 16 }, // Stock Status
    { wch: 16 }, // Unit Price (₦)
    { wch: 16 }, // Cost Price (₦)
    { wch: 20 }, // Total Valuation (₦)
    { wch: 16 }, // Last Restocked
    { wch: 16 }, // Last Sold
  ];
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Audit");
  XLSX.writeFile(workbook, fileName);
}
