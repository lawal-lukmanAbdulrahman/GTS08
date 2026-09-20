import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requirePermission } from "../../_lib/staff-access";
import { clientIp, logActivity } from "../../_lib/activity";
import { validateTicketPatch } from "../../_lib/tickets";
import { readJson, serverError } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Ticket not found.", code: "NOT_FOUND" }, { status: 404 });

export async function GET(request: NextRequest, { params }: Context) {
  const access = await requirePermission(request, "can_handle_tickets");
  if (!access.ok) return access.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const { data, error } = await createServiceClient()
      .from("support_tickets")
      .select("id, reference, customer_email, customer_name, customer_phone, subject, order_id, status, priority, assigned_to, tags, resolved_at, closed_at, created_at, updated_at, messages:ticket_messages(id, sender_type, sender_id, body, is_internal, sent_at)")
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return notFound();
    const ticket = data as { messages?: Array<{ sent_at: string }> };
    return NextResponse.json({ data: { ...ticket, messages: [...(ticket.messages ?? [])].sort((a, b) => a.sent_at.localeCompare(b.sent_at)) } });
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const access = await requirePermission(request, "can_handle_tickets");
  if (!access.ok) return access.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const check = validateTicketPatch(parsed.body);
    if (!check.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", code: "VALIDATION_ERROR", details: check.errors }, { status: 400 });

    const client = createServiceClient();
    if (check.value.assigned_to) {
      const { data: assignee } = await client.from("users").select("id, role").eq("id", check.value.assigned_to).maybeSingle();
      if (!assignee || (assignee as { role: string }).role === "customer") {
        return NextResponse.json({ error: "Tickets can only be assigned to staff.", code: "VALIDATION_ERROR", details: { assigned_to: "Choose a staff member." } }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { ...check.value, updated_at: now };
    if (check.value.status === "resolved") patch.resolved_at = now;
    if (check.value.status === "closed") patch.closed_at = now;
    if (check.value.status === "open" || check.value.status === "in_progress") {
      patch.resolved_at = null;
      patch.closed_at = null;
    }

    const { data, error } = await client.from("support_tickets").update(patch).eq("id", id).select("id, reference, status, priority, assigned_to, tags, resolved_at, closed_at").maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!data) return notFound();
    await logActivity(client, { actorId: access.user.id, action: "ticket.update", targetType: "ticket", targetId: id, changes: check.value as Record<string, unknown>, ip: clientIp(request) });
    return NextResponse.json({ data });
  } catch (err) {
    return serverError(err);
  }
}
