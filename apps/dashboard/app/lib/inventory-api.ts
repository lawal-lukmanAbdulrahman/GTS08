import { idempotentFetch } from "@gts/utils";
import { API_BASE, getToken } from "./session";

export type PutInventoryResult = { ok: true } | { ok: false; message: string };

/**
 * Adjusts one variant's stock or low-stock threshold. Unlike a fire-and-forget
 * fetch, it reports whether the server accepted the change, so the screen only
 * shows new numbers that are real.
 */
export async function putInventory(variantId: string, body: Record<string, unknown>): Promise<PutInventoryResult> {
  const token = getToken();
  try {
    const res = await idempotentFetch(`${API_BASE}/inventory/${encodeURIComponent(variantId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, message: "Your session has expired. Please sign in again." };
    let message = `Couldn't update stock (${res.status}).`;
    try {
      const json = await res.json();
      if (typeof json?.error === "string") message = json.error;
    } catch {
      // not JSON
    }
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}
