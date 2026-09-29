// Rigorous Multi-Persona Security & Workflow Simulation against live local server (http://localhost:3000/api/v1)
// Simulates:
// 1. Anonymous Customer (Guest)
// 2. Registered Customer
// 3. Employee / Cashier (Restricted Permissions)
// 4. Admin (Store Owner / Superadmin)

const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "../../apps/web/.env.local");
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] || "";
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[match[1]] = value.trim();
      }
    }
  }
  return env;
}

const env = loadEnv();
const API_BASE = process.env.API_BASE || "http://localhost:3000/api/v1";
const SB = env.NEXT_PUBLIC_SUPABASE_URL || "https://qwtopfttxpizvennzejf.supabase.co";
const SK = env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const stats = { passed: 0, failed: 0, total: 0 };

function assert(description, condition, details = "") {
  stats.total++;
  if (condition) {
    stats.passed++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    stats.failed++;
    console.error(`  ✗ FAIL: ${description}${details ? " — " + details : ""}`);
  }
}

async function getAccessToken(email) {
  const r = await fetch(SB + "/auth/v1/admin/generate_link", {
    method: "POST",
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const data = await r.json();
  const hash = data.hashed_token || data.properties?.hashed_token;
  if (!hash) throw new Error("Could not generate link for " + email + ": " + JSON.stringify(data));

  const v = await fetch(SB + "/auth/v1/verify", {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ token_hash: hash, type: "magiclink" }),
  });
  const session = await v.json();
  if (!session.access_token) throw new Error("Could not verify session for " + email + ": " + JSON.stringify(session));
  return session.access_token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(token, method, endpoint, body = undefined, headers = {}) {
  const h = {
    Accept: "application/json",
    ...headers,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined && !h["Content-Type"]) h["Content-Type"] = "application/json";

  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(200);
    let res;
    try {
      res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: h,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (attempt === 2) {
        return { status: 0, ok: false, json: { error: String(err) }, headers: new Headers() };
      }
      await sleep(1000);
      continue;
    }

    if (res.status === 429) {
      const retryAfter = Math.min(30, parseInt(res.headers.get("retry-after") || "5", 10) || 5);
      console.log(`    (Rate limit reached on ${endpoint}, waiting ${retryAfter}s...)`);
      await sleep((retryAfter + 1) * 1000);
      continue;
    }

    let json = null;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return { status: res.status, ok: res.ok, json, headers: res.headers };
  }
  return { status: 429, ok: false, json: { error: "Rate limit retry exhausted" }, headers: new Headers() };
}

