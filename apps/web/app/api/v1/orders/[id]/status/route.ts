import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../../auth/utils";
import { withIdempotency } from "@/lib/idempotency";
import { requirePermission } from "../../../_lib/staff-access";

export const PUT = withIdempotency(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await requirePermission(request, "can_view_all_orders");
    if (!access.ok) return access.response;
    const user = access.user;

    const serviceClient = createServiceClient();

    const body = await request.json();
    const { status, carrier_name, tracking_number, carrier_tracking_url, internal_notes } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required", code: "INVALID_INPUT" }, { status: 400 });
    }

    const updatePayload: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (carrier_name !== undefined) updatePayload.carrier_name = carrier_name;
    if (tracking_number !== undefined) updatePayload.tracking_number = tracking_number;
    if (carrier_tracking_url !== undefined) updatePayload.carrier_tracking_url = carrier_tracking_url;
    if (internal_notes !== undefined) updatePayload.internal_notes = internal_notes;

    if (status === "shipped") {
      updatePayload.shipped_at = new Date().toISOString();
    } else if (status === "delivered") {
      updatePayload.delivered_at = new Date().toISOString();
    } else if (status === "paid") {
      updatePayload.paid_at = new Date().toISOString();
    }

    const { data: updatedOrder, error } = await serviceClient
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message, code: "DATABASE_ERROR" }, { status: 400 });
    }

    // Broadcast order status advancement to customer Realtime channel
    try {
      const channelId = updatedOrder.customer_email || updatedOrder.user_id;
      if (channelId) {
        const orderChannel = serviceClient.channel(`customer_orders_${channelId}`);
        await orderChannel.send({
          type: "broadcast",
          event: "order_advanced",
          payload: {
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.order_number,
            status: updatedOrder.status,
            trackingNumber: updatedOrder.tracking_number,
            carrierName: updatedOrder.carrier_name,
            updatedAt: updatedOrder.updated_at,
          },
        });
      }
    } catch {
      // ignore broadcast delivery failure
    }

    return NextResponse.json({
      data: updatedOrder,
      notification: {
        type: "order_advance",
        orderNumber: updatedOrder.order_number,
        orderStatus: updatedOrder.status,
        title: `Order #${updatedOrder.order_number} ${updatedOrder.status.toUpperCase()}`,
        message: `Your order has advanced to ${updatedOrder.status}. Tap to track your package live.`,
        link: `/track?order_number=${updatedOrder.order_number}`,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error", code: "SERVER_ERROR" }, { status: 500 });
  }
});
