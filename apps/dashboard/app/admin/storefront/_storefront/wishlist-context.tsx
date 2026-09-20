"use client";

import React, { createContext, useContext, useState } from "react";

export interface WishlistContextType {
  wishlistIds: string[];
  wishlist: any[];
  wishlistItems: any[];
  wishlistCount: number;
  isInWishlist: (productId: string) => boolean;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  addToWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
}

const defaultWishlistContext: WishlistContextType = {
  wishlistIds: [],
  wishlist: [],
  wishlistItems: [],
  wishlistCount: 0,
  isInWishlist: () => false,
  isWishlisted: () => false,
  toggleWishlist: () => {},
  addToWishlist: () => {},
  removeFromWishlist: () => {},
  clearWishlist: () => {},
};

const WishlistContext = createContext<WishlistContextType>(defaultWishlistContext);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  const isInWishlist = (id: string) => wishlistIds.includes(id);
  const isWishlisted = (id: string) => wishlistIds.includes(id);

  const toggleWishlist = (id: string) => {
    setWishlistIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addToWishlist = (id: string) => {
    setWishlistIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeFromWishlist = (id: string) => {
    setWishlistIds((prev) => prev.filter((item) => item !== id));
  };

  const clearWishlist = () => {
    setWishlistIds([]);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlist: [],
        wishlistItems: [],
        wishlistCount: wishlistIds.length,
        isInWishlist,
        isWishlisted,
        toggleWishlist,
        addToWishlist,
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
  return context || defaultWishlistContext;
}
