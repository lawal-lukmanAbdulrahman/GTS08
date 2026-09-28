"use client";

import { useEffect, useState } from "react";

/** The store details the admin keeps in Store Details (GET /api/v1/settings), for the footer and checkout. */
export interface StoreInfo {
  store_name: string;
  store_address: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  support_email: string | null;
  store_website?: string | null;
  pickup_hold_hours?: number;
  footer_about?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
}

let pending: Promise<StoreInfo | null> | null = null;

/** One request per page load, shared by every component that needs the details. */
function fetchStoreInfo(): Promise<StoreInfo | null> {
  pending ??= fetch("/api/v1/settings")
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => (b?.data as StoreInfo | undefined) ?? null)
    .catch(() => null);
  return pending;
}

export function resetStoreInfoCache(): void {
  pending = null;
}

export function useStoreInfo(): StoreInfo | null {
  const [info, setInfo] = useState<StoreInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchStoreInfo().then((i) => {
      if (!cancelled) setInfo(i);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}

/** A wa.me link for a Nigerian number as typed (0814..., +234 814..., 234814...), or null. */
export function whatsappLink(number: string | null | undefined): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  const international = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}
