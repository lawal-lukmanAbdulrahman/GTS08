import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { sanitizeXss } from "@gts/utils";
import { optionalStaff } from "../../../_lib/staff-access";

// GET /api/v1/inquiries/[id]/messages
// Secure thread retrieval: must be customer owner or staff/admin
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    const authUser = await getAuthenticatedUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Authentication required to view inquiry messages", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const serviceClient = createServiceClient();

    const { data: ticket, error: ticketError } = await serviceClient
      .from("support_tickets")
      .select(`
        id,
        reference,
        user_id,
        customer_name,
        customer_email,
        customer_phone,
        subject,
        status,
        tags,
        created_at,
        ticket_messages(id, sender_type, sender_id, body, sent_at)
      `)
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Inquiry not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Role and ownership check
    const staffContext = await optionalStaff(request);
    const isStaff = !!staffContext && (staffContext.isAdmin || staffContext.permissions.can_handle_tickets);
    const isOwner =
      ticket.user_id === authUser.id ||
      (authUser.email && ticket.customer_email?.toLowerCase() === authUser.email.toLowerCase());

    if (!isStaff && !isOwner) {
      return NextResponse.json({ error: "Access denied to this inquiry thread", code: "FORBIDDEN" }, { status: 403 });
    }

    const sortedMessages = (ticket.ticket_messages || []).sort(
      (a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    );

    const productIdTag = (ticket.tags || []).find((tag: string) => tag.startsWith("product_id:"));
    const productId = productIdTag ? productIdTag.replace("product_id:", "") : null;

    return NextResponse.json({
      data: {
        id: ticket.id,
        reference: ticket.reference,
        customerName: ticket.customer_name,
        customerEmail: ticket.customer_email,
        customerPhone: ticket.customer_phone,
        subject: ticket.subject,
        status: ticket.status,
        productId,
        createdAt: ticket.created_at,
        messages: sortedMessages.map((m: any) => ({
          id: m.id,
          senderType: m.sender_type,
          senderId: m.sender_id,
          body: m.body,
          sentAt: m.sent_at,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
}

// POST /api/v1/inquiries/[id]/messages
// Add a new message to the thread (authenticated, role-verified, idempotent, XSS sanitized)
export const POST = withIdempotency(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    const authUser = await getAuthenticatedUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Authentication required to reply to inquiries", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message, senderType = "customer" } = body;

    const sanitizedMessage = sanitizeXss(message, 3000);
    if (!sanitizedMessage.trim()) {
      return NextResponse.json({ error: "Message content is required", code: "BAD_REQUEST" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await serviceClient
      .from("support_tickets")
      .select("id, user_id, customer_email, status")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Inquiry not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Role and impersonation guard
    const staffContext = await optionalStaff(request);
    const isStaff = !!staffContext && (staffContext.isAdmin || staffContext.permissions.can_handle_tickets);
    const isOwner =
      ticket.user_id === authUser.id ||
      (authUser.email && ticket.customer_email?.toLowerCase() === authUser.email.toLowerCase());

    if (!isStaff && !isOwner) {
      return NextResponse.json({ error: "Forbidden: Cannot reply to another user's inquiry", code: "FORBIDDEN" }, { status: 403 });
    }

    // Only actual staff can set sender_type = "staff"
    const effectiveSenderType = isStaff && senderType === "staff" ? "staff" : "customer";

    // 1. Insert message
    const { data: newMsg, error: msgError } = await serviceClient
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_type: effectiveSenderType,
        sender_id: authUser.id,
        body: sanitizedMessage.trim(),
        is_internal: false,
      })
      .select("id, ticket_id, sender_type, body, sent_at")
      .single();

    if (msgError) {
      return NextResponse.json({ error: msgError.message, code: "INSERT_MSG_FAILED" }, { status: 500 });
    }

    // 2. Update ticket status: if staff replied, mark 'in_progress' or update timestamp
    const nextStatus = effectiveSenderType === "staff" ? "in_progress" : "open";
    await serviceClient
      .from("support_tickets")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    // 3. Broadcast message over Supabase Realtime WebSocket channels
    try {
      const msgPayload = {
        id: newMsg.id,
        senderType: newMsg.sender_type,
        body: newMsg.body,
        sentAt: newMsg.sent_at,
      };

      const channel = serviceClient.channel(`inquiry_${ticketId}`);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "new_message",
            payload: msgPayload,
          });
        }
      });

      const adminChannel = serviceClient.channel("admin_inquiries");
      adminChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          adminChannel.send({
            type: "broadcast",
            event: "new_inquiry_message",
            payload: {
              ticketId,
              message: msgPayload,
            },
          });
        }
      });
    } catch (realtimeErr) {
      console.warn("Failed to broadcast message to realtime channel:", realtimeErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newMsg.id,
        senderType: newMsg.sender_type,
        body: newMsg.body,
        sentAt: newMsg.sent_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
});
