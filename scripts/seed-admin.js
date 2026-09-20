import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const adminEmail = "admin@gts.ng";
  const adminPassword = "Password123!";

  console.log(`Seeding Admin Account: ${adminEmail}...`);

  // Check if admin user already exists in auth.users
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();

  let adminUser = usersData?.users?.find((u) => u.email === adminEmail);

  if (!adminUser) {
    // Create Admin user in Auth
    const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Admin User",
      },
    });

    if (createError) {
      console.error("Failed to create admin auth user:", createError.message);
      process.exit(1);
    }

    adminUser = newUserData.user;
    console.log("Created Auth user successfully:", adminUser.id);
  } else {
    // Update password to ensure it matches
    await supabase.auth.admin.updateUserById(adminUser.id, {
      password: adminPassword,
      email_confirm: true,
    });
    console.log("Updated existing Auth user password:", adminUser.id);
  }

  // Ensure public.users row has role='admin'
  const { error: upsertError } = await supabase.from("users").upsert({
    id: adminUser.id,
    email: adminEmail,
    full_name: "Admin User",
    role: "admin",
    is_blocked: false,
    email_verified_at: new Date().toISOString(),
  });

  if (upsertError) {
    console.error("Failed to update public.users role:", upsertError.message);
    process.exit(1);
  }

  // Grant all employee permissions
  await supabase.from("employee_permissions").upsert({
    user_id: adminUser.id,
    can_process_pos: true,
    can_manage_inventory: true,
    can_view_all_orders: true,
    can_manage_products: true,
    can_handle_tickets: true,
  });

  console.log("✅ Admin user seeded successfully!");
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
  console.log(`Role: admin`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
