import { API_BASE } from "./api-base";
import type { ReceiptStore } from "../pos/receipt";
import type { SaveResult, StoreDetails } from "../admin/settings/store-settings-form";

// Same convention as the rest of the dashboard: the web app hosts the API.
const SETTINGS_URL = `${API_BASE}/settings`;
const UNREACHABLE = "Couldn't reach the server. Check your connection and try again.";

export type LoadResult = { ok: true; data: StoreDetails } | { ok: false; message: string };

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loadStoreDetails(): Promise<LoadResult> {
  try {
    const res = await fetch(SETTINGS_URL);
    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.error || "Couldn't load store details." };
    return { ok: true, data: body.data as StoreDetails };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

export async function saveStoreDetails(values: StoreDetails): Promise<SaveResult> {
  try {
    const res = await fetch(SETTINGS_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(values),
    });
    const body = await res.json();
    if (res.ok) return { ok: true, saved: body.data as StoreDetails };
    if (res.status === 401) return { ok: false, message: "Your session has expired. Please sign in again." };
    return {
      ok: false,
      message: body.error || "Couldn't save store details.",
      fieldErrors: body.details,
    };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

/** The receipt header for these settings; a bare "GTS" if they couldn't be loaded. */
export function toReceiptStore(details: StoreDetails | null): ReceiptStore {
  if (!details) return { name: "GTS" };
  return {
    name: details.store_name,
    address: details.store_address ?? undefined,
    phone: details.support_phone ?? undefined,
  };
}
