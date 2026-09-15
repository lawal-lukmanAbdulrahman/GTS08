"use client";

import React, { createContext, useContext } from "react";

const defaultAuthContext = {
  user: null,
  customer: null,
  profile: null,
  session: null,
  isLoading: false,
  signOut: async () => {},
};

const AuthContext = createContext<any>(defaultAuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={defaultAuthContext}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context || defaultAuthContext;
}
