import { esc } from "./email/html";
import { campaignEmail, type StoreInfo } from "./email/templates";
import { sendEmailBatch } from "./email/send";
import { isPlainObject, oneLine, textField } from "./validate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { from(table: string): any };

export const AUDIENCES = ["all", "ordered_last_30", "never_ordered", "opted_in_only", "custom"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const MAX_RECIPIENTS = 2000;
const MAX_BODY = 20_000;
const EMAIL = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']{2,}$/;
const LINK = /^https:\/\/[^\s]+$/i;

/** The admin writes plain text; it's escaped and split into paragraphs here, so no markup or script can be sent to customers. */
export function bodyToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export interface CampaignInput {
  subject?: string;
  preview_text?: string | null;
  body_html?: string;
  cta_label?: string | null;
  cta_link?: string | null;
  audience_type?: Audience;
  audience_params?: { emails: string[] } | null;
}

export function validateCampaign(input: unknown, mode: "create" | "update"): { ok: true; value: CampaignInput } | { ok: false; errors: Record<string, string> } {
  if (!isPlainObject(input)) return { ok: false, errors: { _body: "Expected a JSON object." } };
  const value: CampaignInput = {};
  const errors: Record<string, string> = {};

  if ("subject" in input || mode === "create") {
    const r = textField(input.subject, "Subject", { max: 255, required: true });
    if ("error" in r) errors.subject = r.error;
    else value.subject = r.value!;
  }
  if ("preview_text" in input) {
    const r = textField(input.preview_text, "Preview text", { max: 90 });
    if ("error" in r) errors.preview_text = r.error;
    else value.preview_text = r.value;
  }
  if ("body" in input || mode === "create") {
    const b = typeof input.body === "string" ? input.body.trim() : "";
    if (!b) errors.body = "Write the message.";
    else if (b.length > MAX_BODY) errors.body = `Keep the message under ${MAX_BODY.toLocaleString()} characters.`;
    else value.body_html = bodyToHtml(b);
  }
  if ("cta_label" in input) {
    const r = textField(input.cta_label, "Button text", { max: 100 });
    if ("error" in r) errors.cta_label = r.error;
    else value.cta_label = r.value;
  }
  if ("cta_link" in input) {
    if (input.cta_link === null || input.cta_link === "") value.cta_link = null;
    else if (typeof input.cta_link !== "string" || input.cta_link.length > 500 || !LINK.test(input.cta_link.trim())) errors.cta_link = "Use a secure https address.";
    else value.cta_link = input.cta_link.trim();
  }
  if (value.cta_label && !("cta_link" in input)) errors.cta_link = "A button needs a link.";
  if (value.cta_link && !value.cta_label && "cta_label" in input) errors.cta_label = "A button needs text.";

  if ("audience_type" in input || mode === "create") {
    if (!(AUDIENCES as readonly unknown[]).includes(input.audience_type)) errors.audience_type = `Choose one of: ${AUDIENCES.join(", ")}.`;
    else if (input.audience_type === "opted_in_only") errors.audience_type = "Opt-in tracking isn't set up yet, so this audience can't be used.";
    else value.audience_type = input.audience_type as Audience;
  }
  if (value.audience_type === "custom" || "audience_params" in input) {
    const emails = isPlainObject(input.audience_params) ? input.audience_params.emails : undefined;
    if (value.audience_type === "custom") {
      const clean = Array.isArray(emails) ? emails.map((e) => (typeof e === "string" ? oneLine(e).toLowerCase() : "")) : [];
      if (clean.length < 1 || clean.length > MAX_RECIPIENTS || clean.some((e) => !EMAIL.test(e))) errors.audience_params = `Give 1 to ${MAX_RECIPIENTS} valid email addresses.`;
      else value.audience_params = { emails: [...new Set(clean)] };
    } else if (input.audience_params === null) value.audience_params = null;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0) return { ok: false, errors: { _body: "Nothing to update." } };
  return { ok: true, value };
}

/** The addresses an audience means, lower-cased, de-duplicated and capped, without anyone who opted out of marketing. Throws on a database error. */
export async function resolveAudience(client: Client, type: Audience, params: { emails?: string[] } | null): Promise<string[]> {
  if (type === "opted_in_only") return [];

  const optedOut = new Set<string>();
  const { data: outRows, error: outError } = await client.from("users").select("email").eq("email_marketing_opt_out", true).limit(50_000);
  if (outError) throw new Error(outError.message);
  for (const r of (outRows ?? []) as Array<{ email?: string | null }>) if (r.email) optedOut.add(r.email.trim().toLowerCase());

  const clean = (rows: Array<{ email?: string | null }>) => {
    const seen = new Set<string>();
    for (const r of rows) {
      const e = (r.email ?? "").trim().toLowerCase();
      if (EMAIL.test(e) && !optedOut.has(e)) seen.add(e);
      if (seen.size >= MAX_RECIPIENTS) break;
    }
    return [...seen];
  };
  if (type === "custom") return clean((params?.emails ?? []).map((email) => ({ email })));

  const { data: customers, error } = await client.from("customers").select("id, email").limit(20_000);
  if (error) throw new Error(error.message);
  const rows = (customers ?? []) as Array<{ id?: string; email: string }>;
  if (type === "all") return clean(rows);

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const query = client.from("orders").select("customer_id").in("status", ["paid", "confirmed", "processing", "shipped", "delivered", "completed"]);
  const { data: orders, error: orderError } = await (type === "ordered_last_30" ? query.gte("created_at", since) : query).limit(50_000);
  if (orderError) throw new Error(orderError.message);
  const buyers = new Set(((orders ?? []) as Array<{ customer_id: string | null }>).map((o) => o.customer_id));
  return clean(rows.filter((c) => (type === "ordered_last_30" ? buyers.has(c.id ?? "") : !buyers.has(c.id ?? ""))));
}

interface CampaignRow {
  id: string;
  subject: string;
  preview_text: string | null;
  body_html: string | null;
  cta_label: string | null;
  cta_link: string | null;
  audience_type: Audience;
  audience_params: { emails?: string[] } | null;
  status: string;
}

/**
 * Sends a draft or due campaign. It is claimed first (draft/scheduled -> sending)
 * so two triggers can't both send it; each recipient's result is counted, one
 * failure never stops the rest, and the campaign always ends as sent or failed
 * rather than stuck "sending". Returns null if someone else had claimed it.
 */
export async function sendCampaign(client: Client, campaign: CampaignRow): Promise<{ sent: number; failed: number } | null> {
  const { data: claimed } = await client.from("email_campaigns").update({ status: "sending" }).eq("id", campaign.id).in("status", ["draft", "scheduled"]).select("id");
  if (!Array.isArray(claimed) || claimed.length !== 1) return null;

  let sent = 0;
  let failed = 0;
  try {
    const recipients = await resolveAudience(client, campaign.audience_type, campaign.audience_params);
    const { data: s } = await client.from("settings").select("store_name, store_address, support_phone").eq("id", "00000000-0000-0000-0000-000000000001").maybeSingle();
    const store: StoreInfo = { name: (s as { store_name?: string } | null)?.store_name || "GTS", address: (s as { store_address?: string | null } | null)?.store_address ?? null, phone: (s as { support_phone?: string | null } | null)?.support_phone ?? null };
    const unsubscribe = process.env.EMAIL_REPLY_TO?.trim() || process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] || process.env.EMAIL_FROM?.trim() || "support@gts.ng";
    const mail = campaignEmail({ store, subject: campaign.subject, preview: campaign.preview_text, bodyHtml: campaign.body_html ?? "", ctaLabel: campaign.cta_label, ctaUrl: campaign.cta_link, unsubscribeEmail: unsubscribe });

    const headers = { "List-Unsubscribe": `<mailto:${unsubscribe}?subject=Unsubscribe>` };
    ({ sent, failed } = await sendEmailBatch(recipients.map((to) => ({ to, ...mail, headers }))));
  } catch (err) {
    console.error("[campaigns] could not build the audience:", err);
  }

  await client
    .from("email_campaigns")
    .update({ status: sent > 0 ? "sent" : "failed", recipient_count: sent, sent_at: new Date().toISOString(), audience_params: { ...(campaign.audience_params ?? {}), result: { sent, failed } } })
    .eq("id", campaign.id);
  return { sent, failed };
}
