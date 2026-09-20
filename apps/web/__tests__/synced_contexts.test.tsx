import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";

const sync = vi.hoisted(() => ({
  getCartSessionId: vi.fn(),
  setCartSessionId: vi.fn(),
  pushCart: vi.fn(),
  mergeCart: vi.fn(),
  linesToCartItems: vi.fn(),
  unionCart: vi.fn(),
  fetchWishlistSlugs: vi.fn(),
  saveWishlistSlug: vi.fn(),
  removeWishlistSlug: vi.fn(),
}));
vi.mock("../app/(storefront)/_lib/server-sync", () => sync);

import { AuthContext } from "../app/(storefront)/_components/auth-context";
import { CartProvider, useCart } from "../app/(storefront)/_components/cart-context";
import { WishlistProvider, useWishlist } from "../app/(storefront)/_components/wishlist-context";

const PRODUCT = { id: "fan", title: "Fan", images: [], sizes: [] } as never;
const withUser = (user: { id: string } | null, children: React.ReactNode) => (
  <AuthContext.Provider value={{ user } as never}>{children}</AuthContext.Provider>
);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  localStorage.setItem("gts_token", "tok");
  Object.values(sync).forEach((f) => f.mockReset());
  sync.getCartSessionId.mockReturnValue("11111111-1111-4111-8111-111111111111");
  sync.pushCart.mockResolvedValue(true);
  sync.mergeCart.mockResolvedValue({ sessionId: "22222222-2222-4222-8222-222222222222", lines: [] });
  sync.linesToCartItems.mockReturnValue([]);
  sync.unionCart.mockImplementation((local: unknown[], server: unknown[]) => [...server, ...local]);
  sync.saveWishlistSlug.mockResolvedValue(true);
  sync.removeWishlistSlug.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());

function CartProbe() {
  const { cartItems, addToCart, clearCart } = useCart();
  return (
    <div>
      <span data-testid="count">{cartItems.length}</span>
      <button onClick={() => addToCart(PRODUCT, "M", "Black", 1)}>add</button>
      <button onClick={() => clearCart()}>clear</button>
    </div>
  );
}
const clickAdd = () => act(async () => { screen.getByText("add").click(); });

