import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@gts/database";
import { sanitizeEmail } from "../utils";
import { validateSqlSafe, sanitizeSafeText, sanitizeDigitsOnly } from "@gts/utils";
import { withIdempotency } from "@/lib/idempotency";

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

    // Upsert into customers table
    try {
      await serviceClient.from("customers").upsert(
        {
          user_id: userId,
          email,
          full_name: fullName || email.split("@")[0] || "Customer",
          phone: phone || null,
        },
        { onConflict: "email" }
      );
    } catch {
      // non-blocking
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
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
});
