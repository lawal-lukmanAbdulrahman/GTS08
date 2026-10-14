import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@gts/database";
import { getAuthenticatedUser } from "../../auth/utils";
import { serverError } from "../../_lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  try {
    const { data: notifs, error } = await serviceClient
      .from("customer_notifications")
      .select("id, type, title, message, link, metadata, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // If table doesn't exist yet or other query error, return empty array gracefully
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: notifs || [] });
  } catch (err: any) {
    console.error("Failed to fetch customer notifications:", err);
    return NextResponse.json({ data: [] });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const notifId = body.id;

  const serviceClient = createServiceClient();

  try {
    if (notifId) {
      await serviceClient
        .from("customer_notifications")
        .update({ is_read: true })
        .eq("id", notifId)
        .eq("user_id", user.id);
    } else {
      // Mark all read
      await serviceClient
        .from("customer_notifications")
        .update({ is_read: true })
        .eq("user_id", user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
