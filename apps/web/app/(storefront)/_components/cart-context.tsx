"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ProductItem, REAL_PRODUCTS } from "../_data/products";

export interface CartItem {
  product: ProductItem;
  size: string;
  color: string;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: ProductItem, size?: string, color?: string, quantity?: number) => void;
  removeFromCart: (index: number) => void;
  updateQuantity: (index: number, delta: number) => void;
  clearCart: () => void;
  totalItemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "gts_shopping_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Start with an empty cart for SSR — localStorage is only available client-side.
  // We hydrate from localStorage in a useEffect so server and client render the same
  // initial HTML (empty cart), preventing the hydration mismatch on the badge count.
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // On first client render, load saved cart from localStorage (or fall back to demo items)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        setCartItems(JSON.parse(saved));
      } else {
        // Default demo cart items shown to first-time visitors
        setCartItems([
          {
            product: REAL_PRODUCTS[0]!,
            size: "EU 42 (US 9)",
            color: "University Blue",
            quantity: 1,
          },
          {
            product: REAL_PRODUCTS[2]!,
            size: "Large (L)",
            color: "Sky Blue",
            quantity: 2,
          },
        ]);
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage", e);
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to localStorage whenever cart changes (after initial hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [cartItems, hydrated]);

  const addToCart = (
    product: ProductItem,
    size?: string,
    color?: string,
    quantity: number = 1
  ) => {
    const defaultSize = size || (product.sizes && product.sizes[0]) || "Standard";
    const defaultColor = color || (product.images && product.images[0]?.label) || "Default";

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.size === defaultSize &&
          item.color === defaultColor
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        const existingItem = updated[existingIndex]!;
        updated[existingIndex] = {
          ...existingItem,
          quantity: existingItem.quantity + quantity,
        };
        return updated;
      }

      return [
        ...prev,
        {
          product,
          size: defaultSize,
          color: defaultColor,
          quantity,
        },
      ];
    });
  };

  const removeFromCart = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, delta: number) => {
    setCartItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
