import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { sanitizeEmail } from "../utils";
import { validateSqlSafe, sanitizeSafeText, sanitizeDigitsOnly } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";
import { serverError } from "../../_lib/http";
import { afterResponse } from "../../_lib/email/after";
import { notifyCustomerWelcome } from "../../_lib/email/events";

export const POST = withIdempotency(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = sanitizeEmail(body.email);
    const rawPassword = typeof body.password === "string" ? body.password.replace(/\0/g, "") : "";
    const rawFullName = typeof body.full_name === "string" ? body.full_name : "";
    const rawPhone = typeof body.phone === "string" ? body.phone : "";

    // SQL Injection Guard
    const nameCheck = validateSqlSafe(rawFullName, "Full name");
    if (!nameCheck.isSafe) {
      return NextResponse.json({ error: nameCheck.error, code: "INVALID_INPUT" }, { status: 400 });
    }
    const phoneCheck = validateSqlSafe(rawPhone, "Phone number");
    if (!phoneCheck.isSafe) {
      return NextResponse.json({ error: phoneCheck.error, code: "INVALID_INPUT" }, { status: 400 });
    }

    const fullName = sanitizeSafeText(rawFullName, 100);
    const phone = rawPhone ? sanitizeDigitsOnly(rawPhone, 20) : null;
    const password = rawPassword;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format. Please check your address.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Create user with email_confirm: true so no email verification barriers block the shopper
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split("@")[0],
        phone: phone || null,
      },
    });

    if (createError || !created.user) {
      const msg = createError?.message || "Registration failed";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead.", code: "USER_EXISTS" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: msg, code: "REGISTRATION_FAILED" },
        { status: 400 }
      );
    }

    const userId = created.user.id;

    // The customer record for this account (customers has no unique column to upsert on, so look first).
    try {
      const displayName = fullName || email.split("@")[0] || "Customer";
      const { data: existing } = await serviceClient.from("customers").select("id").eq("user_id", userId).maybeSingle();
      if (!existing) {
        const { error: customerError } = await serviceClient.from("customers").insert({ user_id: userId, email, full_name: displayName, phone: phone || null });
        if (customerError) console.error("[auth/register] could not create the customer record:", customerError.message);
      }
    } catch (err) {
      console.error("[auth/register] could not create the customer record:", err instanceof Error ? err.message : err);
    }

    // Upsert into users table
    try {
      await serviceClient.from("users").upsert(
        {
          id: userId,
          email,
          full_name: fullName || email.split("@")[0] || "Customer",
          phone: phone || null,
          role: "customer",
        },
        { onConflict: "id" }
      );
    } catch {
      // non-blocking
    }

    const welcomeName = fullName || email.split("@")[0] || "there";
    afterResponse(() => notifyCustomerWelcome(serviceClient, { name: welcomeName, email }));

    return NextResponse.json(
      {
        success: true,
        data: {
          user_id: userId,
          email,
          message: "Registration successful!",
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return serverError(err);
  }
});
