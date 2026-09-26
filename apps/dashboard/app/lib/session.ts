import { API_BASE } from "./api-base";

export { API_BASE };

const TOKEN_KEY = "gts_token";
const USER_KEY = "gts_user";
const COOKIES = ["gts_access_token", "gts_user_role"];

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_super_admin?: boolean;
}

export function getToken(): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** {Authorization} for the signed-in staff member, or nothing when signed out. Spread into a headers object. */
export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** fetch that adds the staff bearer token (never overriding an Authorization header the caller set). */
export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export function getSessionUser(): SessionUser | null {
  try {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

/**
 * Removes everything that says "signed in". The cookies matter as much as the
 * storage: middleware bounces /login back into the app while gts_access_token
 * exists, so leaving it behind makes sign-out look like it did nothing.
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // storage blocked: nothing to clear
  }
  try {
    // Parked sales belong to the person who parked them, not to whoever uses this till next.
    for (const key of Object.keys(localStorage)) if (key.startsWith("gts_held_sales:")) localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing was kept
  }
  for (const name of COOKIES) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export type SignOutReason = "blocked" | "expired" | "idle";

/**
 * Ends the session. Revokes it on the server when we still hold a valid one,
 * but never lets a failed network call leave the till signed in: the local
 * session is always cleared and the user is always sent to /login.
 */
export async function signOut(
  opts: { reason?: SignOutReason; revoke?: boolean; navigate?: (url: string) => void } = {}
): Promise<void> {
  const { reason, revoke = true, navigate = (url) => window.location.assign(url) } = opts;

  if (revoke) {
    const token = getToken();
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // offline: still sign out locally
    }
  }

  clearSession();
  navigate(reason ? `/login?reason=${reason}` : "/login");
}

/** Sends someone who must replace their one-time password to the screen where they do it. */
export function goToPasswordChange(navigate: (url: string) => void = (url) => window.location.assign(url)): void {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/profile")) return; // already there
  navigate("/profile");
}

/** What the login page tells someone who was sent back to it. */
export function signOutMessage(reason: string | null): string | null {
  switch (reason) {
    case "blocked":
      return "Your account access has been suspended. Please contact an administrator.";
    case "expired":
      return "Your session has expired. Please sign in again.";
    case "idle":
      return "You were signed out after a period of inactivity.";
    default:
      return null;
  }
}

export type ReauthResult = { ok: true } | { ok: false; message: string };

/**
 * Unlocks an idle till: proves the signed-in person still knows their password
 * by logging in again, and swaps in the fresh session. The page (and the cart
 * on it) stays mounted the whole time, so nothing is lost.
 */
export async function reauthenticate(email: string, password: string): Promise<ReauthResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }

  if (res.status === 403) {
    return { ok: false, message: "This account has been suspended. Please contact an administrator." };
  }
  if (!res.ok) return { ok: false, message: "That password isn't right. Try again." };

  const body = await res.json();
  const token = body?.data?.session?.access_token;
  if (token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // storage blocked: the old token stays in memory-less state; the page still works until reload
    }
    document.cookie = `gts_access_token=${token}; path=/; max-age=604800; SameSite=Lax`;
  }
  return { ok: true };
}
