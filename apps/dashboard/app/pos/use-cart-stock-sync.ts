"use client";

import { useEffect } from "react";
import { reconcileCartStock } from "./cart-stock";
import type { CartLine, PosProduct } from "./pos-types";

/** Keeps the open sale in step with the refreshed stock on the grid, telling the cashier about any change. */
export function useCartStockSync(
  cart: CartLine[],
  setCart: (lines: CartLine[]) => void,
  products: PosProduct[],
  notify: (message: string) => void
): void {
  useEffect(() => {
    const { lines, notices } = reconcileCartStock(cart, products);
    if (lines === cart) return;
    setCart(lines);
    if (notices.length > 0) notify(notices.join(" "));
    // Only fresh stock should trigger this; the cart is read as it stands when that arrives.
  }, [products]);
}
