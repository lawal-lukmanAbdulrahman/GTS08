import { API_BASE, getToken, signOut } from "./session";

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T; meta?: PageMeta }
  | { ok: false; status: number; message: string; code?: string; details?: Record<string, string> };

interface CallInit {
  method?: string;
  json?: unknown;
}

const UNREACHABLE = "Couldn't reach the server. Check your connection and try again.";

/**
 * The one way staff screens talk to the API. It adds the bearer token and
 * turns the two "you can't be here" answers into a sign-out: 401 (session
 * expired) and 403 ACCOUNT_BLOCKED (an admin suspended the account mid-shift,
 * employee spec Part 9.5). Every other failure, including ordinary permission
 * refusals and a wrong current password, is returned for the screen to show.
 */
export async function apiCall<T = unknown>(path: string, init: CallInit = {}): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.json !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
    });
  } catch {
    return { ok: false, status: 0, message: UNREACHABLE };
  }

  let body: ({ data?: unknown; meta?: PageMeta; error?: string; code?: string; details?: Record<string, string> }) | null = null;
  try {
    body = await res.json();
  } catch {
    // not JSON (e.g. a proxy error page)
  }

  if (res.ok) return { ok: true, status: res.status, data: (body?.data ?? body) as T, meta: body?.meta };

  if (res.status === 401) void signOut({ reason: "expired", revoke: false });
  else if (res.status === 403 && body?.code === "ACCOUNT_BLOCKED") void signOut({ reason: "blocked", revoke: false });

  return {
    ok: false,
    status: res.status,
    message: body?.error || `Request failed (${res.status}).`,
    code: body?.code,
    details: body?.details,
  };
}
