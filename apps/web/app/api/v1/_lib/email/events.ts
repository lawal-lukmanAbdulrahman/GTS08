import { formatWAT } from "@gts/utils";
import { sendEmail, type SendResult } from "./send";
import { customerWelcomeEmail, passwordResetEmail, accountAccessEmail, ticketReceivedEmail, ticketReplyEmail, orderStatusEmail, flagUpdatedEmail, orderPaidEmail, passwordChangedEmail, posReceiptEmail, staffWelcomeEmail, type StoreInfo } from "./templates";

type Client = { from(table: string): any };

const dashboardUrl = () => (process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001").replace(/\/+$/, "");
const storefrontUrl = () => (process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3002").replace(/\/+$/, "");
const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

/** The shop's name, address and phone for the message header and footer; a plain "GTS" if settings can't be read. */
async function storeInfo(client: Client): Promise<StoreInfo> {
  try {
    type Row = { store_name?: string; store_address?: string | null; support_phone?: string | null; store_website?: string | null };
    const read = (columns: string) => client.from("settings").select(columns).eq("id", SETTINGS_ID).maybeSingle();
    const first = await read("store_name, store_address, support_phone, store_website");
    // Migration 00014 adds the website column; until then read the rest.
    const missing = first.error && /store_website/.test((first.error as { message?: string }).message ?? "");
    const row = (missing ? (await read("store_name, store_address, support_phone")).data : first.data) as Row | null;
    return { name: row?.store_name || "GTS", address: row?.store_address ?? null, phone: row?.support_phone ?? null, website: row?.store_website ?? null };
  } catch {
    return { name: "GTS" };
  }
}

/** Runs a notifier so that nothing it does can affect the action it belongs to. */
async function safely<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.error("[email] notification failed:", err instanceof Error ? err.message : "unknown error");
    return fallback;
  }
}

const FAILED: SendResult = { ok: false, reason: "Could not prepare the email." };

/** The welcome to a new staff account. The one-time password is included only when the admin chose to email it. */
export function notifyStaffWelcome(client: Client, o: { name: string; role: string; email: string; oneTimePassword?: string }): Promise<SendResult> {
  return safely(async () => {
    const store = await storeInfo(client);
    return sendEmail({ to: o.email, ...staffWelcomeEmail({ ...o, signInUrl: `${dashboardUrl()}/login`, store }) });
  }, FAILED);
}

/** The greeting after a customer registers. Sent once per address. */
export function notifyCustomerWelcome(client: Client, o: { name: string; email: string }): Promise<void> {
  return safely(async () => {
    const store = await storeInfo(client);
    await sendEmail({ to: o.email, ...customerWelcomeEmail({ store, name: o.name || "there", shopUrl: storefrontUrl() }), idempotencyKey: `welcome/${o.email.trim().toLowerCase()}` });
  }, undefined);
}

/** The reset link. No idempotency key: someone asking twice needs a fresh link, not the first one suppressed. */
export function notifyPasswordReset(client: Client, o: { name: string; email: string; resetUrl: string }): Promise<SendResult> {
  return safely(async () => {
    const store = await storeInfo(client);
    return sendEmail({ to: o.email, ...passwordResetEmail({ store, name: o.name || "there", resetUrl: o.resetUrl, validFor: "1 hour" }) });
  }, FAILED);
}

export function notifyPasswordChanged(client: Client, o: { name: string; email: string | null; account?: "staff" | "customer" }): Promise<void> {
  return safely(async () => {
    if (!o.email) return;
    const store = await storeInfo(client);
    await sendEmail({ to: o.email, ...passwordChangedEmail({ name: o.name || "there", whenText: formatWAT(new Date().toISOString()), signInUrl: o.account === "customer" ? storefrontUrl() : `${dashboardUrl()}/login`, store, account: o.account }) });
  }, undefined);
}

export function notifyPosReceipt(
  client: Client,
  o: { to: string; orderNumber: string; createdAt: string; items: Array<{ name: string; size?: string | null; color?: string | null; quantity: number; unitPrice: number; lineTotal: number }>; subtotal: number; discountAmount: number; total: number; paymentMethod: "cash" | "pos_terminal"; cashierName: string }
): Promise<void> {
  return safely(async () => {
    if (!o.to) return;
    const store = await storeInfo(client);
    await sendEmail({ to: o.to, ...posReceiptEmail({ store, orderNumber: o.orderNumber, dateText: formatWAT(o.createdAt), items: o.items, subtotal: o.subtotal, discountAmount: o.discountAmount, total: o.total, paymentMethod: o.paymentMethod, cashierName: o.cashierName }) });
  }, undefined);
}

