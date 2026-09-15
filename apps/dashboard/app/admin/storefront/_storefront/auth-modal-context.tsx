"use client";

import React, { createContext, useContext } from "react";

const defaultAuthModalContext = {
  isOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
};

const AuthModalContext = createContext<any>(defaultAuthModalContext);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthModalContext.Provider value={defaultAuthModalContext}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  return context || defaultAuthModalContext;
}
