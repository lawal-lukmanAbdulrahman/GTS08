"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ProductItem } from "../_data/products";
import { useCatalogue } from "./catalogue-context";
import { AuthContext } from "./auth-context";
import { getCartSessionId, linesToCartItems, mergeCart, pushCart, setCartSessionId, unionCart } from "../_lib/server-sync";

export interface CartItem {
  product: ProductItem;
  size: string;
  color: string;
  quantity: number;
  variantId?: string;
  maxAvailable?: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (
    product: ProductItem,
    size?: string,
    color?: string,
    quantity?: number,
    variantId?: string,
    maxAvailable?: number
  ) => { ok: boolean; message?: string };
  removeFromCart: (index: number) => void;
  updateQuantity: (index: number, delta: number) => void;
  setQuantity: (index: number, quantity: number) => void;
  syncCartLimits: (limits: Array<{ product_slug: string; size?: string | null; color?: string | null; available: number }>) => void;
  clearCart: () => void;
  totalItemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "gts_shopping_cart";
/** How long the cart must sit still before its server copy is refreshed. */
const PUSH_DELAY_MS = 800;

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Start with an empty cart for SSR — localStorage is only available client-side.
  // We hydrate from localStorage in a useEffect so server and client render the same
  // initial HTML (empty cart), preventing the hydration mismatch on the badge count.
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Signed in or not (the cart works outside an AuthProvider too, e.g. in tests).
  const userId = useContext(AuthContext)?.user?.id ?? null;
  const { products: catalogue } = useCatalogue();
  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;
  const latest = useRef<CartItem[]>([]);
  latest.current = cartItems;
  const pushedOnce = useRef(false);
  const merging = useRef(false);
  const mergedFor = useRef<string | null>(null);

  // On first client render, load the visitor's saved cart. A first-time visitor starts with an empty one.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCartItems(parsed);
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage", e);
    }
    setHydrated(true);
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

  // The server keeps a copy so the cart follows a shopper who signs in. The browser copy is what they see; a failed sync changes nothing.
  useEffect(() => {
    if (!hydrated || merging.current) return;
    if (cartItems.length === 0 && !pushedOnce.current) return; // a visitor who never had a cart costs the server nothing
    const timer = setTimeout(async () => {
      if (await pushCart(getCartSessionId(), latest.current)) pushedOnce.current = true;
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cartItems, hydrated]);

  // On sign-in: send the browser's cart, fold it into the one saved on the account, and show the result.
  useEffect(() => {
    if (!hydrated || !userId || mergedFor.current === userId) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
    if (!token) return;
    mergedFor.current = userId;
    merging.current = true;
    (async () => {
      try {
        const sessionId = getCartSessionId();
        await pushCart(sessionId, latest.current);
        const merged = await mergeCart(sessionId, token);
        if (merged) {
          setCartSessionId(merged.sessionId);
          pushedOnce.current = true;
          setCartItems((prev) => unionCart(prev, linesToCartItems(merged.lines, catalogueRef.current)));
        }
      } finally {
        merging.current = false;
      }
    })();
  }, [hydrated, userId]);

  const addToCart = (
    product: ProductItem,
    size?: string,
    color?: string,
    quantity: number = 1,
    variantId?: string,
    maxAvailable?: number
  ): { ok: boolean; message?: string } => {
    const defaultSize = size || (product.sizes && product.sizes[0]) || "Standard";
    const defaultColor = color || (product.images && product.images[0]?.label) || "Default";

    // Resolve max available stock
    let resolvedMax = maxAvailable;
    if (resolvedMax === undefined && product.variants && product.variants.length > 0) {
      const match = product.variants.find(
        (v) => (variantId && v.id === variantId) ||
               (v.size?.toLowerCase() === defaultSize.toLowerCase() && v.color?.toLowerCase() === defaultColor.toLowerCase())
      ) || product.variants[0];
      if (match) {
        resolvedMax = match.available;
      }
    }
    if (resolvedMax === undefined && typeof product.availableStock === "number") {
      resolvedMax = product.availableStock;
    }
    const capLimit = resolvedMax !== undefined ? Math.max(0, resolvedMax) : 999;

    if (capLimit <= 0) {
      return { ok: false, message: "This item is currently out of stock." };
    }

    let resultOk = true;
    let resultMsg: string | undefined = undefined;

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
        const desiredQty = existingItem.quantity + quantity;
        const finalQty = Math.min(capLimit, desiredQty);

        if (desiredQty > capLimit) {
          resultOk = false;
          resultMsg = `Maximum available stock of ${capLimit} reached.`;
        }

        updated[existingIndex] = {
          ...existingItem,
          quantity: finalQty,
          maxAvailable: capLimit,
          variantId: variantId || existingItem.variantId,
        };
        return updated;
      }

      const initialQty = Math.min(capLimit, quantity);
      if (quantity > capLimit) {
        resultOk = false;
        resultMsg = `Only ${capLimit} available in stock. Added ${initialQty} to your cart.`;
      }

      return [
        ...prev,
        {
          product,
          size: defaultSize,
          color: defaultColor,
          quantity: initialQty,
          maxAvailable: capLimit,
          variantId,
        },
      ];
    });

    return { ok: resultOk, message: resultMsg };
  };

  const removeFromCart = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, delta: number) => {
    setCartItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const maxStock = item.maxAvailable ?? item.product.availableStock ?? 999;
          const target = item.quantity + delta;
          const newQty = Math.max(1, Math.min(maxStock, target));
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const setQuantity = (index: number, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const maxStock = item.maxAvailable ?? item.product.availableStock ?? 999;
          const newQty = Math.max(1, Math.min(maxStock, quantity));
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const syncCartLimits = (
    limits: Array<{ product_slug: string; size?: string | null; color?: string | null; available: number }>
  ) => {
    setCartItems((prev) =>
      prev.map((item) => {
        const match = limits.find(
          (l) =>
            l.product_slug === item.product.id &&
            (l.size ?? "").toLowerCase() === (item.size ?? "").toLowerCase() &&
            (l.color ?? "").toLowerCase() === (item.color ?? "").toLowerCase()
        );
        if (match) {
          return {
            ...item,
            maxAvailable: match.available,
          };
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
        setQuantity,
        syncCartLimits,
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
