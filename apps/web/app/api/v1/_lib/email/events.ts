import { formatWAT, getOrderPickupPin } from "@gts/utils";
import { sendEmail, type SendResult } from "./send";
import { pickupOrderEmail, customerWelcomeEmail, passwordResetEmail, accountAccessEmail, ticketReceivedEmail, ticketReplyEmail, orderStatusEmail, flagUpdatedEmail, orderPaidEmail, passwordChangedEmail, posReceiptEmail, staffWelcomeEmail, type StoreInfo } from "./templates";

type Client = { from(table: string): any; channel?: (name: string, ...args: any[]) => any };

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
      .select("id, order_number, total, tracking_number, customer:customers(email, full_name), items:order_items(quantity, line_total, product_snapshot)")
      .eq("id", orderId)
      .maybeSingle();
    const order = data as { id?: string; order_number: string; total: number; tracking_number?: string | null; customer: { email: string | null; full_name: string | null } | null; items: Array<{ quantity: number; line_total: number; product_snapshot: { name?: string } | null }> | null } | null;
    if (!order?.customer?.email) return;
    const store = await storeInfo(client);
    const pickupPin = getOrderPickupPin({ id: order.id || orderId, order_number: order.order_number, tracking_number: order.tracking_number });
    await sendEmail({
      to: order.customer.email,
      ...orderPaidEmail({
        store,
        name: order.customer.full_name || "there",
        orderNumber: order.order_number,
        items: (order.items ?? []).map((i) => ({ name: i.product_snapshot?.name || "Item", quantity: i.quantity, lineTotal: i.line_total })),
        total: order.total,
        trackUrl: `${storefrontUrl()}/track`,
        pickupPin,
      }),
      idempotencyKey: `order-paid/${orderId}`,
    });
  }, undefined);
}

/** A pay-on-pickup order was placed: where, what to pay and by when. Sent once per order. */
export function notifyPickupOrder(client: Client, orderId: string, customKey?: string): Promise<void> {
  return safely(async () => {
    let order: any = null;
    let orderRes = await client
      .from("orders")
      .select("id, order_number, total, tracking_number, pickup_pin, pickup_deadline, customer_id, customer:customers(id, email, full_name, user_id), items:order_items(quantity, line_total, product_snapshot), pickup_station_id, pickup_station:pickup_stations(name, address_line1, address_line2, city, state, phone, operating_hours)")
      .eq("id", orderId)
      .maybeSingle();

    if (orderRes.error && /pickup_pin/i.test(orderRes.error.message)) {
      orderRes = await client
        .from("orders")
        .select("id, order_number, total, tracking_number, pickup_deadline, customer_id, customer:customers(id, email, full_name, user_id), items:order_items(quantity, line_total, product_snapshot), pickup_station_id, pickup_station:pickup_stations(name, address_line1, address_line2, city, state, phone, operating_hours)")
        .eq("id", orderId)
        .maybeSingle();
      if (orderRes.data) {
        (orderRes.data as any).pickup_pin = (orderRes.data as any).tracking_number;
      }
    }
    order = orderRes.data;
    if (!order) return;

    let customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
    if ((!customer || !customer.email) && order.customer_id) {
      try {
        const { data: cust } = await client
          .from("customers")
          .select("id, email, full_name, user_id")
          .eq("id", order.customer_id)
          .maybeSingle();
        if (cust) customer = cust;
      } catch {}
    }

    const customerEmail = customer?.email?.trim();
    if (!customerEmail) return;
    const customerName = customer?.full_name?.trim() || "there";

    const store = await storeInfo(client);

    let pickupAddress = store.address ?? null;
    let station = Array.isArray(order.pickup_station) ? order.pickup_station[0] : order.pickup_station;
    if (!station && order.pickup_station_id) {
      try {
        const { data: st } = await client
          .from("pickup_stations")
          .select("name, address_line1, address_line2, city, state, phone, operating_hours")
          .eq("id", order.pickup_station_id)
          .maybeSingle();
        if (st) station = st;
      } catch {}
    }
    if (!station?.address_line1) {
      try {
        const { data: defaultStation } = await client
          .from("pickup_stations")
          .select("name, address_line1, address_line2, city, state, phone, operating_hours")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (defaultStation) station = defaultStation;
      } catch {}
    }

    if (station?.address_line1) {
      pickupAddress = [station.name, station.address_line1, station.address_line2, station.city, station.state].filter(Boolean).join(", ");
    } else if (!pickupAddress) {
      pickupAddress = store.name ? `${store.name} Main Store Collection Desk` : "Main Store Collection Desk";
    }

    const rawPin = order.pickup_pin || order.tracking_number;
    const pickupPin = getOrderPickupPin({ id: order.id || orderId, order_number: order.order_number, pickup_pin: rawPin, tracking_number: rawPin });

    if (order.tracking_number !== pickupPin || (order.pickup_pin && order.pickup_pin !== pickupPin)) {
      try {
        const { error: pinUpdateErr } = await client
          .from("orders")
          .update({ tracking_number: pickupPin, pickup_pin: pickupPin })
          .eq("id", orderId);
        if (pinUpdateErr && /pickup_pin/i.test(pinUpdateErr.message)) {
          await client
            .from("orders")
            .update({ tracking_number: pickupPin })
            .eq("id", orderId);
        }
      } catch {}
    }

    await sendEmail({
      to: customerEmail,
      ...pickupOrderEmail({
        store,
        name: customerName,
        orderNumber: order.order_number,
        items: (order.items ?? []).map((i: any) => ({ name: i.product_snapshot?.name || "Item", size: i.product_snapshot?.size ?? null, color: i.product_snapshot?.color ?? null, quantity: i.quantity, lineTotal: i.line_total })),
        total: order.total,
        address: pickupAddress,
        deadlineText: order.pickup_deadline
          ? formatWAT(order.pickup_deadline)
          : "Collection window will activate as soon as your order is packaged and marked ready for pickup.",
        trackUrl: `${storefrontUrl()}/track?order_number=${encodeURIComponent(order.order_number)}&email=${encodeURIComponent(customerEmail)}`,
        pickupPin,
      }),
      idempotencyKey: customKey || `pickup-order/${orderId}`,
    });
  }, undefined);
}

