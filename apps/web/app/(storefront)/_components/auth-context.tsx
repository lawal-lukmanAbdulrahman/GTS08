"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@gts/database/client";
import type { User } from "@supabase/supabase-js";
import { CATALOGUE_CACHE_KEY } from "./catalogue-context";
import { clearCustomerNotifications } from "../../../lib/notifications";

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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stable singleton client instance across renders. Constructed only in the browser:
  // during a server snapshot (static prerender) createBrowserClient throws when the
  // NEXT_PUBLIC_SUPABASE_* env vars aren't present in the build environment.
  const supabase = useMemo(
    () => (typeof window === "undefined" ? null : (createClient() as any)),
    []
  );

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

          // If this user is a staff account (admin, cashier, inventory_staff),
          // DO NOT treat them as a storefront customer, unless they are the demo account.
          if (userData && userData.role && userData.role !== "customer") {
            if (userData.is_demo) {
              setUser({ id: userId, email: userData.email, role: "customer", is_demo: true } as any);
              setCustomer({
                id: userId,
                user_id: userId,
                full_name: "Demo Shopper",
                email: userData.email || "demo@gts.ng",
                phone: null,
              });
              return;
            }

            setUser(null);
            setCustomer(null);
            setSavedAddresses([]);
            localStorage.removeItem("gts_customer_user");
            localStorage.removeItem("gts_customer_token");
            document.cookie = "gts_customer_token=; path=/; max-age=0";
            document.cookie = "gts_access_token=; path=/; max-age=0";
            supabase.auth.signOut().catch(() => undefined);
            return;
          }

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
      const isDemoStored =
        localStorage.getItem("gts_demo_mode") === "true" ||
        document.cookie.includes("gts_demo_mode=true");

      if (isDemoStored) {
        const demoUser = {
          id: "demo-user",
          email: "demo@gts.ng",
          role: "customer",
          full_name: "Demo Shopper",
          is_demo: true,
        };
        const savedUserStr = localStorage.getItem("gts_customer_user");
        let u = demoUser;
        if (savedUserStr) {
          try {
            const parsed = JSON.parse(savedUserStr);
            if (parsed?.is_demo) u = { ...demoUser, ...parsed };
          } catch {}
        }
        setUser(u as any);
        setCustomer({
          id: u.id,
          user_id: u.id,
          full_name: "Demo Shopper",
          email: u.email || "demo@gts.ng",
          phone: null,
        });
      } else {
        const savedUserStr = localStorage.getItem("gts_customer_user");
        if (savedUserStr) {
          try {
            const parsed = JSON.parse(savedUserStr);
            if (parsed?.id) {
              if (parsed.role && parsed.role !== "customer" && !parsed.is_demo) {
                localStorage.removeItem("gts_customer_user");
                localStorage.removeItem("gts_customer_token");
                document.cookie = "gts_customer_token=; path=/; max-age=0";
                document.cookie = "gts_access_token=; path=/; max-age=0";
              } else {
                setUser(parsed);
                if (parsed.email) {
                  fetchCustomerData(parsed.id, parsed.email, parsed.user_metadata);
                }
              }
            }
          } catch {
            // ignore corrupted local storage
          }
        }
      }
    }

    // 2. Validate active session with Supabase
    supabase.auth.getSession().then((res: any) => {
      const session = res?.data?.session;
      const isDemo =
        typeof window !== "undefined" &&
        (localStorage.getItem("gts_demo_mode") === "true" ||
          document.cookie.includes("gts_demo_mode=true"));

      if (session?.user) {
        if (isDemo) {
          const demoObj = { ...session.user, role: "customer", full_name: "Demo Shopper", is_demo: true };
          setUser(demoObj as any);
          setCustomer({
            id: session.user.id,
            user_id: session.user.id,
            full_name: "Demo Shopper",
            email: session.user.email || "demo@gts.ng",
            phone: null,
          });
        } else {
          setUser(session.user);
          if (session.access_token) {
            localStorage.setItem("gts_customer_user", JSON.stringify(session.user));
            localStorage.setItem("gts_customer_token", session.access_token);
          }
          if (session.user.email) {
            fetchCustomerData(session.user.id, session.user.email, session.user.user_metadata);
          }
        }
      } else if (isDemo) {
        setCustomer({
          id: "demo-user",
          user_id: "demo-user",
          full_name: "Demo Shopper",
          email: "demo@gts.ng",
          phone: null,
        });
      }
      setIsLoading(false);
    });

    // 3. Auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      const isDemo =
        typeof window !== "undefined" &&
        (localStorage.getItem("gts_demo_mode") === "true" ||
          document.cookie.includes("gts_demo_mode=true"));

      if (event === "SIGNED_OUT") {
        const oldUserId = user?.id || customer?.id;
        setUser(null);
        setCustomer(null);
        setSavedAddresses([]);
        localStorage.removeItem("gts_customer_user");
        localStorage.removeItem("gts_customer_token");
        localStorage.removeItem("gts_demo_mode");
        if (typeof document !== "undefined") {
          document.cookie = "gts_customer_token=; path=/; max-age=0";
          document.cookie = "gts_access_token=; path=/; max-age=0";
          document.cookie = "gts_demo_mode=; path=/; max-age=0";
        }
        clearCustomerNotifications(oldUserId);
        setIsLoading(false);
        return;
      }

      if (session?.user) {
        if (isDemo) {
          const demoObj = { ...session.user, role: "customer", full_name: "Demo Shopper", is_demo: true };
          setUser(demoObj as any);
          setCustomer({
            id: session.user.id,
            user_id: session.user.id,
            full_name: "Demo Shopper",
            email: session.user.email || "demo@gts.ng",
            phone: null,
          });
        } else {
          setUser(session.user);
          if (session.access_token) {
            localStorage.setItem("gts_customer_user", JSON.stringify(session.user));
            localStorage.setItem("gts_customer_token", session.access_token);
          }
          if (session.user.email) {
            fetchCustomerData(session.user.id, session.user.email, session.user.user_metadata);
          }
        }
      } else if (isDemo) {
        // Keep demo shopper active on refresh
        const savedUserStr = localStorage.getItem("gts_customer_user");
        let u = {
          id: "demo-user",
          email: "demo@gts.ng",
          role: "customer",
          full_name: "Demo Shopper",
          is_demo: true,
        };
        if (savedUserStr) {
          try {
            const parsed = JSON.parse(savedUserStr);
            if (parsed?.is_demo) u = { ...u, ...parsed };
          } catch {}
        }
        setUser(u as any);
        setCustomer({
          id: u.id,
          user_id: u.id,
          full_name: "Demo Shopper",
          email: u.email || "demo@gts.ng",
          phone: null,
        });
      } else {
        // Only clear if no valid session
        const oldUserId = user?.id || customer?.id;
        setUser(null);
        setCustomer(null);
        setSavedAddresses([]);
        localStorage.removeItem("gts_customer_user");
        localStorage.removeItem("gts_customer_token");
        clearCustomerNotifications(oldUserId);
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
          localStorage.setItem("gts_customer_user", JSON.stringify(data.user));
          localStorage.setItem("gts_customer_token", data.session.access_token);
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
    const oldUserId = user?.id || customer?.id;
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setCustomer(null);
    setSavedAddresses([]);
    localStorage.removeItem("gts_customer_user");
    localStorage.removeItem("gts_customer_token");
    localStorage.removeItem("gts_demo_mode");
    if (typeof document !== "undefined") {
      document.cookie = "gts_customer_token=; path=/; max-age=0";
      document.cookie = "gts_access_token=; path=/; max-age=0";
      document.cookie = "gts_demo_mode=; path=/; max-age=0";
    }
    clearCustomerNotifications(oldUserId);
    // The cached catalogue belonged to the signed-in data set (e.g. the demo store).
    try {
      sessionStorage.removeItem(CATALOGUE_CACHE_KEY);
      sessionStorage.removeItem("gts_catalogue_v1");
      localStorage.removeItem("gts_catalogue_v1");
    } catch {
      // storage blocked
    }
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
