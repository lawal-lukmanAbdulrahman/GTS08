import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CartProvider, useCart } from "../app/(storefront)/_components/cart-context";

function Probe() {
  const { cartItems, totalItemCount } = useCart();
  return (
    <div>
      <span data-testid="lines">{cartItems.length}</span>
      <span data-testid="count">{totalItemCount}</span>
    </div>
  );
}
const show = () =>
  render(
    <CartProvider>
      <Probe />
    </CartProvider>
  );

describe("the shopping cart", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty for a first-time visitor (no items they never chose)", async () => {
    show();
    await waitFor(() => expect(screen.getByTestId("lines")).toHaveTextContent("0"));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("restores what the visitor saved", async () => {
    localStorage.setItem(
      "gts_shopping_cart",
      JSON.stringify([{ product: { id: "p1", name: "Fan", price: 1 }, size: "M", color: "Black", quantity: 3 }])
    );
    show();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("3"));
  });

  it("starts empty rather than crash if the saved cart is corrupt", async () => {
    localStorage.setItem("gts_shopping_cart", "{not json");
    show();
    await waitFor(() => expect(screen.getByTestId("lines")).toHaveTextContent("0"));
  });
});