describe("the cart is copied to the server", () => {
  it("pushes the cart shortly after it changes, once, not on every keystroke", async () => {
    render(withUser(null, <CartProvider><CartProbe /></CartProvider>));
    await clickAdd();
    await clickAdd();
    expect(sync.pushCart).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(sync.pushCart).toHaveBeenCalledTimes(1);
    expect(sync.pushCart).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", expect.arrayContaining([expect.objectContaining({ quantity: 2 })]));
  });

  it("doesn't call the server for a visitor who has never had a cart", async () => {
    render(withUser(null, <CartProvider><CartProbe /></CartProvider>));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(sync.pushCart).not.toHaveBeenCalled();
  });

  it("does push an emptied cart, so the server copy doesn't come back", async () => {
    render(withUser(null, <CartProvider><CartProbe /></CartProvider>));
    await clickAdd();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    sync.pushCart.mockClear();
    await act(async () => { screen.getByText("clear").click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(sync.pushCart).toHaveBeenCalledWith(expect.any(String), []);
  });

  it("keeps working, with the browser copy, when the server is down", async () => {
    sync.pushCart.mockResolvedValue(false);
    render(withUser(null, <CartProvider><CartProbe /></CartProvider>));
    await clickAdd();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });
});

describe("signing in merges the cart with the account's", () => {
  it("pushes the current cart, merges, adopts the server's lines and keeps the account's session", async () => {
    sync.linesToCartItems.mockReturnValue([{ product: { id: "tv" }, size: "55", color: "Black", quantity: 1 }]);
    sync.mergeCart.mockResolvedValue({ sessionId: "22222222-2222-4222-8222-222222222222", lines: [{}] });
    localStorage.setItem("gts_shopping_cart", JSON.stringify([{ product: PRODUCT, size: "M", color: "Black", quantity: 1 }]));
    render(withUser({ id: "u1" }, <CartProvider><CartProbe /></CartProvider>));
    await waitFor(() => expect(sync.mergeCart).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "tok"));
    expect(sync.pushCart.mock.invocationCallOrder[0]).toBeLessThan(sync.mergeCart.mock.invocationCallOrder[0]!);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    expect(sync.setCartSessionId).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
  });

  it("merges once per sign-in, and leaves the cart alone if the merge fails", async () => {
    sync.mergeCart.mockResolvedValue(null);
    localStorage.setItem("gts_shopping_cart", JSON.stringify([{ product: PRODUCT, size: "M", color: "Black", quantity: 3 }]));
    const { rerender } = render(withUser({ id: "u1" }, <CartProvider><CartProbe /></CartProvider>));
    await waitFor(() => expect(sync.mergeCart).toHaveBeenCalledTimes(1));
    rerender(withUser({ id: "u1" }, <CartProvider><CartProbe /></CartProvider>));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(sync.mergeCart).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("does nothing server-side for a signed-out visitor", async () => {
    localStorage.setItem("gts_shopping_cart", JSON.stringify([{ product: PRODUCT, size: "M", color: "Black", quantity: 1 }]));
    render(withUser(null, <CartProvider><CartProbe /></CartProvider>));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(sync.mergeCart).not.toHaveBeenCalled();
  });
});

function WishProbe() {
  const { wishlistIds, toggleWishlist, removeFromWishlist } = useWishlist();
  return (
    <div>
      <span data-testid="ids">{wishlistIds.join(",")}</span>
      <button onClick={() => toggleWishlist("fan")}>toggle</button>
      <button onClick={() => removeFromWishlist("tv")}>remove</button>
    </div>
  );
}

describe("the wishlist follows a signed-in shopper", () => {
  it("on sign-in, adds the account's saved products and saves the browser-only ones to the account", async () => {
    sync.fetchWishlistSlugs.mockResolvedValue(["tv"]);
    localStorage.setItem("gts_wishlist_items", JSON.stringify(["fan"]));
    render(withUser({ id: "u1" }, <WishlistProvider><WishProbe /></WishlistProvider>));
    await waitFor(() => expect(screen.getByTestId("ids").textContent!.split(",").sort()).toEqual(["fan", "tv"]));
    expect(sync.saveWishlistSlug).toHaveBeenCalledWith("tok", "fan");
    expect(sync.saveWishlistSlug).not.toHaveBeenCalledWith("tok", "tv");
  });

  it("saves and removes on the server as the shopper does, when signed in", async () => {
    sync.fetchWishlistSlugs.mockResolvedValue([]);
    render(withUser({ id: "u1" }, <WishlistProvider><WishProbe /></WishlistProvider>));
    await waitFor(() => expect(sync.fetchWishlistSlugs).toHaveBeenCalled());
    await act(async () => { screen.getByText("toggle").click(); });
    expect(sync.saveWishlistSlug).toHaveBeenLastCalledWith("tok", "fan");
    await act(async () => { screen.getByText("toggle").click(); });
    expect(sync.removeWishlistSlug).toHaveBeenLastCalledWith("tok", "fan");
    await act(async () => { screen.getByText("remove").click(); });
    expect(sync.removeWishlistSlug).toHaveBeenLastCalledWith("tok", "tv");
  });

  it("keeps the browser list if the account's can't be read", async () => {
    sync.fetchWishlistSlugs.mockResolvedValue(null);
    localStorage.setItem("gts_wishlist_items", JSON.stringify(["fan"]));
    render(withUser({ id: "u1" }, <WishlistProvider><WishProbe /></WishlistProvider>));
    await waitFor(() => expect(sync.fetchWishlistSlugs).toHaveBeenCalled());
    expect(screen.getByTestId("ids")).toHaveTextContent("fan");
    expect(sync.saveWishlistSlug).not.toHaveBeenCalled();
  });

  it("makes no server calls when signed out", async () => {
    render(withUser(null, <WishlistProvider><WishProbe /></WishlistProvider>));
    await act(async () => { screen.getByText("toggle").click(); });
    expect(sync.fetchWishlistSlugs).not.toHaveBeenCalled();
    expect(sync.saveWishlistSlug).not.toHaveBeenCalled();
    expect(screen.getByTestId("ids")).toHaveTextContent("fan");
  });
});
