"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@gts/database/client";
import type { User } from "@supabase/supabase-js";

export interface CustomerAddress {
  id: string;
  customer_id?: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  is_default: boolean;
  created_at?: string;
}

export interface CustomerProfile {
  id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  customer: CustomerProfile | null;
  savedAddresses: CustomerAddress[];
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName?: string, phone?: string) => Promise<{ error: string | null }>;
  claimAccount: (password: string, metadata?: { fullName?: string; phone?: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
  addSavedAddress: (address: Omit<CustomerAddress, "id">) => Promise<{ data?: CustomerAddress; error: string | null }>;
  deleteSavedAddress: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stable singleton client instance across renders
  const supabase = useMemo(() => createClient() as any, []);

  const fetchCustomerData = useCallback(
    async (userId: string, email: string, userMetadata?: any) => {
      try {
        const metadataName = userMetadata?.full_name || userMetadata?.name || null;
        const metadataPhone = userMetadata?.phone || null;

        // 1. Fetch from customers table
        const { data: custData } = await supabase
          .from("customers")
          .select("*")
          .or(`user_id.eq.${userId},email.eq.${email}`)
          .limit(1)
          .maybeSingle();

        if (custData) {
          setCustomer({
            ...custData,
            full_name: custData.full_name || metadataName || email.split("@")[0] || "Customer",
            phone: custData.phone || metadataPhone || null,
          });

          // Fetch saved addresses
          const { data: addrData } = await supabase
            .from("addresses")
            .select("*")
            .eq("customer_id", custData.id)
            .order("is_default", { ascending: false });

          if (addrData && addrData.length > 0) {
            setSavedAddresses(addrData);
          }
        } else {
          // Fallback to users table
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          setCustomer({
            id: userData?.id || userId,
            user_id: userId,
            full_name: userData?.full_name || metadataName || email.split("@")[0] || "Customer",
            email: userData?.email || email,
            phone: userData?.phone || metadataPhone || null,
          });
        }
      } catch (e) {
        console.warn("Could not load customer details from database:", e);
      }
    },
    [supabase]
  );

  useEffect(() => {
    // 1. Quick hydration from localStorage if already saved
    if (typeof window !== "undefined") {
      const savedUserStr = localStorage.getItem("gts_user");
      if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          if (parsed?.id) {
            setUser(parsed);
            if (parsed.email) {
              fetchCustomerData(parsed.id, parsed.email, parsed.user_metadata);
            }
          }
        } catch {
          // ignore corrupted local storage
        }
      }
    }

    // 2. Validate active session with Supabase
    supabase.auth.getSession().then((res: any) => {
      const session = res?.data?.session;
      if (session?.user) {
        setUser(session.user);
        if (session.access_token) {
          document.cookie = `gts_access_token=${session.access_token}; path=/; max-age=604800; SameSite=Lax`;
          localStorage.setItem("gts_user", JSON.stringify(session.user));
          localStorage.setItem("gts_token", session.access_token);
        }
        if (session.user.email) {
          fetchCustomerData(session.user.id, session.user.email, session.user.user_metadata);
        }
      }
      setIsLoading(false);
    });

    // 3. Auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (session?.user) {
        setUser(session.user);
        if (session.access_token) {
          document.cookie = `gts_access_token=${session.access_token}; path=/; max-age=604800; SameSite=Lax`;
          localStorage.setItem("gts_user", JSON.stringify(session.user));
          localStorage.setItem("gts_token", session.access_token);
        }
        if (session.user.email) {
          fetchCustomerData(session.user.id, session.user.email, session.user.user_metadata);
        }
      } else {
        // Only clear if no valid session
        setUser(null);
        setCustomer(null);
        setSavedAddresses([]);
        document.cookie = "gts_access_token=; path=/; max-age=0; SameSite=Lax";
        localStorage.removeItem("gts_user");
        localStorage.removeItem("gts_token");
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchCustomerData]);

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        if (data.session) {
          document.cookie = `gts_access_token=${data.session.access_token}; path=/; max-age=604800; SameSite=Lax`;
          localStorage.setItem("gts_user", JSON.stringify(data.user));
          localStorage.setItem("gts_token", data.session.access_token);
        }
        if (data.user.email) {
          await fetchCustomerData(data.user.id, data.user.email);
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to sign in" };
    }
  };

  const signInWithOtp = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/account` : undefined,
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to send login link" };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string, phone?: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Call backend registration endpoint to create & auto-confirm user in Supabase
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          full_name: fullName,
          phone,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        return { error: json.error || "Failed to register account" };
      }

      // 2. Immediately sign in with the verified credentials to establish session
      return await signInWithPassword(cleanEmail, password);
    } catch (err: any) {
      return { error: err.message || "Failed to register account" };
    }
  };

  const claimAccount = async (password: string, metadata?: { fullName?: string; phone?: string }) => {
    if (!customer?.email) {
      return { error: "No guest customer email found to claim." };
    }

    return signUp(customer.email, password, metadata?.fullName || customer.full_name, metadata?.phone || customer.phone || undefined);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setCustomer(null);
    setSavedAddresses([]);
    document.cookie = "gts_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "gts_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    localStorage.removeItem("gts_user");
    localStorage.removeItem("gts_token");
  };

  const refreshCustomer = async () => {
    if (user?.id && user.email) {
      await fetchCustomerData(user.id, user.email);
    }
  };

  const addSavedAddress = async (address: Omit<CustomerAddress, "id">) => {
    if (!customer?.id) {
      return { error: "Customer profile not found" };
    }

    try {
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          ...address,
          customer_id: customer.id,
        })
        .select("*")
        .single();

      if (error) {
        return { error: error.message };
      }

      setSavedAddresses((prev) => [data, ...prev]);
      return { data, error: null };
    } catch (err: any) {
      return { error: err.message || "Failed to add address" };
    }
  };

  const deleteSavedAddress = async (id: string) => {
    try {
      await supabase.from("addresses").delete().eq("id", id);
      setSavedAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete address:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customer,
        savedAddresses,
        isLoading,
        signInWithPassword,
        signInWithOtp,
        signUp,
        claimAccount,
        signOut,
        refreshCustomer,
        addSavedAddress,
        deleteSavedAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
