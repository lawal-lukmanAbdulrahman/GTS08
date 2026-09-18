import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import VariantModal from "./variant-modal";
import type { PosProduct } from "./pos-types";

const PRODUCT: PosProduct = {
  id: "p1",
  name: "GTS Oxford Shirt",
  slug: "gts-oxford-shirt",
  base_price: 1500000,
  category: null,
  primary_image: null,
  stock_status: "in_stock",
  variants: [
    { id: "v-s", size: "S", color: "Black", color_hex: "#000", sku: "S-BLK", price_modifier: 0, quantity: 5, available: 5 },
    { id: "v-m", size: "M", color: "Black", color_hex: "#000", sku: "M-BLK", price_modifier: 0, quantity: 0, available: 0 },
    { id: "v-l", size: "L", color: "White", color_hex: "#fff", sku: "L-WHT", price_modifier: 50000, quantity: 3, available: 3 },
  ],
};

describe("VariantModal (spec Part 3.4)", () => {
  it("disables Add to Cart until a size is selected", () => {
    render(<VariantModal product={PRODUCT} onAddToCart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeDisabled();
  });

  it("grays out a size that is out of stock", () => {
    render(<VariantModal product={PRODUCT} onAddToCart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "M" })).toBeDisabled();
  });

  it("updates the displayed price when a variant with a price_modifier is selected", () => {
    render(<VariantModal product={PRODUCT} onAddToCart={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "S" }));
    expect(screen.getAllByText(/₦15,000/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "L" }));
    expect(screen.getAllByText(/₦15,500/).length).toBeGreaterThan(0);
  });

  it("calls onAddToCart with the selected variant and quantity", () => {
    const onAddToCart = vi.fn();
    render(<VariantModal product={PRODUCT} onAddToCart={onAddToCart} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "S" }));
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(onAddToCart).toHaveBeenCalledWith(PRODUCT, "v-s", 2);
  });

  it("pre-selects the variant when preselectedVariantId is given (barcode scan, spec Part 7)", () => {
    render(
      <VariantModal
        product={PRODUCT}
        preselectedVariantId="v-l"
        onAddToCart={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeEnabled();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<VariantModal product={PRODUCT} onAddToCart={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
