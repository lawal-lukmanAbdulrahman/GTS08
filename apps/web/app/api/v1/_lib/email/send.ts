export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult = { ok: true; id: string | null } | { ok: false; skipped?: boolean; reason: string };

// One address, no display names or lists: a recipient can never be turned into several by a crafted value.
const SINGLE_ADDRESS = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']{2,}$/;

/**
 * Sends one email through Resend's REST API. It never throws and never fails
 * the action it accompanies: a missing configuration is a quiet skip, and a
 * refusal or outage is reported in the result for the caller to ignore or show.
 * Logs never include the API key or the message content.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) return { ok: false, skipped: true, reason: "Email is not configured." };

  const to = message.to?.trim();
  if (!to || !SINGLE_ADDRESS.test(to)) return { ok: false, reason: "Invalid recipient address." };

  try {
    const replyTo = process.env.EMAIL_REPLY_TO?.trim();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: message.subject, html: message.html, text: message.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[email] Resend refused a message (HTTP ${res.status}).`);
      return { ok: false, reason: `Resend answered ${res.status}.` };
    }
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: body?.id ?? null };
  } catch {
    console.error("[email] Could not reach Resend.");
    return { ok: false, reason: "Could not reach the email service." };
  }
}
