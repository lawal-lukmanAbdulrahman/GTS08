/**
 * Creates (or resets) a TEST cashier so POS permission checks can be exercised
 * with a real non-admin account. Prints a random password once; nothing is
 * hard-coded. Delete the account when you're done testing.
 *
 *   node scripts/seed-cashier.cjs [email]          # default cashier.test@gts.ng
 *   node scripts/seed-cashier.cjs --void --discount # also grant the extra flags
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the root .env.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const parts = line.split("=");
    if (parts.length >= 2 && !parts[0].trim().startsWith("#")) {
      process.env[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--")) || "cashier.test@gts.ng";
const grantVoid = args.includes("--void");
const grantDiscount = args.includes("--discount");
const password = crypto.randomBytes(9).toString("base64url") + "aA1!";

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=representation",
};

async function api(method, route, body) {
  const res = await fetch(`${url}${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: text ? JSON.parse(text) : null };
}

async function main() {
  let userId;
  const created = await api("POST", "/auth/v1/admin/users", {
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Test Cashier" },
  });

  if (created.ok) {
    userId = created.json.id;
  } else if (/already|registered/i.test(JSON.stringify(created.json))) {
    const list = await api("GET", "/auth/v1/admin/users?per_page=1000");
    const existing = (list.json.users || []).find((u) => u.email === email);
    if (!existing) throw new Error("User exists but could not be found");
    userId = existing.id;
    await api("PUT", `/auth/v1/admin/users/${userId}`, { password, email_confirm: true });
  } else {
    throw new Error("Could not create auth user: " + JSON.stringify(created.json));
  }

  const profile = await api("POST", "/rest/v1/users", [
    { id: userId, email, full_name: "Test Cashier", role: "cashier", is_blocked: false, email_verified_at: new Date().toISOString() },
  ]);
  if (!profile.ok) throw new Error("users upsert failed: " + JSON.stringify(profile.json));

  const perms = {
    user_id: userId,
    can_process_pos: true,
    can_manage_inventory: false,
    can_view_all_orders: false,
    can_manage_products: false,
    can_handle_tickets: false,
  };
  const extended = { ...perms, can_void_orders: grantVoid, can_apply_discounts: grantDiscount };
  const del = await api("DELETE", `/rest/v1/employee_permissions?user_id=eq.${userId}`);
  let ins = await api("POST", "/rest/v1/employee_permissions", [extended]);
  let note = "";
  if (!ins.ok && /can_void_orders|can_apply_discounts/.test(JSON.stringify(ins.json))) {
    ins = await api("POST", "/rest/v1/employee_permissions", [perms]);
    note = "\n(Migration 00010 isn't applied yet, so the void/discount flags were skipped.)";
  }
  if (!ins.ok) throw new Error("permissions insert failed: " + JSON.stringify(ins.json));

  console.log("Test cashier ready.");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}   (shown once)`);
  console.log(`  POS access: yes | void: ${grantVoid} | discounts: ${grantDiscount}${note}`);
  console.log("Delete this account when you finish testing.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
