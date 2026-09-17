const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      if (key && !key.startsWith("#")) {
        process.env[key] = val;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates",
};

async function main() {
  const adminEmail = "admin@gts.ng";
  const adminPassword = "Password123!";

  console.log(`Seeding Admin Account (${adminEmail}) via Supabase REST API...`);

  // 1. Create Auth User
  const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "Admin User" },
    }),
  });

  let userId = null;
  const authJson = await authRes.json();

  if (authRes.ok) {
    userId = authJson.id;
    console.log("Created Auth user successfully:", userId);
  } else if (authJson.msg?.includes("already") || authJson.message?.includes("already")) {
    console.log("Auth user already exists. Fetching user ID...");
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, { headers });
    const listJson = await listRes.json();
    const existing = (listJson.users || listJson || []).find((u) => u.email === adminEmail);
    if (existing) {
      userId = existing.id;
      // Update password
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ password: adminPassword, email_confirm: true }),
      });
      console.log("Updated existing Auth user password for ID:", userId);
    }
  } else {
    console.error("Auth creation failed:", authJson);
    process.exit(1);
  }

  if (!userId) {
    console.error("Could not obtain user ID");
    process.exit(1);
  }

  // 2. Upsert public.users
  const userRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      {
        id: userId,
        email: adminEmail,
        full_name: "Admin User",
        role: "admin",
        is_blocked: false,
        email_verified_at: new Date().toISOString(),
      },
    ]),
  });

  if (!userRes.ok) {
    console.error("Failed to upsert public.users:", await userRes.text());
    process.exit(1);
  }

  // 3. Upsert employee_permissions
  const permRes = await fetch(`${supabaseUrl}/rest/v1/employee_permissions`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      {
        user_id: userId,
        can_process_pos: true,
        can_manage_inventory: true,
        can_view_all_orders: true,
        can_manage_products: true,
        can_handle_tickets: true,
      },
    ]),
  });

  if (!permRes.ok) {
    console.error("Failed to upsert employee_permissions:", await permRes.text());
  }

  console.log("==========================================");
  console.log("✅ ADMIN CREATED & SEEDED SUCCESSFULLY!");
  console.log(`URL:      http://localhost:3001/login`);
  console.log(`Email:    ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
  console.log(`Role:     admin`);
  console.log("==========================================");
}

main().catch((err) => {
  console.error("Unhandled Error:", err);
  process.exit(1);
});