/** Centralized hook point for order status change notifications. */
export function onOrderStatusChanged(
  client: Client,
  orderId: string,
  toStatus: string,
  reason?: string
): Promise<void> {
  return notifyOrderStatus(client, orderId, toStatus, reason);
}

/** Tells the customer about the pickup status steps (confirmed, ready_for_pickup, collected, cancelled, expired, on_hold). */
export function notifyOrderStatus(client: Client, orderId: string, status: string, reason?: string, customKey?: string): Promise<void> {
  return safely(async () => {
    let o: any = null;
    let oRes = await client
      .from("orders")
      .select(
        "id, order_number, total, payment_status, paid_at, tracking_number, pickup_pin, pickup_deadline, ready_for_pickup_at, customer_id, customer:customers(id, email, full_name, user_id), pickup_station_id, pickup_station:pickup_stations(name, address_line1, address_line2, city, state, phone, operating_hours)"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (oRes.error && /pickup_pin/i.test(oRes.error.message)) {
      oRes = await client
        .from("orders")
        .select(
          "id, order_number, total, payment_status, paid_at, tracking_number, pickup_deadline, ready_for_pickup_at, customer_id, customer:customers(id, email, full_name, user_id), pickup_station_id, pickup_station:pickup_stations(name, address_line1, address_line2, city, state, phone, operating_hours)"
        )
        .eq("id", orderId)
        .maybeSingle();
      if (oRes.data) {
        (oRes.data as any).pickup_pin = (oRes.data as any).tracking_number;
      }
    }
    o = oRes.data;
    if (!o) return;

    let customer = Array.isArray(o.customer) ? o.customer[0] : o.customer;
    if ((!customer || !customer.email) && o.customer_id) {
      try {
        const { data: cust } = await client
          .from("customers")
          .select("id, email, full_name, user_id")
          .eq("id", o.customer_id)
          .maybeSingle();
        if (cust) customer = cust;
      } catch {}
    }

    const customerEmail = customer?.email?.trim();
    if (!customerEmail) return;
    const customerName = customer?.full_name?.trim() || "there";

    const store = await storeInfo(client);
    const isPaid = o.payment_status === "paid" || !!o.paid_at;

    let storeAddress = store.address || null;
    let operatingHours: string | null = null;
    let station = Array.isArray(o.pickup_station) ? o.pickup_station[0] : o.pickup_station;

    // If order has pickup_station_id but join failed, query pickup_stations directly
    if (!station && o.pickup_station_id) {
      try {
        const { data: st } = await client
          .from("pickup_stations")
          .select("name, address_line1, address_line2, city, state, phone, operating_hours")
          .eq("id", o.pickup_station_id)
          .maybeSingle();
        if (st) station = st;
      } catch {}
    }

    // Fallback to active default station if no station on order
    if (!station?.address_line1) {
      try {
        const { data: defaultStation } = await client
          .from("pickup_stations")
          .select("name, address_line1, address_line2, city, state, phone, operating_hours")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (defaultStation) station = defaultStation;
      } catch {}
    }

    if (station?.address_line1) {
      storeAddress = [station.name, station.address_line1, station.address_line2, station.city, station.state].filter(Boolean).join(", ");
      if (station.operating_hours) operatingHours = station.operating_hours;
    }
    if (!operatingHours) {
      operatingHours = "Mon - Sat: 9:00 AM - 6:00 PM";
    }
    if (!storeAddress) {
      storeAddress = store.name ? `${store.name} Main Store Collection Desk` : "Main Store Collection Desk";
    }

    // Ensure 6-digit collection verification PIN is derived and synced to database
    const rawPin = o.pickup_pin || o.tracking_number;
    const pickupPin = getOrderPickupPin({
      id: orderId,
      order_number: o.order_number,
      pickup_pin: rawPin,
      tracking_number: rawPin,
    });

    if (o.tracking_number !== pickupPin || (o.pickup_pin && o.pickup_pin !== pickupPin)) {
      try {
        const { error: pinUpdateErr } = await client
          .from("orders")
          .update({ tracking_number: pickupPin, pickup_pin: pickupPin })
          .eq("id", orderId);
        if (pinUpdateErr && /pickup_pin/i.test(pinUpdateErr.message)) {
          await client
            .from("orders")
            .update({ tracking_number: pickupPin })
            .eq("id", orderId);
        }
      } catch {}
    }

    // Resolve deadline
    let pickupDeadline = o.pickup_deadline;
    if (status === "ready_for_pickup" && !pickupDeadline) {
      try {
        const { data: settings } = await client
          .from("settings")
          .select("pickup_hold_hours")
          .eq("id", SETTINGS_ID)
          .maybeSingle();
        const holdHours = settings?.pickup_hold_hours && settings.pickup_hold_hours > 0 ? settings.pickup_hold_hours : 48;
        pickupDeadline = new Date(Date.now() + holdHours * 3_600_000).toISOString();
        await client.from("orders").update({ pickup_deadline: pickupDeadline }).eq("id", orderId);
      } catch {}
    }
    const pickupDeadlineText = pickupDeadline ? formatWAT(pickupDeadline) : null;

    const trackUrl = `${storefrontUrl()}/track?order_number=${encodeURIComponent(o.order_number)}&email=${encodeURIComponent(customerEmail)}`;

    const mail = orderStatusEmail({
      store,
      name: customerName,
      orderNumber: o.order_number,
      status,
      trackUrl,
      paid: isPaid,
      totalKobo: o.total,
      storeAddress,
      operatingHours,
      pickupDeadlineText,
      pickupPin,
      reason,
    });
    if (mail) {
      await sendEmail({
        to: customerEmail,
        ...mail,
        idempotencyKey: customKey || `order-status/${orderId}/${status}`,
      });
    }

    // Supabase Realtime broadcast to notify open customer inbox / storefront session
    try {
      if (typeof client.channel === "function") {
        const channelIds = [customer?.id, customer?.user_id, o.customer_id].filter(Boolean);
        for (const targetId of channelIds) {
          const ch = client.channel(`customer_inbox_${targetId}`);
          await ch.send({
            type: "broadcast",
            event: "order_status_updated",
            payload: {
              orderId,
              orderNumber: o.order_number,
              status,
              pickupPin,
            },
          });
        }
      }
    } catch {}
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
