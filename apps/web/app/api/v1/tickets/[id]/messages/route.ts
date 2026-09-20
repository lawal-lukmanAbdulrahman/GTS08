import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { isUuid } from "@gts/utils";
import { requirePermission } from "../../../_lib/staff-access";
import { MAX_BODY } from "../../../_lib/tickets";
import { isPlainObject } from "../../../_lib/validate";
import { afterResponse } from "../../../_lib/email/after";
import { notifyTicketReply } from "../../../_lib/email/events";
import { readJson, serverError } from "../../../_lib/http";

/** A staff reply. A reply is emailed to the customer; an internal note never is. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePermission(request, "can_handle_tickets");
  if (!access.ok) return access.response;
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Ticket not found.", code: "NOT_FOUND" }, { status: 404 });
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const b = isPlainObject(parsed.body) ? parsed.body : {};

    const text = typeof b.body === "string" ? b.body.trim() : "";
    const internal = b.is_internal === undefined ? false : b.is_internal;
    if (!text || text.length > MAX_BODY || typeof internal !== "boolean") {
      return NextResponse.json({ error: `Write a reply of up to ${MAX_BODY} characters.`, code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const client = createServiceClient();
    const { data: ticket, error } = await client.from("support_tickets").select("id, status").eq("id", id).maybeSingle();
    if (error) return serverError(new Error(error.message));
    if (!ticket) return NextResponse.json({ error: "Ticket not found.", code: "NOT_FOUND" }, { status: 404 });
    if ((ticket as { status: string }).status === "closed") return NextResponse.json({ error: "This ticket is closed. Reopen it to reply.", code: "TICKET_CLOSED" }, { status: 409 });

    const { data: message, error: insertError } = await client
      .from("ticket_messages")
      .insert({ ticket_id: id, sender_type: "staff", sender_id: access.user.id, body: text, is_internal: internal })
      .select("id, sent_at")
      .single();
    if (insertError) return serverError(new Error(insertError.message));

    if ((ticket as { status: string }).status === "open") await client.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", id);
    if (!internal) afterResponse(() => notifyTicketReply(client, id, text));
    return NextResponse.json({ data: message }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
