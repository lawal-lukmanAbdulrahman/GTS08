import { API_BASE } from "./api-base";
import { authFetch } from "./session";

const URL = `${API_BASE}/settings/data-mode`;
const UNREACHABLE = "Couldn't reach the server. Check your connection and try again.";

/** "test" for the demo account (it sees the demo data), "live" for everyone else. */
export type DataMode = "test" | "live";
export type LoadModeResult = { ok: true; mode: DataMode } | { ok: false; message: string };

export async function loadDataMode(): Promise<LoadModeResult> {
  try {
    const res = await authFetch(URL);
    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.error || "Couldn't load which data you're seeing." };
    return { ok: true, mode: body.data.mode === "test" ? "test" : "live" };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}