/** After an online payment succeeds: the customer's confirmation. Walk-in and WhatsApp orders have no customer email and are skipped. */
export function notifyOrderPaid(client: Client, orderId: string): Promise<void> {
  return safely(async () => {
    const { data } = await client
      .from("orders")
      .select("order_number, total, customer:customers(email, full_name), items:order_items(quantity, line_total, product_snapshot)")
      .eq("id", orderId)
      .maybeSingle();
    const order = data as { order_number: string; total: number; customer: { email: string | null; full_name: string | null } | null; items: Array<{ quantity: number; line_total: number; product_snapshot: { name?: string } | null }> | null } | null;
    if (!order?.customer?.email) return;
    const store = await storeInfo(client);
    await sendEmail({
      to: order.customer.email,
      ...orderPaidEmail({
        store,
        name: order.customer.full_name || "there",
        orderNumber: order.order_number,
        items: (order.items ?? []).map((i) => ({ name: i.product_snapshot?.name || "Item", quantity: i.quantity, lineTotal: i.line_total })),
        total: order.total,
        trackUrl: `${storefrontUrl()}/track`,
      }),
      idempotencyKey: `order-paid/${orderId}`,
    });
  }, undefined);
}

/** Tells the customer about the steps they care about (confirmed, shipped, delivered, cancelled). Internal steps are skipped. */
export function notifyOrderStatus(client: Client, orderId: string, status: string): Promise<void> {
  return safely(async () => {
    const { data } = await client
      .from("orders")
      .select("order_number, paid_at, carrier_name, tracking_number, carrier_tracking_url, customer:customers(email, full_name)")
      .eq("id", orderId)
      .maybeSingle();
    const o = data as { order_number: string; paid_at: string | null; carrier_name: string | null; tracking_number: string | null; carrier_tracking_url: string | null; customer: { email: string | null; full_name: string | null } | null } | null;
    if (!o?.customer?.email) return;
    const store = await storeInfo(client);
    const mail = orderStatusEmail({ store, name: o.customer.full_name || "there", orderNumber: o.order_number, status, trackUrl: `${storefrontUrl()}/track`, carrierName: o.carrier_name, trackingNumber: o.tracking_number, trackingUrl: o.carrier_tracking_url, paid: !!o.paid_at });
    if (mail) await sendEmail({ to: o.customer.email, ...mail, idempotencyKey: `order-status/${orderId}/${status}` });
  }, undefined);
}

type TicketRow = { reference: string; subject: string; customer_email: string; customer_name: string | null };

async function loadTicket(client: Client, ticketId: string): Promise<TicketRow | null> {
  const { data } = await client.from("support_tickets").select("reference, subject, customer_email, customer_name").eq("id", ticketId).maybeSingle();
  return (data as TicketRow | null) ?? null;
}

/** The automatic acknowledgement when a customer opens a ticket. */
export function notifyTicketReceived(client: Client, ticketId: string): Promise<void> {
  return safely(async () => {
    const t = await loadTicket(client, ticketId);
    if (!t) return;
    await sendEmail({ to: t.customer_email, ...ticketReceivedEmail({ store: await storeInfo(client), name: t.customer_name ?? "", reference: t.reference, subject: t.subject }), idempotencyKey: `ticket-received/${ticketId}` });
  }, undefined);
}

/** A staff reply, sent to the customer who opened the ticket. */
export function notifyTicketReply(client: Client, ticketId: string, reply: string): Promise<void> {
  return safely(async () => {
    const t = await loadTicket(client, ticketId);
    if (!t) return;
    await sendEmail({ to: t.customer_email, ...ticketReplyEmail({ store: await storeInfo(client), name: t.customer_name ?? "", reference: t.reference, subject: t.subject, reply }) });
  }, undefined);
}

export function notifyFlagUpdated(client: Client, flagId: string, status: string, note: string | null): Promise<void> {
  return safely(async () => {
    const { data } = await client
      .from("product_flags")
      .select("raiser:users!product_flags_raised_by_fkey(email, full_name), product:products(name)")
      .eq("id", flagId)
      .maybeSingle();
    const row = data as { raiser: { email: string | null; full_name: string | null } | null; product: { name: string } | null } | null;
    if (!row?.raiser?.email) return;
    const store = await storeInfo(client);
    await sendEmail({ to: row.raiser.email, ...flagUpdatedEmail({ store, name: row.raiser.full_name || "there", productName: row.product?.name || "a product", status, note }) });
  }, undefined);
}

export function notifyAccessChanged(client: Client, userId: string, blocked: boolean): Promise<void> {
  return safely(async () => {
    const { data } = await client.from("users").select("email, full_name").eq("id", userId).maybeSingle();
    const user = data as { email: string | null; full_name: string | null } | null;
    if (!user?.email) return;
    const store = await storeInfo(client);
    await sendEmail({ to: user.email, ...accountAccessEmail({ store, name: user.full_name || "there", blocked, signInUrl: blocked ? undefined : `${dashboardUrl()}/login` }) });
  }, undefined);
}
