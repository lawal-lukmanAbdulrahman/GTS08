import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (p: { alt: string }) => <img alt={p.alt} /> }));
vi.mock("../app/(storefront)/_components/landing/footer", () => ({ Footer: () => null }));
vi.mock("../app/(storefront)/_components/ui/product-card", () => ({ ProductCard: () => null }));
vi.mock("../app/(storefront)/_components/catalogue-context", () => ({ useCatalogue: () => ({ products: [] }) }));
vi.mock("../app/(storefront)/_lib/use-checkout-quote", () => ({ useCheckoutQuote: () => ({ quote: null, error: null }) }));

const cart = { cartItems: [] as any[], removeFromCart: vi.fn(), clearCart: vi.fn(), updateQuantity: vi.fn(), setQuantity: vi.fn(), syncCartLimits: vi.fn(), totalItemCount: 0, hydrated: true };
vi.mock("../app/(storefront)/_components/cart-context", () => ({ useCart: () => cart }));

import CartPage from "../app/(storefront)/cart/page";

const item = (id: string) => ({ product: { id, title: id, image: "/x.png", priceNum: 1000, brand: "GTS" }, size: "M", color: "Black", quantity: 1 });

beforeEach(() => {
  push.mockReset();
  cart.removeFromCart = vi.fn();
  cart.clearCart = vi.fn();
});

describe("cart page", () => {
  it("goes straight to the product listing when the last item is removed", () => {
    cart.cartItems = [item("shirt")];
    cart.totalItemCount = 1;
    render(<CartPage />);
    fireEvent.click(screen.getByRole("button", { name: /remove item/i }));
    expect(cart.removeFromCart).toHaveBeenCalledWith(0);
    expect(push).toHaveBeenCalledWith("/search");
  });

  it("stays on the cart while other items remain", () => {
    cart.cartItems = [item("shirt"), item("tie")];
    cart.totalItemCount = 2;
    render(<CartPage />);
    fireEvent.click(screen.getAllByRole("button", { name: /remove item/i })[0]!);
    expect(push).not.toHaveBeenCalled();
  });

  it("goes to the product listing after clearing the whole cart", () => {
    cart.cartItems = [item("shirt"), item("tie")];
    cart.totalItemCount = 2;
    render(<CartPage />);
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(cart.clearCart).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/search");
  });
});
