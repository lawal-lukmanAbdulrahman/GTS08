import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requirePermission } from "../_lib/staff-access";
import { validateNewTicket, TICKET_PRIORITIES, TICKET_STATUSES } from "../_lib/tickets";
import { afterResponse } from "../_lib/email/after";
import { notifyTicketReceived } from "../_lib/email/events";
import { createAdminNotification } from "../_lib/notify-admin";
import { readJson, serverError } from "../_lib/http";

/** A customer contacts support. Public, and rate limited (3 per 10 minutes per address). They get back only a reference. */
export async function POST(request: NextRequest) {
  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const check = validateNewTicket(parsed.body);
    if (!check.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });
    const t = check.value;

    const client = createServiceClient();
    const { data: ticket, error } = await client
      .from("support_tickets")
      .insert({ customer_email: t.customer_email, customer_name: t.customer_name, customer_phone: t.customer_phone, subject: t.subject, order_id: t.order_id })
      .select("id, reference")
      .single();
    if (error || !ticket) return serverError(new Error(error?.message ?? "ticket insert failed"));

    const { error: messageError } = await client.from("ticket_messages").insert({ ticket_id: (ticket as { id: string }).id, sender_type: "customer", body: t.body, is_internal: false });
    if (messageError) return serverError(new Error(messageError.message));

    const id = (ticket as { id: string }).id;
    afterResponse(() => notifyTicketReceived(client, id));
    await createAdminNotification(client, { type: "new_ticket", title: `New support ticket: ${t.subject}`, message: `${t.customer_name ?? t.customer_email} wrote in.`, link: "/admin/questions" });
    return NextResponse.json({ data: { reference: (ticket as { reference: string }).reference } }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

/** Tickets for staff who handle them. Query: ?status=&priority=&assigned_to=me&page=&limit= */
export async function GET(request: NextRequest) {
  const access = await requirePermission(request, "can_handle_tickets");
  if (!access.ok) return access.response;
  try {
    const p = request.nextUrl.searchParams;
    const bad = (m: string) => NextResponse.json({ error: m, code: "VALIDATION_ERROR" }, { status: 400 });
    const status = p.get("status");
    const priority = p.get("priority");
    const assigned = p.get("assigned_to");
    if (status && !(TICKET_STATUSES as readonly string[]).includes(status)) return bad("Unknown status.");
    if (priority && !(TICKET_PRIORITIES as readonly string[]).includes(priority)) return bad("Unknown priority.");
    if (assigned && assigned !== "me" && !isUuid(assigned)) return bad("assigned_to must be 'me' or a staff id.");
    const page = p.has("page") ? Number(p.get("page")) : 1;
    const limit = p.has("limit") ? Number(p.get("limit")) : 25;
    if (!Number.isInteger(page) || page < 1) return bad("page must be 1 or more.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return bad("limit must be 1 to 50.");

    let query = createServiceClient()
      .from("support_tickets")
      .select("id, reference, customer_email, customer_name, subject, status, priority, assigned_to, tags, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (assigned) query = query.eq("assigned_to", assigned === "me" ? access.user.id : assigned);
    const from = (page - 1) * limit;
    const { data, error, count } = await query.range(from, from + limit - 1);
    if (error) return serverError(new Error(error.message));
    return NextResponse.json({ data: data ?? [], meta: { total: count ?? 0, page, limit, pages: Math.max(1, Math.ceil((count ?? 0) / limit)) } });
  } catch (err) {
    return serverError(err);
  }
}
