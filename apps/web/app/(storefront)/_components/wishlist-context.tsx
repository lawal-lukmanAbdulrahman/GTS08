"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { ProductItem } from "../_data/products";
import { useCatalogue } from "./catalogue-context";
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
  const { products: catalogue } = useCatalogue();
  const latest = useRef<string[]>([]);
  latest.current = wishlistIds;
  const syncedFor = useRef<string | null>(null);

  const token = useCallback(() => {
    if (typeof window === "undefined" || !userId) return null;
    return localStorage.getItem("gts_customer_token") || localStorage.getItem("gts_token");
  }, [userId]);

  // Load wishlist from localStorage on client mount (guest mode initial state)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setWishlistIds(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
        }
      }
    } catch (e) {
      console.error("Failed to load wishlist from localStorage", e);
    }
    setHydrated(true);
  }, []);

  // Save to localStorage whenever wishlist changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch (e) {
      console.error("Failed to save wishlist to localStorage", e);
    }
  }, [wishlistIds, hydrated]);

  // On sign-in: sync what the account has saved on the database with local items
  useEffect(() => {
    if (!hydrated || !userId || syncedFor.current === userId) return;
    const t = token();
    if (!t) return;
    syncedFor.current = userId;

    (async () => {
      const serverSlugs = await fetchWishlistSlugs(t);
      if (serverSlugs === null) return;

      const currentLocal = latest.current;
      const combined = [...new Set([...currentLocal, ...serverSlugs])];
      setWishlistIds(combined);

      // Save any local-only items to the database
      const browserOnly = currentLocal.filter((id) => !serverSlugs.includes(id));
      await Promise.all(browserOnly.map((id) => saveWishlistSlug(t, id)));
    })();
  }, [hydrated, userId, token]);

  const isInWishlist = useCallback(
    (productId: string) => {
      if (!productId) return false;
      if (wishlistIds.includes(productId)) return true;
      const item = catalogue.find((p) => p.id === productId || p.productId === productId);
      if (item) {
        return wishlistIds.includes(item.id) || (item.productId ? wishlistIds.includes(item.productId) : false);
      }
      return false;
    },
    [wishlistIds, catalogue]
  );

  const toggleWishlist = useCallback(
    (productId: string) => {
      if (!productId) return;
      const t = token();
      const inList = isInWishlist(productId);
      const item = catalogue.find((p) => p.id === productId || p.productId === productId);

      if (inList) {
        // Remove from wishlist
        setWishlistIds((prev) =>
          prev.filter((id) => id !== productId && (!item || (id !== item.id && id !== item.productId)))
        );
        if (t) {
          void removeWishlistSlug(t, productId);
        }
      } else {
        // Add to wishlist
        setWishlistIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
        if (t) {
          void saveWishlistSlug(t, productId);
        }
      }
    },
    [token, isInWishlist, catalogue]
  );

  const removeFromWishlist = useCallback(
    (productId: string) => {
      if (!productId) return;
      const t = token();
      const item = catalogue.find((p) => p.id === productId || p.productId === productId);
      setWishlistIds((prev) =>
        prev.filter((id) => id !== productId && (!item || (id !== item.id && id !== item.productId)))
      );
      if (t) {
        void removeWishlistSlug(t, productId);
      }
    },
    [token, catalogue]
  );

  const clearWishlist = useCallback(() => {
    const t = token();
    const current = [...latest.current];
    setWishlistIds([]);
    if (t) {
      current.forEach((id) => void removeWishlistSlug(t, id));
    }
  }, [token]);

  // Resolve product objects from catalogue with deduplication
  const wishlistItems = useMemo(() => {
    const seen = new Set<string>();
    const items: ProductItem[] = [];
    for (const id of wishlistIds) {
      const p = catalogue.find((item) => item.id === id || item.productId === id);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        items.push(p);
      }
    }
    return items;
  }, [wishlistIds, catalogue]);

  const wishlistCount = wishlistItems.length > 0 ? wishlistItems.length : wishlistIds.length;

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistItems,
        wishlistCount,
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
