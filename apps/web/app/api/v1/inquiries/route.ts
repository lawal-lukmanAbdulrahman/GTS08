import { NextResponse } from "next/server";
import { filterEmail } from "../_lib/filter";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { sanitizeSafeText, sanitizeXss } from "@gts/utils";
import { requirePermission } from "../_lib/staff-access";
import { serverError, dbError } from "../_lib/http";

// GET /api/v1/inquiries
// - If ?productId=... & user authenticated: returns customer's private inquiry thread for that product.
// - If ?all=true & staff/admin: returns all inquiry threads for the dashboard inboxes.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const isAll = searchParams.get("all") === "true";
    const statusFilter = searchParams.get("status");

    const serviceClient = createServiceClient();
    const authUser = await getAuthenticatedUser(request);

    // Admin / Staff listing all inboxes
    if (isAll) {
      const access = await requirePermission(request, "can_handle_tickets");
      if (!access.ok) return access.response;

      let query = serviceClient
        .from("support_tickets")
        .select(`
          id,
          reference,
          user_id,
          customer_email,
          customer_name,
          customer_phone,
          subject,
          status,
          priority,
          tags,
          created_at,
          updated_at,
          ticket_messages(id, sender_type, body, sent_at)
        `)
        .contains("tags", ["product_question"])
        .order("updated_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: tickets, error } = await query;
      if (error) {
        return dbError(error, "DB_ERROR", 500);
      }

      // Format with latest message and extracted productId
      const formatted = (tickets || []).map((t: any) => {
        const sortedMessages = (t.ticket_messages || []).sort(
          (a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
        );
        const lastMsg = sortedMessages[sortedMessages.length - 1] || null;
        const productIdTag = (t.tags || []).find((tag: string) => tag.startsWith("product_id:"));
        const extractedProductId = productIdTag ? productIdTag.replace("product_id:", "") : null;

        return {
          id: t.id,
          reference: t.reference,
          customerName: t.customer_name || "Customer",
          customerEmail: t.customer_email,
          customerPhone: t.customer_phone,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          productId: extractedProductId,
          tags: t.tags,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          lastMessage: lastMsg ? lastMsg.body : "",
          lastMessageAt: lastMsg ? lastMsg.sent_at : t.created_at,
          lastSenderType: lastMsg ? lastMsg.sender_type : "customer",
          messageCount: sortedMessages.length,
        };
      });

      return NextResponse.json({ data: formatted });
    }

    // Customer listing all inquiries for their personal Inbox
    if (!productId) {
      if (!authUser) {
        return NextResponse.json({ data: [], message: "Login required" });
      }

      const { data: tickets, error } = await serviceClient
        .from("support_tickets")
        .select(`
          id,
          reference,
          user_id,
          customer_email,
          customer_name,
          subject,
          status,
          tags,
          created_at,
          updated_at,
          ticket_messages(id, sender_type, body, sent_at)
        `)
        .contains("tags", ["product_question"])
        .or(`user_id.eq.${authUser.id},customer_email.eq.${filterEmail(authUser.email ?? "")}`)
        .order("updated_at", { ascending: false });

      if (error) {
        return dbError(error, "DB_ERROR", 500);
      }

      const productIds = (tickets || [])
        .map((t: any) => {
          const tag = (t.tags || []).find((tg: string) => tg.startsWith("product_id:"));
          return tag ? tag.replace("product_id:", "") : null;
        })
        .filter(Boolean);

      const productsMap: Record<string, any> = {};
      if (productIds.length > 0) {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validUuids = productIds.filter((id: string) => UUID_RE.test(id));
        const slugs = productIds.filter((id: string) => !UUID_RE.test(id));

        if (validUuids.length > 0) {
          const { data: prods } = await serviceClient
            .from("products")
            .select("id, name, slug, product_images(cloudinary_public_id)")
            .in("id", validUuids);

          if (prods) {
            prods.forEach((p: any) => {
              productsMap[p.id] = p;
            });
          }
        }

        if (slugs.length > 0) {
          const { data: prods } = await serviceClient
            .from("products")
            .select("id, name, slug, product_images(cloudinary_public_id)")
            .in("slug", slugs);

          if (prods) {
            prods.forEach((p: any) => {
              productsMap[p.slug] = p;
            });
          }
        }
      }

      const formatted = (tickets || []).map((t: any) => {
        const sortedMessages = (t.ticket_messages || []).sort(
          (a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
        );
        const lastMsg = sortedMessages[sortedMessages.length - 1] || null;
        const productIdTag = (t.tags || []).find((tg: string) => tg.startsWith("product_id:"));
        const pId = productIdTag ? productIdTag.replace("product_id:", "") : null;
        const linkedProd = pId ? productsMap[pId] : null;

        const hasStaffReply = sortedMessages.some((m: any) => m.sender_type === "staff");
        const lastSenderIsStaff = lastMsg?.sender_type === "staff";

        return {
          id: t.id,
          reference: t.reference,
          subject: t.subject,
          status: t.status,
          productId: pId,
          productName: linkedProd?.name || t.subject?.replace(/^Question:\s*/i, "") || "Product Inquiry",
          productSlug: linkedProd?.slug || pId,
          productImage: linkedProd?.product_images?.[0]?.cloudinary_public_id || null,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          lastMessage: lastMsg?.body || "",
          lastMessageAt: lastMsg?.sent_at || t.created_at,
          lastSenderType: lastMsg?.sender_type || "customer",
          hasStaffReply,
          lastSenderIsStaff,
          messageCount: sortedMessages.length,
        };
      });

      return NextResponse.json({ data: formatted });
    }

    if (!authUser) {
      return NextResponse.json({ data: null, message: "Login required for private discussions" });
    }

    // Find customer's private ticket for this product
    const { data: tickets, error } = await serviceClient
      .from("support_tickets")
      .select(`
        id,
        reference,
        user_id,
        customer_email,
        customer_name,
        subject,
        status,
        tags,
        created_at,
        ticket_messages(id, sender_type, body, sent_at)
      `)
      .contains("tags", ["product_question", `product_id:${productId}`])
      .or(`user_id.eq.${authUser.id},customer_email.eq.${filterEmail(authUser.email ?? "")}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return dbError(error, "DB_ERROR", 500);
    }

    const ticket = tickets?.[0] || null;
    if (!ticket) {
      return NextResponse.json({ data: null });
    }

    const sortedMessages = (ticket.ticket_messages || []).sort(
      (a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    );

    return NextResponse.json({
      data: {
        id: ticket.id,
        reference: ticket.reference,
        status: ticket.status,
        subject: ticket.subject,
        createdAt: ticket.created_at,
        messages: sortedMessages.map((m: any) => ({
          id: m.id,
          senderType: m.sender_type,
          body: m.body,
          sentAt: m.sent_at,
        })),
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
}

// POST /api/v1/inquiries
// Customer creates a new inquiry or adds to an existing inquiry for this product
export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required to ask a question", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, productTitle, message } = body;

    const sanitizedMessage = sanitizeXss(message, 3000);
    const sanitizedProductId = sanitizeSafeText(productId, 100);
    const sanitizedProductTitle = sanitizeSafeText(productTitle, 150);

    if (!sanitizedProductId || !sanitizedMessage.trim()) {
      return NextResponse.json({ error: "Product ID and message are required", code: "BAD_REQUEST" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // 1. Check if user already has an open/in_progress inquiry for this product
    const { data: existingTickets } = await serviceClient
      .from("support_tickets")
      .select("id, status")
      .contains("tags", ["product_question", `product_id:${sanitizedProductId}`])
      .or(`user_id.eq.${authUser.id},customer_email.eq.${filterEmail(authUser.email ?? "")}`)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

    let ticketId = existingTickets?.[0]?.id;

    // 2. If no open ticket exists, create one
    if (!ticketId) {
      const customerName = sanitizeSafeText(authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Customer", 100);
      const { data: newTicket, error: createError } = await serviceClient
        .from("support_tickets")
        .insert({
          user_id: authUser.id,
          customer_email: authUser.email,
          customer_name: customerName,
          subject: sanitizedProductTitle ? `Question: ${sanitizedProductTitle}` : `Product Inquiry (${sanitizedProductId})`,
          tags: ["product_question", `product_id:${sanitizedProductId}`],
          status: "open",
          priority: "normal",
        })
        .select("id")
        .single();

      if (createError) {
        return dbError(createError, "CREATE_TICKET_FAILED", 500);
      }
      ticketId = newTicket.id;
    } else {
      // Reopen or update timestamp
      await serviceClient
        .from("support_tickets")
        .update({ status: "open", updated_at: new Date().toISOString() })
        .eq("id", ticketId);
    }

    // 3. Insert the message
    const { data: newMessage, error: msgError } = await serviceClient
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "customer",
        sender_id: authUser.id,
        body: sanitizedMessage.trim(),
        is_internal: false,
      })
      .select("id, ticket_id, sender_type, body, sent_at")
      .single();

    if (msgError) {
      return dbError(msgError, "CREATE_MSG_FAILED", 500);
    }

    // Broadcast over Supabase Realtime WebSocket channels
    try {
      const msgPayload = {
        id: newMessage.id,
        senderType: newMessage.sender_type,
        body: newMessage.body,
        sentAt: newMessage.sent_at,
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
        ticketId,
        message: {
          id: newMessage.id,
          senderType: newMessage.sender_type,
          body: newMessage.body,
          sentAt: newMessage.sent_at,
        },
      },
    });
  } catch (err: any) {
    return serverError(err);
  }
});
