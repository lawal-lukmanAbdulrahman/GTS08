import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCartStockSync } from "./use-cart-stock-sync";
import type { CartLine, PosProduct } from "./pos-types";

const line = (quantity: number, available: number): CartLine => ({ variantId: "v1", productId: "p", productName: "Shirt", size: null, color: null, unitPrice: 1, quantity, available });
const products = (available: number): PosProduct[] => [{ id: "p", name: "Shirt", slug: "s", base_price: 1, category: null, primary_image: null, stock_status: "in_stock", variants: [{ id: "v1", size: null, color: null, color_hex: null, sku: null, price_modifier: 0, quantity: available, available }] }];

describe("useCartStockSync", () => {
  it("lowers the cart and tells the cashier when fresh stock no longer covers it", () => {
    const setCart = vi.fn();
    const notify = vi.fn();
    const { rerender } = renderHook(({ p }) => useCartStockSync([line(3, 5)], setCart, p, notify), { initialProps: { p: products(5) } });
    expect(setCart).not.toHaveBeenCalled();
    rerender({ p: products(1) });
    expect(setCart).toHaveBeenCalledWith([expect.objectContaining({ quantity: 1, available: 1 })]);
    expect(notify).toHaveBeenCalledWith("Shirt: only 1 left, so the quantity was lowered to 1.");
  });

  it("stays quiet when nothing needs changing", () => {
    const setCart = vi.fn();
    const notify = vi.fn();
    renderHook(() => useCartStockSync([line(1, 5)], setCart, products(5), notify));
    expect(setCart).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
