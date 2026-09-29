import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { WishlistProvider, useWishlist } from "../app/(storefront)/_components/wishlist-context";
import { AuthContext } from "../app/(storefront)/_components/auth-context";

vi.mock("../app/(storefront)/_lib/server-sync", () => ({
  fetchWishlistSlugs: vi.fn().mockResolvedValue([]),
  saveWishlistSlug: vi.fn().mockResolvedValue(true),
  removeWishlistSlug: vi.fn().mockResolvedValue(true),
}));

import { fetchWishlistSlugs, saveWishlistSlug, removeWishlistSlug } from "../app/(storefront)/_lib/server-sync";

function Probe() {
  const { wishlistIds, isInWishlist, toggleWishlist, removeFromWishlist, clearWishlist } = useWishlist();
  return (
    <div>
      <span data-testid="ids">{wishlistIds.join(",")}</span>
      <span data-testid="is-shirt">{isInWishlist("shirt") ? "yes" : "no"}</span>
      <button data-testid="toggle-shirt" onClick={() => toggleWishlist("shirt")}>Toggle Shirt</button>
      <button data-testid="toggle-pants" onClick={() => toggleWishlist("pants")}>Toggle Pants</button>
      <button data-testid="remove-shirt" onClick={() => removeFromWishlist("shirt")}>Remove Shirt</button>
      <button data-testid="clear" onClick={() => clearWishlist()}>Clear</button>
    </div>
  );
}

const show = (authVal: any = null) =>
  render(
    <AuthContext.Provider value={authVal}>
      <WishlistProvider>
        <Probe />
      </WishlistProvider>
    </AuthContext.Provider>
  );

describe("the wishlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("starts empty for a first-time visitor", async () => {
    show();
    await waitFor(() => expect(localStorage.getItem("gts_wishlist_items")).not.toBeNull());
    expect(screen.getByTestId("ids")).toHaveTextContent("");
  });

  it("restores what the visitor saved in localStorage (guest mode)", async () => {
    localStorage.setItem("gts_wishlist_items", JSON.stringify(["fan", "tv"]));
    show();
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("fan,tv"));
    expect(screen.getByTestId("is-shirt")).toHaveTextContent("no");
  });

  it("allows guest users to toggle items and persists to localStorage without API calls", async () => {
    show();
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent(""));

    fireEvent.click(screen.getByTestId("toggle-shirt"));
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("shirt"));
    expect(screen.getByTestId("is-shirt")).toHaveTextContent("yes");
    expect(JSON.parse(localStorage.getItem("gts_wishlist_items") || "[]")).toEqual(["shirt"]);

    expect(saveWishlistSlug).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("toggle-shirt"));
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent(""));
    expect(screen.getByTestId("is-shirt")).toHaveTextContent("no");
    expect(JSON.parse(localStorage.getItem("gts_wishlist_items") || "[]")).toEqual([]);
  });

  it("syncs with database when signed in with gts_customer_token", async () => {
    localStorage.setItem("gts_customer_token", "test-customer-token");
    localStorage.setItem("gts_wishlist_items", JSON.stringify(["local-item"]));
    vi.mocked(fetchWishlistSlugs).mockResolvedValueOnce(["server-item"]);

    const mockAuth = {
      user: { id: "user-123", email: "customer@example.com" } as any,
      customer: null,
      savedAddresses: [],
      isLoading: false,
      signInWithPassword: vi.fn(),
      signInWithOtp: vi.fn(),
      signUp: vi.fn(),
      claimAccount: vi.fn(),
      signOut: vi.fn(),
      refreshCustomer: vi.fn(),
      addSavedAddress: vi.fn(),
      deleteSavedAddress: vi.fn(),
    };

    show(mockAuth);

    await waitFor(() => {
      expect(fetchWishlistSlugs).toHaveBeenCalledWith("test-customer-token");
      expect(screen.getByTestId("ids")).toHaveTextContent("local-item,server-item");
      expect(saveWishlistSlug).toHaveBeenCalledWith("test-customer-token", "local-item");
    });
  });

  it("calls saveWishlistSlug and removeWishlistSlug when logged-in user toggles items", async () => {
    localStorage.setItem("gts_customer_token", "test-customer-token");
    vi.mocked(fetchWishlistSlugs).mockResolvedValueOnce([]);

    const mockAuth = {
      user: { id: "user-123", email: "customer@example.com" } as any,
      customer: null,
      savedAddresses: [],
      isLoading: false,
      signInWithPassword: vi.fn(),
      signInWithOtp: vi.fn(),
      signUp: vi.fn(),
      claimAccount: vi.fn(),
      signOut: vi.fn(),
      refreshCustomer: vi.fn(),
      addSavedAddress: vi.fn(),
      deleteSavedAddress: vi.fn(),
    };

    show(mockAuth);

    await waitFor(() => expect(fetchWishlistSlugs).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("toggle-shirt"));
    await waitFor(() => {
      expect(saveWishlistSlug).toHaveBeenCalledWith("test-customer-token", "shirt");
      expect(screen.getByTestId("ids")).toHaveTextContent("shirt");
    });

    fireEvent.click(screen.getByTestId("toggle-shirt"));
    await waitFor(() => {
      expect(removeWishlistSlug).toHaveBeenCalledWith("test-customer-token", "shirt");
      expect(screen.getByTestId("ids")).toHaveTextContent("");
    });
  });
});
