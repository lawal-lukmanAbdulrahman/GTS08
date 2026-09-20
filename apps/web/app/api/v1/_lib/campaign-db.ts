export const CAMPAIGN_COLUMNS = "id, subject, preview_text, body_html, cta_label, cta_link, audience_type, audience_params, recipient_count, status, scheduled_at, sent_at, created_at";

/** The send result is kept inside audience_params.result; hand it back as its own field. */
export function withResult<T extends { audience_params?: unknown }>(row: T) {
  const params = (row.audience_params ?? null) as { result?: { sent: number; failed: number } } | null;
  return { ...row, result: params?.result ?? null };
}
