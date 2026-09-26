import { API_BASE } from "./api-base";
import { authFetch } from "./session";

const URL = `${API_BASE}/settings/data-mode`;
const UNREACHABLE = "Couldn't reach the server. Check your connection and try again.";

export type DataMode = "test" | "live";
export type LoadModeResult = { ok: true; mode: DataMode | null; ready: boolean } | { ok: false; message: string };
export type SwitchModeResult = { ok: true; mode: DataMode } | { ok: false; message: string };

/** Which data the shop is showing. `ready` is false until the database has the test/live migration. */
export async function loadDataMode(): Promise<LoadModeResult> {
  try {
    const res = await authFetch(URL);
    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.error || "Couldn't load the data mode." };
    return { ok: true, mode: body.data.mode as DataMode | null, ready: body.data.ready === true };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

/** Switches between test and live data (super admin only). */
export async function switchDataMode(mode: DataMode): Promise<SwitchModeResult> {
  try {
    const res = await authFetch(URL, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, confirm: true }) });
    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.error || "Couldn't switch the data mode." };
    return { ok: true, mode: body.data.mode as DataMode };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}
