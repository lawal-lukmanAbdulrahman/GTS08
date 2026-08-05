"use client";

import React, { createContext, useContext, useState } from "react";

export type AuthMode = "login" | "signup";

interface AuthModalContextType {
  isOpen: boolean;
  mode: AuthMode;
  openAuthModal: (initialMode?: AuthMode) => void;
  closeAuthModal: () => void;
  setMode: (mode: AuthMode) => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  const openAuthModal = (initialMode: AuthMode = "login") => {
    setMode(initialMode);
    setIsOpen(true);
  };

  const closeAuthModal = () => {
    setIsOpen(false);
  };

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        mode,
        openAuthModal,
        closeAuthModal,
        setMode,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
}
