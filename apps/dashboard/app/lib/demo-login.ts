import { API_BASE } from "./api-base";

export interface SignedIn {
  session: { access_token: string; refresh_token?: string; expires_at?: number };
  user: { id: string; email: string | null; role: string; full_name?: string | null; is_demo?: boolean };
  permissions: unknown;
}

/** Saves a session the way every sign-in does, and returns the screen for the person's role. */
export function storeSignIn(data: SignedIn): string {
  const week = 604800;
  document.cookie = `gts_access_token=${data.session.access_token}; path=/; max-age=${week}; SameSite=Lax`;
  document.cookie = `gts_user_role=${data.user.role}; path=/; max-age=${week}; SameSite=Lax`;
  localStorage.setItem("gts_user", JSON.stringify(data.user));
  localStorage.setItem("gts_token", data.session.access_token);
  return data.user.role === "cashier" ? "/pos" : data.user.role === "inventory_staff" ? "/inventory" : data.user.role === "admin" ? "/admin" : "/pending";
}

/** Whether the server offers the one-click demo (DEMO_LOGIN_ENABLED). */
export async function demoLoginAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/demo-login`, { cache: "no-store" });
    const body = await res.json();
    return res.ok && body?.data?.enabled === true;
  } catch {
    return false;
  }
}

/** Signs into the demo account (demo data only) with no password. */
export async function signInToDemo(): Promise<{ ok: true; home: string } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/demo-login`, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.data?.session) return { ok: false, message: body?.error || "The demo couldn't be opened. Please try again." };
    return { ok: true, home: storeSignIn(body.data as SignedIn) };
  } catch {
    return { ok: false, message: "Unable to connect to the GTS server. Please check your network connection and try again." };
  }
}
