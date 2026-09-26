import { API_BASE } from "./api-base";
import { authFetch } from "./session";

const URL = `${API_BASE}/settings/email`;
const UNREACHABLE = "Couldn't reach the server. Check your connection and try again.";

export type EmailStatusResult = { ok: true; configured: boolean; from: string | null; missing: string[] } | { ok: false; message: string };
export type TestEmailResult = { ok: true; to: string } | { ok: false; message: string };

export async function loadEmailStatus(): Promise<EmailStatusResult> {
  try {
    const res = await authFetch(URL);
    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.error || "Couldn't check the email setup." };
    return { ok: true, ...body.data };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

/** Sends a test message to the signed-in admin's own address. */
export async function sendTestEmail(): Promise<TestEmailResult> {
  try {
    const res = await authFetch(URL, { method: "POST" });
    const body = await res.json();
    if (!res.ok) return { ok: false, message: body.error || "The test email couldn't be sent." };
    return { ok: true, to: body.data.to };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}
