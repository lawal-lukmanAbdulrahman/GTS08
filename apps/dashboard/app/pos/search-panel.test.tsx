import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchPanel from "./search-panel";
import type { PosProduct } from "./pos-types";

const SINGLE_VARIANT_PRODUCT: PosProduct = {
  id: "p1",
  name: "Plain Tee",
  slug: "plain-tee",
  base_price: 800000,
  category: { id: "c1", name: "Tees", slug: "tees" },
  primary_image: null,
  stock_status: "in_stock",
  variants: [{ id: "v1", size: null, color: null, color_hex: null, sku: "T-1", price_modifier: 0, quantity: 5, available: 5 }],
};

const MULTI_VARIANT_PRODUCT: PosProduct = {
  id: "p2",
  name: "GTS Oxford Shirt",
  slug: "gts-oxford-shirt",
  base_price: 1500000,
  category: { id: "c1", name: "Tees", slug: "tees" },
  primary_image: null,
  stock_status: "low_stock",
  variants: [
    { id: "v2", size: "S", color: "Black", color_hex: "#000", sku: "S-BLK", price_modifier: 0, quantity: 2, available: 2 },
    { id: "v3", size: "M", color: "Black", color_hex: "#000", sku: "M-BLK", price_modifier: 0, quantity: 2, available: 2 },
  ],
};

const OUT_OF_STOCK_PRODUCT: PosProduct = {
  ...MULTI_VARIANT_PRODUCT,
  id: "p3",
  name: "Sold Out Jacket",
  stock_status: "out_of_stock",
  variants: [{ id: "v4", size: "M", color: "Black", color_hex: "#000", sku: "J-M", price_modifier: 0, quantity: 0, available: 0 }],
};

describe("SearchPanel (spec Part 3)", () => {
  it("shows a stock badge per product and dims an out-of-stock card", () => {
    render(
      <SearchPanel
        query=""
        onQueryChange={vi.fn()}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[{ id: "c1", name: "Tees", slug: "tees" }]}
        products={[SINGLE_VARIANT_PRODUCT, MULTI_VARIANT_PRODUCT, OUT_OF_STOCK_PRODUCT]}
        loading={false}
        onQuickAdd={vi.fn()}
        onOpenVariantModal={vi.fn()}
      />
    );
    expect(screen.getByText(/in stock/i)).toBeInTheDocument();
    expect(screen.getByText(/low stock/i)).toBeInTheDocument();
    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
  });

  it("immediately quick-adds a single-variant product on tap", () => {
    const onQuickAdd = vi.fn();
    const onOpenVariantModal = vi.fn();
    render(
      <SearchPanel
        query="tee"
        onQueryChange={vi.fn()}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[]}
        products={[SINGLE_VARIANT_PRODUCT]}
        loading={false}
        onQuickAdd={onQuickAdd}
        onOpenVariantModal={onOpenVariantModal}
      />
    );
    fireEvent.click(screen.getByText("Plain Tee"));
    expect(onQuickAdd).toHaveBeenCalledWith(SINGLE_VARIANT_PRODUCT, "v1");
    expect(onOpenVariantModal).not.toHaveBeenCalled();
  });

  it("opens the variant modal for a multi-variant product on tap", () => {
    const onQuickAdd = vi.fn();
    const onOpenVariantModal = vi.fn();
    render(
      <SearchPanel
        query="shirt"
        onQueryChange={vi.fn()}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[]}
        products={[MULTI_VARIANT_PRODUCT]}
        loading={false}
        onQuickAdd={onQuickAdd}
        onOpenVariantModal={onOpenVariantModal}
      />
    );
    fireEvent.click(screen.getByText("GTS Oxford Shirt"));
    expect(onOpenVariantModal).toHaveBeenCalledWith(MULTI_VARIANT_PRODUCT);
    expect(onQuickAdd).not.toHaveBeenCalled();
  });

  it("does not add an out-of-stock product on tap", () => {
    const onQuickAdd = vi.fn();
    const onOpenVariantModal = vi.fn();
    render(
      <SearchPanel
        query="jacket"
        onQueryChange={vi.fn()}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[]}
        products={[OUT_OF_STOCK_PRODUCT]}
        loading={false}
        onQuickAdd={onQuickAdd}
        onOpenVariantModal={onOpenVariantModal}
      />
    );
    fireEvent.click(screen.getByText("Sold Out Jacket"));
    expect(onQuickAdd).not.toHaveBeenCalled();
    expect(onOpenVariantModal).not.toHaveBeenCalled();
  });

  it("calls onQueryChange as the cashier types", () => {
    const onQueryChange = vi.fn();
    render(
      <SearchPanel
        query=""
        onQueryChange={onQueryChange}
        category="all"
        onCategoryChange={vi.fn()}
        categories={[]}
        products={[]}
        loading={false}
        onQuickAdd={vi.fn()}
        onOpenVariantModal={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/search by product name or sku/i), {
      target: { value: "shirt" },
    });
    expect(onQueryChange).toHaveBeenCalledWith("shirt");
  });
});
