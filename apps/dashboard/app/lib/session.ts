export const API_BASE = "http://localhost:3000/api/v1";

const TOKEN_KEY = "gts_token";
const USER_KEY = "gts_user";
const COOKIES = ["gts_access_token", "gts_user_role"];

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export function getToken(): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
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
