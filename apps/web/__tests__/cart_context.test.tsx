import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
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

  it("syncCartLimits updates maxAvailable when inventory limit differs", async () => {
    let contextValue: ReturnType<typeof useCart> | null = null;
    function LimitProbe() {
      contextValue = useCart();
      return (
        <div>
          {contextValue.cartItems.map((item, i) => (
            <span key={i} data-testid={`limit-${i}`}>
              {item.maxAvailable ?? "none"}
            </span>
          ))}
        </div>
      );
    }

    localStorage.setItem(
      "gts_shopping_cart",
      JSON.stringify([{ product: { id: "p1", name: "Fan", price: 1 }, size: "M", color: "Black", quantity: 2 }])
    );

    render(
      <CartProvider>
        <LimitProbe />
      </CartProvider>
    );

    await waitFor(() => expect(screen.getByTestId("limit-0")).toHaveTextContent("none"));

    act(() => {
      contextValue!.syncCartLimits([{ product_slug: "p1", size: "M", color: "Black", available: 5 }]);
    });

    await waitFor(() => expect(screen.getByTestId("limit-0")).toHaveTextContent("5"));
  });

  it("syncCartLimits does not mutate state or trigger re-renders when limits are identical (prevents infinite loop)", async () => {
    let renderCount = 0;
    let contextValue: ReturnType<typeof useCart> | null = null;
    function LoopGuardProbe() {
      renderCount++;
      contextValue = useCart();
      return <span data-testid="renders">{renderCount}</span>;
    }

    localStorage.setItem(
      "gts_shopping_cart",
      JSON.stringify([{ product: { id: "p1", name: "Fan", price: 1 }, size: "M", color: "Black", quantity: 2, maxAvailable: 5 }])
    );

    render(
      <CartProvider>
        <LoopGuardProbe />
      </CartProvider>
    );

    await waitFor(() => expect(screen.getByTestId("renders")).not.toHaveTextContent("0"));
    const countBefore = renderCount;

    // Calling syncCartLimits with the exact same available limit (5)
    act(() => {
      contextValue!.syncCartLimits([{ product_slug: "p1", size: "M", color: "Black", available: 5 }]);
    });

    // renderCount should remain identical because setCartItems returns prev
    expect(renderCount).toBe(countBefore);
  });

  it("syncCartLimits maintains a stable callback reference across re-renders", async () => {
    const references: Array<ReturnType<typeof useCart>["syncCartLimits"]> = [];
    function RefProbe() {
      const { syncCartLimits, updateQuantity } = useCart();
      references.push(syncCartLimits);
      return <button onClick={() => updateQuantity(0, 1)}>incr</button>;
    }

    localStorage.setItem(
      "gts_shopping_cart",
      JSON.stringify([{ product: { id: "p1", name: "Fan", price: 1 }, size: "M", color: "Black", quantity: 1 }])
    );

    render(
      <CartProvider>
        <RefProbe />
      </CartProvider>
    );

    await waitFor(() => expect(references.length).toBeGreaterThan(0));
    act(() => {
      screen.getByRole("button").click();
    });
    await waitFor(() => expect(references.length).toBeGreaterThan(1));
    expect(references[0]).toBe(references[references.length - 1]);
  });
});
