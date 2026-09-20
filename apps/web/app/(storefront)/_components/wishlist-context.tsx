"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { ProductItem, REAL_PRODUCTS } from "../_data/products";
import { AuthContext } from "./auth-context";
import { fetchWishlistSlugs, removeWishlistSlug, saveWishlistSlug } from "../_lib/server-sync";

interface WishlistContextType {
  wishlistIds: string[];
  wishlistItems: ProductItem[];
  wishlistCount: number;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "gts_wishlist_items";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const userId = useContext(AuthContext)?.user?.id ?? null;
  const latest = useRef<string[]>([]);
  latest.current = wishlistIds;
  const syncedFor = useRef<string | null>(null);

  const token = () => (typeof window !== "undefined" && userId ? localStorage.getItem("gts_token") : null);

  // On sign-in: take in what the account has saved, and save what was only in this browser.
  useEffect(() => {
    if (!hydrated || !userId || syncedFor.current === userId) return;
    const t = token();
    if (!t) return;
    syncedFor.current = userId;
    (async () => {
      const server = await fetchWishlistSlugs(t);
      if (server === null) return; // can't read the account's list: keep the browser's
      const browserOnly = latest.current.filter((id) => !server.includes(id));
      setWishlistIds((prev) => [...new Set([...prev, ...server])]);
      await Promise.all(browserOnly.map((id) => saveWishlistSlug(t, id)));
    })();
    // token() reads storage at call time
  }, [hydrated, userId]);

  // Load wishlist from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setWishlistIds(parsed.filter((id): id is string => typeof id === "string"));
      }
    } catch (e) {
      console.error("Failed to load wishlist from localStorage", e);
    }
    setHydrated(true);
  }, []);

  // Save to localStorage when wishlist changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch (e) {
      console.error("Failed to save wishlist to localStorage", e);
    }
  }, [wishlistIds, hydrated]);

  const isInWishlist = (productId: string) => wishlistIds.includes(productId);

  const toggleWishlist = (productId: string) => {
    const t = token();
    if (t) void (latest.current.includes(productId) ? removeWishlistSlug(t, productId) : saveWishlistSlug(t, productId));
    setWishlistIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const removeFromWishlist = (productId: string) => {
    const t = token();
    if (t) void removeWishlistSlug(t, productId);
    setWishlistIds((prev) => prev.filter((id) => id !== productId));
  };

  const clearWishlist = () => {
    const t = token();
    if (t) latest.current.forEach((id) => void removeWishlistSlug(t, id));
    setWishlistIds([]);
  };

  // Resolve product objects from catalog
  const wishlistItems = wishlistIds
    .map((id) => REAL_PRODUCTS.find((p) => p.id === id))
    .filter((p): p is ProductItem => p !== undefined);

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistItems,
        wishlistCount: wishlistIds.length,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
