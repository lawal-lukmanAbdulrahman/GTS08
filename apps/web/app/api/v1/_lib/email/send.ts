export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra message headers, e.g. List-Unsubscribe on bulk mail. */
  headers?: Record<string, string>;
  /** Resend refuses a second message with the same key for 24 hours, so a retried event can't email twice. */
  idempotencyKey?: string;
}

export type SendResult = { ok: true; id: string | null } | { ok: false; skipped?: boolean; reason: string };

// One address, no display names or lists: a recipient can never be turned into several by a crafted value.
const SINGLE_ADDRESS = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']{2,}$/;

const RESEND = "https://api.resend.com";
const BATCH_SIZE = 100; // Resend's limit per batch request
const RETRY_DELAY_MS = 400;
const MAX_RETRY_WAIT_MS = 3000;

function config(): { key: string; from: string; replyTo?: string } | null {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) return null;
  return { key, from, replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined };
}

function payload(message: EmailMessage, from: string, replyTo?: string) {
  return { from, to: [message.to.trim()], subject: message.subject, html: message.html, text: message.text, ...(replyTo ? { reply_to: replyTo } : {}), ...(message.headers ? { headers: message.headers } : {}) };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A rate limit or a server hiccup is worth one more try; a refusal of the message itself never is. */
const retryable = (status: number) => status === 429 || status >= 500;

function retryWait(res: Response): number {
  const seconds = Number(res.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds >= 0 && res.headers.has("retry-after") ? Math.min(seconds * 1000, MAX_RETRY_WAIT_MS) : RETRY_DELAY_MS;
}

/** What Resend said went wrong ("The gts.ng domain is not verified"), so a bad sender is diagnosable. Never the message content. */
async function explain(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  const detail = typeof body?.message === "string" ? body.message.slice(0, 200) : "";
  return detail ? `Resend answered ${res.status}: ${detail}` : `Resend answered ${res.status}.`;
}

/** One POST to Resend with a single retry. Returns the final response, or null if it could not be reached. */
async function post(path: string, key: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${RESEND}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok || !retryable(res.status) || attempt === 1) return res;
      await sleep(retryWait(res));
    } catch {
      if (attempt === 1) return null;
      await sleep(RETRY_DELAY_MS);
    }
  }
  return null;
}

/**
 * Sends one email through Resend's REST API. It never throws and never fails
 * the action it accompanies: a missing configuration is a quiet skip, and a
 * refusal or outage is reported in the result for the caller to ignore or show.
 * Logs never include the API key or the message content.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const cfg = config();
  if (!cfg) return { ok: false, skipped: true, reason: "Email is not configured." };

  const to = message.to?.trim();
  if (!to || !SINGLE_ADDRESS.test(to)) return { ok: false, reason: "Invalid recipient address." };

  const res = await post("/emails", cfg.key, payload(message, cfg.from, cfg.replyTo), message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {});
  if (!res) {
    console.error("[email] Could not reach Resend.");
    return { ok: false, reason: "Could not reach the email service." };
  }
  if (!res.ok) {
    const reason = await explain(res);
    console.error(`[email] Resend refused a message (HTTP ${res.status}).`);
    return { ok: false, reason };
  }
  const body = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, id: body?.id ?? null };
}

/**
 * Sends many messages, up to 100 per request, so a campaign stays inside Resend's
 * rate limit. A refused group counts as failed and the rest carry on. Invalid
 * addresses are dropped up front and counted as failed.
 */
export async function sendEmailBatch(messages: EmailMessage[]): Promise<{ sent: number; failed: number; skipped?: true }> {
  const cfg = config();
  if (!cfg) return { sent: 0, failed: messages.length, skipped: true };

  const valid = messages.filter((m) => m.to && SINGLE_ADDRESS.test(m.to.trim()));
  let sent = 0;
  let failed = messages.length - valid.length;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const group = valid.slice(i, i + BATCH_SIZE);
    const res = await post("/emails/batch", cfg.key, group.map((m) => payload(m, cfg.from, cfg.replyTo)));
    if (res?.ok) {
      const body = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
      const accepted = Array.isArray(body?.data) ? body.data.length : group.length;
      sent += accepted;
      failed += group.length - accepted;
    } else {
      failed += group.length;
      console.error(res ? `[email] Resend refused a batch (HTTP ${res.status}).` : "[email] Could not reach Resend for a batch.");
    }
  }
  return { sent, failed };
}
