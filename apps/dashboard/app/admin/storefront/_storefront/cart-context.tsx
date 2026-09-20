"use client";

import React, { createContext, useContext, useState } from "react";

export interface CartContextType {
  cartItems: any[];
  items: any[];
  totalItemCount: number;
  totalCount: number;
  subtotal: number;
  addToCart: (...args: any[]) => void;
  removeFromCart: (index: number) => void;
  updateQuantity: (index: number, delta: number) => void;
  clearCart: () => void;
}

const defaultCartContext: CartContextType = {
  cartItems: [],
  items: [],
  totalItemCount: 0,
  totalCount: 0,
  subtotal: 0,
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
};

const CartContext = createContext<CartContextType>(defaultCartContext);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<any[]>([]);

  const addToCart = () => {};
  const removeFromCart = () => {};
  const updateQuantity = () => {};
  const clearCart = () => setCartItems([]);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        items: cartItems,
        totalItemCount: cartItems.length,
        totalCount: cartItems.length,
        subtotal: 0,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  return context || defaultCartContext;
}