async function run() {
  console.log("================================================================================");
  console.log("  RIGOROUS MULTI-PERSONA SECURITY & WORKFLOW SIMULATION TEST");
  console.log(`  Target: ${API_BASE}`);
  console.log("================================================================================\n");

  console.log("Acquiring Persona Tokens from Supabase...");
  let adminToken, cashierToken, customerToken;
  try {
    adminToken = await getAccessToken("admin@gts.ng");
    console.log("  ✓ Admin token acquired (admin@gts.ng)");
    cashierToken = await getAccessToken("leamifysolutions@gmail.com");
    console.log("  ✓ Cashier token acquired (leamifysolutions@gmail.com)");
    customerToken = await getAccessToken("abdulrahmanlukmanlawal@gmail.com");
    console.log("  ✓ Customer token acquired (abdulrahmanlukmanlawal@gmail.com)");
  } catch (err) {
    console.error("Token acquisition failed:", err);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERSONA 1: ANONYMOUS STOREFRONT VISITOR (GUEST)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("PERSONA 1: ANONYMOUS GUEST VISITOR");
  console.log("--------------------------------------------------------------------------------");

  // 1.1 Public Store Settings & Homepage Discovery
  const p1_settings = await req(null, "GET", "/settings");
  assert("Public can view store settings (200)", p1_settings.status === 200);
  assert("Settings response does NOT expose secret keys", !p1_settings.json?.data?.supabase_service_key && !p1_settings.json?.data?.paystack_secret);

  const p1_hero = await req(null, "GET", "/storefront/hero");
  assert("Public can view storefront hero carousel (200)", p1_hero.status === 200 && Array.isArray(p1_hero.json?.data));

  const p1_categories = await req(null, "GET", "/categories");
  assert("Public can view active categories (200)", p1_categories.status === 200 && Array.isArray(p1_categories.json?.data));

  // 1.2 Catalogue & Product Detail Privacy Check
  const p1_prods = await req(null, "GET", "/products?limit=5");
  assert("Public can view catalogue products (200)", p1_prods.status === 200 && Array.isArray(p1_prods.json?.data));
  const sampleProd = p1_prods.json?.data?.[0];

  if (sampleProd?.slug) {
    const p1_detail = await req(null, "GET", `/products/${sampleProd.slug}`);
    assert("Public can view single product details by slug (200)", p1_detail.status === 200);
    assert(
      "Public product detail does NOT leak cost_price",
      p1_detail.json?.data?.cost_price === undefined || p1_detail.json?.data?.cost_price === null,
      `cost_price found: ${p1_detail.json?.data?.cost_price}`
    );
    assert(
      "Public product detail does NOT leak supplier",
      p1_detail.json?.data?.supplier === undefined || p1_detail.json?.data?.supplier === null
    );
  }

  // 1.3 Cart Operations (Valid UUID Session)
  const guestSessionId = crypto.randomUUID();
  const p1_cart = await req(null, "GET", `/cart/${guestSessionId}`);
  assert("Guest can retrieve empty session cart with UUID (200)", p1_cart.status === 200);
  assert("Cart response returns session_id", p1_cart.json?.data?.session_id === guestSessionId);

  // 1.4 Invalid Cart Session Protection
  const p1_bad_cart = await req(null, "GET", "/cart/invalid-non-uuid-string");
  assert("Non-UUID cart session is rejected (400)", p1_bad_cart.status === 400);

  // 1.5 Wishlist Session Defense
  const p1_wishlist = await req(null, "GET", "/wishlist");
  assert("Guest GET /wishlist returns 401 (guest wishlist must remain in local storage)", p1_wishlist.status === 401);

  const p1_wishlist_add = await req(null, "POST", "/wishlist", { product_id: sampleProd?.id || "mock" });
  assert("Guest POST /wishlist returns 401", p1_wishlist_add.status === 401);

  // 1.6 Guest Security Boundary (Attempts to touch protected routes)
  const protectedEndpoints = [
    { method: "GET", path: "/staff/me", label: "staff profile" },
    { method: "GET", path: "/staff/me/sales", label: "staff sales" },
    { method: "GET", path: "/users", label: "user list" },
    { method: "GET", path: "/users/staff", label: "staff list" },
    { method: "GET", path: "/pos/orders", label: "POS orders" },
    { method: "GET", path: "/pos/orders/today", label: "POS today orders" },
    { method: "GET", path: "/pos/categories", label: "POS categories" },
    { method: "POST", path: "/products", label: "product creation", body: { title: "Hacked" } },
    { method: "PATCH", path: "/settings", label: "settings update", body: { store_name: "Hacked" } },
    { method: "GET", path: "/inventory", label: "inventory listing" },
    { method: "GET", path: "/analytics/dashboard", label: "admin analytics" },
  ];

  for (const ep of protectedEndpoints) {
    const res = await req(null, ep.method, ep.path, ep.body);
    assert(`Guest cannot access ${ep.label} (${ep.method} ${ep.path}) -> 401`, res.status === 401, `Got ${res.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERSONA 2: REGISTERED STOREFRONT CUSTOMER
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("PERSONA 2: REGISTERED STOREFRONT CUSTOMER");
  console.log("--------------------------------------------------------------------------------");

  // 2.1 Customer Wishlist Sync to DB
  const p2_wishlist = await req(customerToken, "GET", "/wishlist");
  assert("Customer can fetch DB wishlist (200)", p2_wishlist.status === 200 && Array.isArray(p2_wishlist.json?.data));

  if (sampleProd?.id) {
    const p2_add = await req(customerToken, "POST", "/wishlist", { product_id: sampleProd.id });
    assert("Customer can add item to DB wishlist (200/201)", p2_add.status === 200 || p2_add.status === 201);

    const p2_del = await req(customerToken, "DELETE", `/wishlist/${sampleProd.id}`);
    assert("Customer can remove item from DB wishlist (200)", p2_del.status === 200);
  }

  // 2.2 Customer Orders (Own vs All)
  const p2_cust_orders = await req(customerToken, "GET", "/orders/customer");
  assert("Customer can fetch own orders (/orders/customer)", p2_cust_orders.status === 200);

  // 2.3 Customer Privilege Escalation / Tampering Attempts (Must be 403 Forbidden)
  const customerForbiddenTests = [
    { method: "POST", path: "/pos/orders", label: "create POS order", body: { items: [] } },
    { method: "GET", path: "/pos/products/search?q=test", label: "POS product search" },
    { method: "GET", path: "/pos/whatsapp-orders", label: "POS whatsapp orders" },
    { method: "PUT", path: `/pos/orders/${crypto.randomUUID()}/void`, label: "void POS order" },
    { method: "GET", path: "/users", label: "view all users" },
    { method: "GET", path: "/users/staff", label: "view staff members" },
    { method: "PATCH", path: `/users/${crypto.randomUUID()}`, label: "modify staff member", body: { role: "admin" } },
    { method: "DELETE", path: `/users/${crypto.randomUUID()}`, label: "delete staff member" },
    { method: "PATCH", path: "/settings", label: "modify store settings", body: { store_name: "Customer Override" } },
    { method: "GET", path: "/inventory", label: "view store inventory" },
    { method: "POST", path: "/inventory/adjustments", label: "adjust inventory stock", body: { items: [] } },
    { method: "GET", path: "/analytics/dashboard", label: "view financial analytics" },
    { method: "GET", path: "/analytics/overview", label: "view analytics overview" },
    { method: "DELETE", path: `/products?id=${crypto.randomUUID()}`, label: "delete product" },
    { method: "POST", path: "/products", label: "create product", body: { title: "Malicious" } },
  ];

  for (const t of customerForbiddenTests) {
    const res = await req(customerToken, t.method, t.path, t.body);
    assert(`Customer CANNOT ${t.label} -> 403 Forbidden`, res.status === 403, `Got ${res.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERSONA 3: EMPLOYEE / CASHIER (RESTRICTED PERMISSIONS)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("PERSONA 3: EMPLOYEE / CASHIER (Restricted Permissions)");
  console.log("--------------------------------------------------------------------------------");

  // 3.1 Cashier Identity & Profile
  const p3_me = await req(cashierToken, "GET", "/staff/me");
  assert("Cashier can fetch own profile (/staff/me) (200)", p3_me.status === 200);
  assert("Cashier profile has cashier role", p3_me.json?.data?.role === "cashier");
  assert("Cashier is not flagged as admin", p3_me.json?.data?.is_admin === false);
  assert("Cashier possesses can_process_pos permission", p3_me.json?.data?.permissions?.can_process_pos === true);
  assert("Cashier DOES NOT have can_void_orders", p3_me.json?.data?.permissions?.can_void_orders === false);
  assert("Cashier DOES NOT have can_manage_inventory", p3_me.json?.data?.permissions?.can_manage_inventory === false);

  // 3.2 Authorized POS Operations
  const p3_pos_cats = await req(cashierToken, "GET", "/pos/categories");
  assert("Cashier CAN access POS categories (200)", p3_pos_cats.status === 200);

  const p3_pos_search = await req(cashierToken, "GET", "/pos/products/search?q=jacket");
  assert("Cashier CAN access POS product search (200)", p3_pos_search.status === 200);

  const p3_pos_today = await req(cashierToken, "GET", "/pos/orders/today");
  assert("Cashier CAN access today's POS orders (200)", p3_pos_today.status === 200);

  // 3.3 Cashier Permission Boundaries (Enforcing strict RBAC)
  const cashierDeniedActions = [
    { method: "PUT", path: `/pos/orders/${crypto.randomUUID()}/void`, label: "void order without can_void_orders" },
    { method: "GET", path: "/inventory", label: "view inventory without can_manage_inventory" },
    { method: "POST", path: "/inventory/adjustments", label: "adjust inventory stock", body: { items: [] } },
    { method: "POST", path: "/products", label: "create product without can_manage_products", body: { title: "Cashier Item" } },
    { method: "DELETE", path: `/products?id=${crypto.randomUUID()}`, label: "delete product without can_manage_products" },
    { method: "GET", path: "/users", label: "access admin user management /users" },
    { method: "GET", path: "/users/staff", label: "access staff list /users/staff" },
    { method: "PATCH", path: `/users/${crypto.randomUUID()}`, label: "modify staff permissions" },
    { method: "DELETE", path: `/users/${crypto.randomUUID()}`, label: "delete staff member /users/:id" },
    { method: "PATCH", path: "/settings", label: "modify store settings" },
    { method: "GET", path: "/analytics/dashboard", label: "view financial analytics dashboard" },
    { method: "GET", path: "/analytics/overview", label: "view analytics overview" },
    { method: "GET", path: "/analytics/sales", label: "view sales analytics" },
  ];

  for (const t of cashierDeniedActions) {
    const res = await req(cashierToken, t.method, t.path, t.body);
    assert(`Cashier WITHOUT permission CANNOT ${t.label} -> 403 Forbidden`, res.status === 403, `Got ${res.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERSONA 4: STORE ADMIN / SUPERADMIN
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("PERSONA 4: STORE ADMIN");
  console.log("--------------------------------------------------------------------------------");

  // 4.1 Admin Identity
  const p4_me = await req(adminToken, "GET", "/staff/me");
  assert("Admin can fetch own profile (200)", p4_me.status === 200);
  assert("Admin has admin role", p4_me.json?.data?.role === "admin");
  assert("Admin is flagged as admin", p4_me.json?.data?.is_admin === true);

  // 4.2 Admin Staff Management
  const p4_users = await req(adminToken, "GET", "/users");
  assert("Admin CAN view all users (200)", p4_users.status === 200 && Array.isArray(p4_users.json?.data));

  const p4_staff = await req(adminToken, "GET", "/users/staff");
  assert("Admin CAN view staff list (200)", p4_staff.status === 200 && Array.isArray(p4_staff.json?.data));

  // 4.3 Admin Settings & Analytics
  const p4_analytics = await req(adminToken, "GET", "/analytics/dashboard");
  assert("Admin CAN access analytics dashboard (200)", p4_analytics.status === 200);

  const p4_overview = await req(adminToken, "GET", "/analytics/overview");
  assert("Admin CAN access analytics overview (200)", p4_overview.status === 200);

  const p4_inv = await req(adminToken, "GET", "/inventory");
  assert("Admin CAN access inventory list (200)", p4_inv.status === 200);

  // 4.4 Admin Storefront Sections & Hero Management
  const p4_sections = await req(adminToken, "GET", "/storefront/sections");
  assert("Admin CAN access storefront sections manager (200)", p4_sections.status === 200);

  // 4.5 Admin Orders Management
  const p4_orders = await req(adminToken, "GET", "/orders");
  assert("Admin CAN access all store orders (200)", p4_orders.status === 200 && Array.isArray(p4_orders.json?.data));

  // 4.6 Cost Price Visibility (Admin sees cost price, Public does not)
  if (sampleProd?.slug) {
    const p4_detail = await req(adminToken, "GET", `/products/${sampleProd.slug}`);
    assert("Admin product detail request succeeds (200)", p4_detail.status === 200);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`SIMULATION COMPLETE: ${stats.passed}/${stats.total} PASSED (${stats.failed} FAILED)`);
  console.log("================================================================================\n");

  if (stats.failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Unhandled simulation error:", e);
  process.exit(1);
});
