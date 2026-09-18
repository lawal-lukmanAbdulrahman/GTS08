export interface InventoryRow {
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold?: number;
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export function variantAvailable(inventory: Pick<InventoryRow, "quantity" | "reserved_quantity">): number {
  return Math.max(0, inventory.quantity - inventory.reserved_quantity);
}

/**
 * Product-card badge (gts_03_cashier_spec.md Part 3.3): "In Stock" / "Low
 * Stock" / "Out of Stock", derived across all of the product's variants.
 */
export function computeStockStatus(inventoryRows: InventoryRow[]): StockStatus {
  if (!inventoryRows || inventoryRows.length === 0) {
    return "out_of_stock";
  }

  const totalAvailable = inventoryRows.reduce((sum, row) => sum + variantAvailable(row), 0);
  if (totalAvailable <= 0) {
    return "out_of_stock";
  }

  const threshold = Math.max(...inventoryRows.map((row) => row.low_stock_threshold ?? 5));
  if (totalAvailable <= threshold) {
    return "low_stock";
  }

  return "in_stock";
}
