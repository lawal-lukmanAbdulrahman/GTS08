import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Throwaway staff accounts for E2E runs, created through the Supabase admin API
 * (service key from the root .env) and deleted afterwards. Passwords are random
 * and only ever live in memory.
 */
function loadEnv() {
  const file = path.resolve(__dirname, "../../../../.env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
}
loadEnv();

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" };

async function sb(method: string, route: string, body?: unknown) {
  const res = await fetch(`${SB}${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: text ? JSON.parse(text) : null };
}

export interface TestAccount {
  id: string;
  email: string;
  password: string;
  name: string;
}

interface Options {
  role: "cashier" | "admin";
  grants?: Partial<Record<"can_process_pos" | "can_void_orders" | "can_apply_discounts" | "can_manage_inventory" | "can_view_all_orders" | "can_manage_products" | "can_handle_tickets", boolean>>;
  superAdmin?: boolean;
  label: string;
}

export async function createAccount({ role, grants = {}, superAdmin = false, label }: Options): Promise<TestAccount> {
  if (!SB || !KEY) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the root .env");
  const email = `e2e.${label}.${Date.now()}.${crypto.randomBytes(2).toString("hex")}@gts.ng`;
  const password = crypto.randomBytes(9).toString("base64url") + "aA1!";
  const name = `E2E ${label}`;
  const made = await sb("POST", "/auth/v1/admin/users", { email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (!made.ok) throw new Error(`could not create ${email}: ${JSON.stringify(made.json)}`);
  const id = made.json.id as string;
  await sb("POST", "/rest/v1/users", [{ id, email, full_name: name, role, is_blocked: false, is_super_admin: superAdmin, email_verified_at: new Date().toISOString() }]);
  if (role !== "admin") {
    await sb("POST", "/rest/v1/employee_permissions", [{ user_id: id, can_process_pos: true, ...grants }]);
  }
  return { id, email, password, name };
}

export async function deleteAccount(idOrEmail: { id: string } | { email: string }) {
  let id = "id" in idOrEmail ? idOrEmail.id : undefined;
  if (!id) {
    const found = await sb("GET", `/rest/v1/users?select=id&email=eq.${encodeURIComponent((idOrEmail as { email: string }).email)}`);
    id = found.json?.[0]?.id;
  }
  if (!id) return;
  await sb("DELETE", `/rest/v1/employee_permissions?user_id=eq.${id}`);
  await sb("DELETE", `/rest/v1/users?id=eq.${id}`);
  await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers });
}
