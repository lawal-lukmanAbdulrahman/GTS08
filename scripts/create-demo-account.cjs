#!/usr/bin/env node
/**
 * Creates (or repairs) the demo account: an admin login that sees only the demo
 * data (migration 00025) and can't change anything shared with the real shop.
 *
 *   node scripts/create-demo-account.cjs            # uses demo@gts.ng
 *   DEMO_ACCOUNT_EMAIL=demo@shop.ng node scripts/create-demo-account.cjs
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env).
 * A fresh random password is generated each run and written ONLY to the
 * git-ignored .env as DEMO_ACCOUNT_EMAIL / DEMO_ACCOUNT_PASSWORD. It is never printed.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createRequire } = require("module");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const { createClient } = createRequire(path.join(ROOT, "apps/web/package.json"))("@supabase/supabase-js");

function readEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(ENV_FILE, "utf8")
      .split("\n")
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]])
  );
}

function writeEnvValues(values) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    text = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
  }
  fs.writeFileSync(ENV_FILE, text, { mode: 0o600 });
}

const PERMISSIONS = [
  "can_process_pos",
  "can_manage_inventory",
  "can_view_all_orders",
  "can_manage_products",
  "can_handle_tickets",
  "can_void_orders",
  "can_apply_discounts",
  "can_manage_broadcasts",
];

async function main() {
  const env = { ...readEnv(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.");
  const email = (env.DEMO_ACCOUNT_EMAIL || "demo@gts.ng").trim().toLowerCase();
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const probe = await db.from("users").select("is_demo").limit(1);
  if (probe.error) throw new Error("The database needs migration 00025 (demo account isolation) before a demo account can be made.");

  // Letters, digits and symbols from a CSPRNG; always passes the app's password rules.
  const password = `${crypto.randomBytes(18).toString("base64url")}Aa1!`;

  const { data: existing } = await db.from("users").select("id").eq("email", email).maybeSingle();
  let id = existing && existing.id;
  if (id) {
    const { error } = await db.auth.admin.updateUserById(id, { password, email_confirm: true });
    if (error) throw new Error(`Could not reset the demo password: ${error.message}`);
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Demo Admin" } });
    if (error || !data.user) throw new Error(`Could not create the demo login: ${error ? error.message : "no user returned"}`);
    id = data.user.id;
  }

  const profile = await db.from("users").upsert({ id, email, full_name: "Demo Admin", role: "admin", is_demo: true, is_super_admin: false, is_blocked: false }, { onConflict: "id" });
  if (profile.error) throw new Error(`Could not set up the demo profile: ${profile.error.message}`);
  const grants = await db.from("employee_permissions").upsert({ user_id: id, ...Object.fromEntries(PERMISSIONS.map((p) => [p, true])) }, { onConflict: "user_id" });
  if (grants.error && !/column/.test(grants.error.message)) throw new Error(`Could not grant the demo permissions: ${grants.error.message}`);

  writeEnvValues({ DEMO_ACCOUNT_EMAIL: email, DEMO_ACCOUNT_PASSWORD: password });
  console.log(`Demo account ready: ${email} (admin, demo data only).`);
  console.log(`Its password is in ${path.relative(process.cwd(), ENV_FILE) || ".env"} as DEMO_ACCOUNT_PASSWORD. Running this again sets a new one.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
