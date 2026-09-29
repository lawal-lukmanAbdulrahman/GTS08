import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { serverError } from "../../_lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get("order_number");
    const email = searchParams.get("email");

    if (!orderNumber || !email) {
      return NextResponse.json(
        { error: "order_number and email are required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const cleanNum = orderNumber.trim();
    const cleanEmail = email.trim().toLowerCase();

    const normalizedNum = cleanNum.toUpperCase().startsWith("GTS-")
      ? cleanNum.toUpperCase()
      : `GTS-${cleanNum.toUpperCase()}`;

    const serviceClient = createServiceClient();

    // Fetch order matching order_number (trying normalized first, then original)
    let { data: order, error } = await serviceClient
      .from("orders")
      .select(
        `
        id,
        order_number,
        status,
        payment_status,
        payment_method,
        cancel_reason,
        hold_reason,
        ready_for_pickup_at,
        pickup_deadline,
        tracking_number,
        channel,
        subtotal,
        delivery_fee,
        discount_amount,
        total,
        paid_at,
        created_at,
        customer:customers(full_name, email, phone),
        address:addresses(full_name, phone, address_line1, address_line2, city, state),
        items:order_items(id, variant_id, quantity, unit_price, line_total, product_snapshot),
        pickup_station:pickup_stations(id, name, address_line1, address_line2, city, state, phone, operating_hours, notes)
      `
      )
      .eq("order_number", normalizedNum)
      .single();

    if ((error || !order) && cleanNum !== normalizedNum) {
      const retry = await serviceClient
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          payment_status,
          payment_method,
          cancel_reason,
          hold_reason,
          ready_for_pickup_at,
          pickup_deadline,
          tracking_number,
          channel,
          subtotal,
          delivery_fee,
          discount_amount,
          total,
          paid_at,
          created_at,
          customer:customers(full_name, email, phone),
          address:addresses(full_name, phone, address_line1, address_line2, city, state),
          items:order_items(id, variant_id, quantity, unit_price, line_total, product_snapshot),
          pickup_station:pickup_stations(id, name, address_line1, address_line2, city, state, phone, operating_hours, notes)
        `
        )
        .eq("order_number", cleanNum)
        .single();
      if (retry.data && !retry.error) {
        order = retry.data;
        error = retry.error;
      }
    }

    const customerObj = Array.isArray(order?.customer) ? order.customer[0] : order?.customer;
    const custEmail = customerObj?.email?.trim().toLowerCase();

    if (error || !order || custEmail !== cleanEmail) {
      return NextResponse.json(
        { error: "Order not found. Please check your order number and email.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Enrich items with missing snapshot images for past or existing orders
    if (Array.isArray(order.items) && order.items.length > 0) {
      const itemsNeedingImage = order.items.filter(
        (it: any) => !it.product_snapshot?.image && !it.product_snapshot?.image_url
      );

      if (itemsNeedingImage.length > 0) {
        const productIds = Array.from(
          new Set(
            itemsNeedingImage
              .map((it: any) => it.product_snapshot?.id)
              .filter((id): id is string => Boolean(id))
          )
        );

        if (productIds.length > 0) {
          const { data: images } = await serviceClient
            .from("product_images")
            .select("product_id, variant_id, cloudinary_public_id, is_primary, sort_order")
            .in("product_id", productIds);

          if (images && images.length > 0) {
            for (const it of itemsNeedingImage) {
              const pId = it.product_snapshot?.id;
              const vId = it.variant_id;
              const itemImages = images.filter(
                (img: any) => (vId && img.variant_id === vId) || (pId && img.product_id === pId)
              );
              const chosen =
                (vId && itemImages.find((img: any) => img.variant_id === vId)?.cloudinary_public_id) ||
                itemImages.find((img: any) => img.is_primary)?.cloudinary_public_id ||
                itemImages.slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.cloudinary_public_id;

              if (chosen) {
                it.product_snapshot = {
                  ...(it.product_snapshot || {}),
                  image: chosen,
                };
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ data: order });
  } catch (err: any) {
    return serverError(err);
  }
}
