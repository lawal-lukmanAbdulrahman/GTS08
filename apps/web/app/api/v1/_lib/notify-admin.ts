type Client = { from(table: string): any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type AdminNotificationType = "low_stock" | "new_ticket" | "new_order" | "payment_failed" | "new_return_request";

/**
 * Adds something to the admin bell. It skips a notification that repeats an
 * unread one about the same thing (same type and link), so a busy till can't
 * fill the bell, and it never throws: raising a notice must not fail the
 * sale, payment or ticket it is about.
 */
export async function createAdminNotification(client: Client, n: { type: AdminNotificationType; title: string; message: string; link: string | null }): Promise<void> {
  try {
    if (n.link) {
      const { data } = await client.from("admin_notifications").select("id").eq("type", n.type).eq("link", n.link).eq("is_read", false).limit(1);
      if (Array.isArray(data) && data.length > 0) return;
    }
    const { error } = await client.from("admin_notifications").insert({ type: n.type, title: n.title.slice(0, 200), message: n.message, link: n.link ? n.link.slice(0, 500) : null });
    if (error) console.error("[notify-admin] insert failed:", error.message);
  } catch (err) {
    console.error("[notify-admin] failed:", err);
  }
}
