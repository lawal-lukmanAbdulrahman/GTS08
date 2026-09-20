// QA end-to-end (API level) for GTS.
//
//   QA_ADMIN_EMAIL=admin@gts.ng QA_ADMIN_PASSWORD=... node scripts/qa/api-e2e.cjs
//   (optional) QA_API_BASE=http://localhost:3002/api/v1
//
// It provisions two temporary cashiers through the Supabase admin API (service key from the
// root .env), runs every check against the live API, then deletes them. Sales and WhatsApp
// orders it creates are voided/cancelled; the harness never leaves stock changed.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const B = process.env.QA_API_BASE || "http://localhost:3002/api/v1";
for (const line of fs.readFileSync(path.resolve(__dirname, "../../.env"), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] = process.env[line.slice(0, i).trim()] || line.slice(i + 1).trim();
}
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbHeaders = { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" };
const sb = async (method, route, body) => {
  const res = await fetch(`${SB}${route}`, { method, headers: sbHeaders, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: text ? JSON.parse(text) : null };
};
async function provisionCashier(email, grants) {
  const password = crypto.randomBytes(9).toString("base64url") + "aA1!";
  const made = await sb("POST", "/auth/v1/admin/users", { email, password, email_confirm: true, user_metadata: { full_name: "QA Cashier" } });
  if (!made.ok) throw new Error("could not create " + email + ": " + JSON.stringify(made.json));
  const id = made.json.id;
  await sb("POST", "/rest/v1/users", [{ id, email, full_name: "QA Cashier", role: "cashier", is_blocked: false, email_verified_at: new Date().toISOString() }]);
  await sb("POST", "/rest/v1/employee_permissions", [{ user_id: id, can_process_pos: true, can_manage_inventory: false, can_view_all_orders: false, can_manage_products: false, can_handle_tickets: false, ...grants }]);
  return { id, email, password };
}
async function removeAccount(id) {
  await sb("DELETE", `/rest/v1/employee_permissions?user_id=eq.${id}`);
  await sb("DELETE", `/rest/v1/users?id=eq.${id}`);
  await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: sbHeaders });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let section = "";
const S = (n) => (section = n);
function rec(name, pass, expected, actual, note) {
  results.push({ section, name, pass, expected, actual: String(actual).slice(0, 140), note });
  console.log(`${pass ? "PASS" : "FAIL"} [${section}] ${name}${pass ? "" : `  expected=${expected} actual=${String(actual).slice(0, 140)}`}`);
}
let raw429 = 0;
async function api(tok, method, path, json, extra = {}) {
  for (let i = 0; i < 4; i++) {
    let r;
    try {
      r = await fetch(B + path, {
        method,
        headers: { ...(json !== undefined && !extra.rawBody ? { "Content-Type": "application/json" } : {}), ...(tok ? { Authorization: "Bearer " + tok } : {}), ...(extra.headers || {}) },
        body: extra.rawBody !== undefined ? extra.rawBody : json === undefined ? undefined : JSON.stringify(json),
      });
    } catch (e) {
      return { s: 0, b: null, h: new Headers(), err: String(e) };
    }
    if (r.status === 429 && !extra.keep429) { raw429++; const ra = Math.min(65, parseInt(r.headers.get("retry-after") || "30", 10) || 30); await sleep((ra + 1) * 1000); continue; }
    let b = null;
    try { b = await r.json(); } catch {}
    await sleep(extra.fast ? 0 : 350);
    return { s: r.status, b, h: r.headers };
  }
  return { s: 429, b: null, h: new Headers() };
}
const login = async (email, password) => (await api(null, "POST", "/auth/login", { email, password })).b?.data?.session?.access_token || null;
const isDenied = (s) => s === 401 || s === 403;
const eq = (name, actual, expected, note) => rec(name, actual === expected, expected, actual, note);
const in_ = (name, actual, list, note) => rec(name, list.includes(actual), list.join("|"), actual, note);

let provisioned = [];
(async () => {
  const adminEmail = process.env.QA_ADMIN_EMAIL, adminPassword = process.env.QA_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) { console.log("Set QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD"); process.exit(2); }
  const qaA = await provisionCashier(`qa.a.${Date.now()}@gts.ng`, { can_void_orders: true, can_apply_discounts: true });
  const qaB = await provisionCashier(`qa.b.${Date.now()}@gts.ng`, {});
  provisioned = [qaA, qaB];
  let admin = await login(adminEmail, adminPassword);
  const A = await login(qaA.email, qaA.password);
  const Bt = await login(qaB.email, qaB.password);
  if (!admin || !A || !Bt) { console.log("login setup failed", !!admin, !!A, !!Bt); process.exit(1); }
  const meA = (await api(A, "GET", "/staff/me")).b.data;
  const meB = (await api(Bt, "GET", "/staff/me")).b.data;
  const meAdmin = (await api(admin, "GET", "/staff/me")).b.data;

  // ───────── AUTHENTICATION
  S("Auth");
  let r = await api(null, "POST", "/auth/login", { email: "nobody@example.com", password: "x" });
  const unknownMsg = r.b?.error; eq("unknown email -> 401", r.s, 401);
  r = await api(null, "POST", "/auth/login", { email: qaA.email, password: "wrong-pass" });
  eq("wrong password -> 401", r.s, 401);
  rec("no user enumeration (same message for unknown email and wrong password)", r.b?.error === unknownMsg, unknownMsg, r.b?.error);
  r = await api(null, "POST", "/auth/login", {}); in_("empty body -> 400", r.s, [400, 401]);
  r = await api(null, "POST", "/auth/login", undefined, { rawBody: "{not json", headers: { "Content-Type": "application/json" } }); rec("malformed JSON is 4xx, not 500", r.s >= 400 && r.s < 500, "4xx", r.s);
  r = await api("garbage.token.value", "GET", "/staff/me"); eq("garbage token -> 401", r.s, 401);
  r = await api(null, "GET", "/staff/me"); eq("no token -> 401", r.s, 401);
  const protectedGets = ["/staff/me", "/staff/me/sales", "/staff/me/activity", "/pos/orders/today", "/pos/whatsapp-orders", "/pos/categories", "/pos/products/search", "/flags", "/users/staff", "/analytics/overview", "/inventory", "/orders"];
  for (const p of protectedGets) { r = await api(null, "GET", p); rec(`anonymous ${p} is refused`, isDenied(r.s), "401/403", r.s); }
  for (const [m, p] of [["POST", "/pos/orders"], ["POST", "/pos/flags"], ["PATCH", "/settings"], ["POST", "/users/staff"], ["PUT", "/storefront/sections"], ["POST", "/upload"], ["POST", "/categories"], ["POST", "/brands"], ["POST", "/broadcast"], ["DELETE", "/broadcast?id=1"]]) {
    r = await api(null, m, p, {}); rec(`anonymous ${m} ${p} is refused`, isDenied(r.s), "401/403", r.s);
  }

  // blocked account is cut off immediately
  r = await api(admin, "PATCH", `/users/${meB.id}`, { is_blocked: true }); eq("admin blocks a cashier", r.s, 200);
  r = await api(Bt, "GET", "/staff/me"); rec("blocked cashier's existing token is refused with ACCOUNT_BLOCKED", r.s === 403 && r.b?.code === "ACCOUNT_BLOCKED", "403 ACCOUNT_BLOCKED", `${r.s} ${r.b?.code}`);
  r = await api(null, "POST", "/auth/login", { email: qaB.email, password: qaB.password }); rec("blocked cashier cannot log in", r.s === 403, 403, r.s);
  r = await api(admin, "PATCH", `/users/${meB.id}`, { is_blocked: false }); eq("admin unblocks", r.s, 200);
  r = await api(Bt, "GET", "/staff/me"); eq("unblocked cashier works again", r.s, 200);

  // ───────── AUTHORIZATION (cashier B: POS only, no void/discount)
  S("Authorization");
  for (const p of ["/flags", "/users/staff", `/users/${meA.id}`, "/analytics/overview", "/inquiries?all=true", "/products/drafts"]) { r = await api(Bt, "GET", p); rec(`cashier GET ${p} denied`, isDenied(r.s), "401/403", r.s); }
  for (const [m, p, body] of [["PATCH", "/settings", { store_name: "hack" }], ["POST", "/users/staff", { email: "z@z.com", full_name: "Z", role: "admin" }], ["PATCH", `/users/${meA.id}`, { is_blocked: true }], ["PUT", "/storefront/sections", {}], ["POST", "/categories", { name: "x" }], ["POST", "/brands", { name: "x" }], ["PATCH", "/flags/00000000-0000-0000-0000-000000000000", { status: "resolved", resolution_note: "x" }]]) {
    r = await api(Bt, m, p, body); rec(`cashier ${m} ${p} denied`, isDenied(r.s), "401/403", r.s);
  }
  for (const [m, p] of [["GET", "/inventory"], ["GET", "/inventory/movements"]]) { r = await api(Bt, m, p); rec(`cashier without the inventory grant: ${m} ${p}`, isDenied(r.s), "401/403", r.s); }
  r = await api(Bt, "GET", "/orders"); rec("cashier without the order grant sees only their own orders (none), never everyone's", r.s === 200 && Array.isArray(r.b?.data) && r.b.data.length === 0, "200 []", `${r.s} n=${r.b?.data?.length}`);
  r = await api(Bt, "GET", "/broadcast"); rec("the public broadcast banner stays readable", r.s === 200, 200, r.s);
  r = await api(Bt, "GET", "/inquiries"); rec("a cashier's /inquiries is their own list, not the inbox", r.s === 200, 200, r.s);

  // Phase 0 / 1 regressions
  S("Security fixes");
  const someUuid = "00000000-0000-4000-8000-000000000000";
  r = await api(null, "PUT", `/inventory/${someUuid}`, { adjustment_type: "set", quantity: 0, reason: "attack" }); rec("anonymous cannot adjust stock", isDenied(r.s), "401/403", r.s);
  r = await api(Bt, "PUT", `/inventory/${someUuid}`, { adjustment_type: "set", quantity: 0, reason: "attack" }); rec("cashier cannot adjust stock", r.s === 403, 403, r.s);
  r = await api(admin, "PUT", "/inventory/not-a-uuid", { adjustment_type: "add", quantity: 1, reason: "x" }); rec("stock adjustment with a bad id is a clean 404", r.s === 404, 404, r.s);
  r = await api(admin, "PUT", `/inventory/${someUuid}`, { adjustment_type: "add", quantity: -5, reason: "x" }); rec("stock adjustment with a negative quantity is refused", r.s === 400, 400, r.s);
  r = await api(admin, "GET", "/inventory"); rec("admin can read inventory", r.s === 200, 200, r.s);
  r = await api(null, "GET", "/storefront/sections"); rec("storefront layout is publicly readable", r.s === 200, 200, r.s);
  r = await api(null, "PUT", "/storefront/sections", { sections: [] }); rec("anonymous cannot change the storefront layout", isDenied(r.s), "401/403", r.s);
  r = await api(Bt, "PUT", "/storefront/sections", { sections: [] }); rec("cashier cannot change the storefront layout", r.s === 403, 403, r.s);
  r = await api(null, "POST", "/upload", {}); rec("anonymous cannot upload", isDenied(r.s), "401/403", r.s);
  r = await api(Bt, "POST", "/upload", {}); rec("cashier cannot upload", r.s === 403, 403, r.s);
  r = await api(null, "POST", "/categories", { name: "qa-anon" }); rec("anonymous cannot create a category", isDenied(r.s), "401/403", r.s);
  r = await api(Bt, "POST", "/categories", { name: "qa-cashier" }); rec("cashier cannot create a category", r.s === 403, 403, r.s);
  r = await api(Bt, "POST", "/brands", { name: "qa-cashier" }); rec("cashier cannot create a brand", r.s === 403, 403, r.s);
  r = await api(null, "POST", "/broadcast", { title: "x" }); rec("anonymous cannot publish a broadcast", isDenied(r.s), "401/403", r.s);
  r = await api(Bt, "DELETE", "/broadcast?id=1"); rec("cashier cannot delete a broadcast", r.s === 403, 403, r.s);
  r = await api(Bt, "PUT", `/orders/${someUuid}/status`, { status: "processing" }); rec("cashier cannot change an order's status", r.s === 403, 403, r.s);
  r = await api(Bt, "PATCH", `/inquiries/${someUuid}/status`, { status: "closed" }); rec("cashier cannot change an inquiry's status", r.s === 403, 403, r.s);
  r = await api(null, "GET", "/products/drafts"); rec("anonymous cannot list product drafts", isDenied(r.s), "401/403", r.s);
  const listed = (await api(null, "GET", "/products?limit=5")).b?.data || [];
  for (const p of listed.slice(0, 3)) {
    const d = await api(null, "GET", "/products/" + p.slug);
    rec(`public product detail for "${p.slug}" carries no cost fields`, d.s === 200 && !/cost|margin|profit/i.test(JSON.stringify(d.b)), "no cost", d.s);
  }
  const ad = await api(admin, "GET", "/products/" + (listed[0]?.slug || "x"));
  rec("an admin still sees the cost in product detail (the editor needs it)", ad.s === 200 && "cost_price" in (ad.b?.data || {}), "cost_price present", ad.s);
  const hook = await api(null, "POST", "/webhooks/paystack", { event: "charge.success", data: { reference: "qa-forged", amount: 100 } });
  rec("unsigned Paystack webhook is never accepted (401, or 500 when unconfigured)", hook.s === 401 || hook.s === 500, "401/500", hook.s);
  const hook2 = await api(null, "POST", "/webhooks/paystack", { event: "charge.success" }, { headers: { "x-paystack-signature": "00" } });
  rec("forged Paystack signature is never accepted", hook2.s === 401 || hook2.s === 500, "401/500", hook2.s);
  for (const p of ["/inventory", "/inventory/movements", "/products/drafts", "/inquiries?all=true"]) { r = await api(null, "GET", p); rec(`anonymous GET ${p} refused`, isDenied(r.s), "401/403", r.s); }
  r = await api(A, "POST", "/users/staff", { email: "z@z.com", full_name: "Z", role: "admin" }); eq("cashier WITH void+discount still cannot add staff", r.s, 403);

  // ───────── POS catalogue
  S("POS catalogue");
  r = await api(A, "GET", "/pos/products/search"); rec("browse with no query lists products", r.s === 200 && r.b.data.length > 0, ">0", `${r.s} n=${r.b?.data?.length}`);
  const products = r.b.data;
  rec("browse includes stock status + variants", !!products[0].stock_status && Array.isArray(products[0].variants), "yes", JSON.stringify(Object.keys(products[0])).slice(0, 100));
  rec("cost_price never leaks to POS search", !JSON.stringify(r.b).includes("cost_price"), "absent", "checked");
  r = await api(A, "GET", "/pos/products/search?limit=1000"); rec("limit capped at 60", r.b.data.length <= 60, "<=60", r.b.data.length);
  r = await api(A, "GET", "/pos/products/search?page=9999"); rec("page beyond the end -> empty, 200", r.s === 200 && r.b.data.length === 0, "200 empty", `${r.s} ${r.b?.data?.length}`);
  r = await api(A, "GET", "/pos/products/search?page=-3&limit=abc"); eq("junk paging params tolerated", r.s, 200);
  r = await api(A, "GET", "/pos/products/search?category=does-not-exist"); rec("unknown category -> empty list", r.s === 200 && r.b.data.length === 0, "empty", `${r.s} ${r.b?.data?.length}`);
  for (const q of ["a,b)%", "';drop table products;--", '"quoted"', "%%%", "*", "\\", "x".repeat(500)]) { r = await api(A, "GET", "/pos/products/search?q=" + encodeURIComponent(q)); rec(`search survives hostile query ${JSON.stringify(q).slice(0, 30)}`, r.s === 200, 200, r.s, "filter/SQL injection probe"); }
  r = await api(A, "GET", "/pos/products/search?q=" + encodeURIComponent(products[0].name.split(" ")[0])); rec("search by name finds product", r.s === 200 && r.b.data.length > 0, ">0", r.b?.data?.length);
  const sku = products.flatMap((p) => p.variants).find((v) => v.sku)?.sku;
  if (sku) { r = await api(A, "GET", "/pos/products/" + encodeURIComponent(sku)); rec("lookup by SKU", r.s === 200, 200, r.s); }
  r = await api(A, "GET", "/pos/products/NOPE-000"); eq("unknown SKU -> 404", r.s, 404);
  r = await api(A, "GET", "/pos/products/" + encodeURIComponent("x') or 1=1--")); in_("SKU injection probe not 500", r.s, [400, 404]);
  r = await api(A, "GET", "/pos/categories"); rec("categories list", r.s === 200 && r.b.data.length > 0, ">0", r.b?.data?.length);
  r = await api(A, "GET", "/pos/products/search?limit=60"); const forEach = r.b.data;
  rec("no stock badge lies (available never negative)", forEach.every((p) => p.variants.every((v) => v.available >= 0)), "all >=0", "checked");

  // pick a normal in-stock variant with plenty of stock
  const all = (await api(A, "GET", "/pos/products/search?limit=60")).b.data;
  const flat = all.flatMap((p) => p.variants.map((v) => ({ p, v })));
  const big = flat.find((x) => x.v.available >= 5);
  const avail = async (variantId) => {
    const rr = await api(A, "GET", "/pos/products/search?limit=60"); const f = (rr.b?.data || []).flatMap((p) => p.variants).find((v) => v.id === variantId); return f?.available;
  };

  // ───────── POS sales
  S("POS sales");
  const item = (q = 1) => [{ variant_id: big.v.id, quantity: q }];
  const unit = big.p.base_price + big.v.price_modifier;
  for (const [name, body] of [
    ["missing items", { payment_method: "cash" }],
    ["empty items", { items: [], payment_method: "cash" }],
    ["quantity 0", { items: item(0), payment_method: "cash" }],
    ["negative quantity", { items: item(-2), payment_method: "cash" }],
    ["fractional quantity", { items: item(1.5), payment_method: "cash" }],
    ["string quantity", { items: [{ variant_id: big.v.id, quantity: "2" }], payment_method: "cash" }],
    ["invalid payment method", { items: item(), payment_method: "bitcoin" }],
    ["missing payment method", { items: item() }],
    ["unknown variant", { items: [{ variant_id: "00000000-0000-0000-0000-000000000000", quantity: 1 }], payment_method: "cash" }],
    ["non-uuid variant", { items: [{ variant_id: "abc", quantity: 1 }], payment_method: "cash" }],
    ["negative discount", { items: item(), payment_method: "cash", manual_discount: -100 }],
    ["fractional discount (kobo must be integer)", { items: item(), payment_method: "cash", manual_discount: 10.5 }],
    ["string discount", { items: item(), payment_method: "cash", manual_discount: "abc" }],
  ]) { r = await api(A, "POST", "/pos/orders", body); rec(`sale rejected: ${name}`, r.s >= 400 && r.s < 500, "4xx", `${r.s} ${r.b?.code || ""}`); }
  r = await api(A, "POST", "/pos/orders", { items: item(big.v.available + 50), payment_method: "cash" }); rec("cannot sell more than in stock", r.s === 409 || r.s === 400, "409/400", `${r.s} ${r.b?.code}`);
  r = await api(A, "POST", "/pos/orders", { items: item(1_000_000_000), payment_method: "cash" }); rec("absurd quantity rejected safely", r.s >= 400 && r.s < 500, "4xx", r.s);
  r = await api(A, "POST", "/pos/orders", undefined, { rawBody: "{", headers: { "Content-Type": "application/json" } }); rec("malformed sale JSON -> 4xx", r.s >= 400 && r.s < 500, "4xx", r.s);

  const before = await avail(big.v.id);
  r = await api(A, "POST", "/pos/orders", { items: item(2), payment_method: "cash" });
  rec("normal sale completes", r.s === 200 || r.s === 201, "200/201", r.s);
  const sale1 = r.b.data; const id1 = sale1.order_id || sale1.id;
  rec("sale total = qty x price", sale1.total === unit * 2, unit * 2, sale1.total);
  rec("order number format GTS-YYYYMM-NNNNNN", /^GTS-\d{6}-\d{6}$/.test(sale1.order_number), "GTS-YYYYMM-NNNNNN", sale1.order_number);
  const afterSale = await avail(big.v.id); eq("stock reduced by exactly the quantity sold", before - afterSale, 2);
  r = await api(A, "GET", "/pos/orders/today"); rec("today's orders lists the sale", r.s === 200 && r.b.data.some((o) => o.id === id1), "present", r.s);
  r = await api(Bt, "GET", "/pos/orders/today"); rec("another cashier does NOT see it in their today list", !r.b.data.some((o) => o.id === id1), "absent", "checked");
  r = await api(Bt, "GET", `/pos/orders/${id1}/receipt`); rec("another cashier cannot reprint it", r.s === 403, 403, `${r.s} ${r.b?.code}`);
  r = await api(A, "GET", `/pos/orders/${id1}/receipt`); rec("owner can reprint (duplicate flagged)", r.s === 200 && r.b.data.duplicate === true, "200 duplicate", r.s);
  r = await api(A, "GET", `/pos/orders/${"00000000-0000-0000-0000-000000000000"}/receipt`); eq("reprint unknown order -> 404", r.s, 404);
  r = await api(A, "GET", `/pos/orders/not-a-uuid/receipt`); rec("reprint non-uuid id doesn't 500", r.s < 500, "<500", r.s);
  r = await api(Bt, "PUT", `/pos/orders/${id1}/void`, { reason: "steal" }); rec("cashier without void grant cannot void", r.s === 403, 403, `${r.s} ${r.b?.code}`);
  r = await api(A, "PUT", `/pos/orders/${id1}/void`, {}); rec("void requires a reason", r.s === 400, 400, `${r.s} ${r.b?.code}`);
  r = await api(A, "PUT", `/pos/orders/${id1}/void`, { reason: "QA void" }); eq("owner voids own sale", r.s, 200);
  eq("void restores stock exactly", await avail(big.v.id), before);
  r = await api(A, "PUT", `/pos/orders/${id1}/void`, { reason: "again" }); rec("double void refused (409)", r.s === 409, 409, `${r.s} ${r.b?.code}`);
  r = await api(A, "GET", `/pos/orders/${id1}/receipt`); rec("voided sale cannot be reprinted", r.s === 409, 409, r.s);

  // discount rules
  const sub = unit * 2;
  r = await api(Bt, "POST", "/pos/orders", { items: item(2), payment_method: "cash", manual_discount: 100 }); rec("cashier without discount grant refused", r.s === 403, 403, `${r.s} ${r.b?.code}`);
  r = await api(A, "POST", "/pos/orders", { items: item(2), payment_method: "cash", manual_discount: Math.floor(sub * 0.2) + 1 }); rec("cashier > 20% refused", r.s === 403 && r.b?.code === "DISCOUNT_LIMIT_EXCEEDED", "403 LIMIT", `${r.s} ${r.b?.code}`);
  eq("refused discount does not touch stock", await avail(big.v.id), before);
  r = await api(A, "POST", "/pos/orders", { items: item(2), payment_method: "cash", manual_discount: Math.floor(sub * 0.2) }); rec("cashier exactly 20% allowed", r.s === 200 || r.s === 201, "200/201", r.s);
  const id2 = r.b?.data?.order_id || r.b?.data?.id; rec("discount reflected in total", r.b?.data?.total === sub - Math.floor(sub * 0.2), sub - Math.floor(sub * 0.2), r.b?.data?.total);
  r = await api(admin, "PUT", `/pos/orders/${id2}/void`, { reason: "QA cleanup by admin" }); rec("admin can void anyone's sale", r.s === 200, 200, `${r.s} ${r.b?.code}`);
  r = await api(admin, "POST", "/pos/orders", { items: item(1), payment_method: "pos_terminal", manual_discount: Math.floor(unit * 0.5) }); rec("admin may exceed 20%", r.s === 200 || r.s === 201, "200/201", `${r.s} ${r.b?.code}`);
  const id3 = r.b?.data?.order_id || r.b?.data?.id;
  r = await api(A, "PUT", `/pos/orders/${id3}/void`, { reason: "not mine" }); rec("cashier cannot void an admin's sale", r.s === 403, 403, `${r.s} ${r.b?.code}`);
  await api(admin, "PUT", `/pos/orders/${id3}/void`, { reason: "QA cleanup" });
  r = await api(A, "POST", "/pos/orders", { items: item(1), payment_method: "cash", manual_discount: unit + 1 }); rec("discount larger than the sale refused", r.s >= 400 && r.s < 500, "4xx", `${r.s} ${r.b?.code}`);
  eq("stock intact after all discount tests", await avail(big.v.id), before);

  // concurrency: last units
  S("Concurrency"); await sleep(62000);
  const scarce = flat.filter((x) => x.v.available >= 1 && x.v.available <= 3).sort((a, b) => a.v.available - b.v.available)[0];
  if (scarce) {
    const n = scarce.v.available; const tries = n + 3;
    const sold = await Promise.all(Array.from({ length: tries }, () => api(A, "POST", "/pos/orders", { items: [{ variant_id: scarce.v.id, quantity: 1 }], payment_method: "cash" }, { keep429: true, fast: true })));
    const okc = sold.filter((x) => x.s === 200 || x.s === 201); const rejected = sold.filter((x) => x.s === 409 || x.s === 400); const limited = sold.filter((x) => x.s === 429);
    rec(`${tries} parallel sales of ${n} remaining unit(s): never oversold`, okc.length <= n, `<=${n} succeed`, `${okc.length} succeeded, ${rejected.length} refused, ${limited.length} rate-limited`, limited.length ? "rate limiter interfered" : "");
    rec("no server errors under the race", sold.every((x) => x.s < 500), "no 5xx", sold.map((x) => x.s).join(","));
    for (const o of okc) await api(admin, "PUT", `/pos/orders/${o.b.data.order_id || o.b.data.id}/void`, { reason: "QA race cleanup" });
    await sleep(500);
    eq("stock fully restored after the race", await avail(scarce.v.id), n);
  } else rec("scarce variant available for race test", false, "one", "none found", "SKIPPED: no variant with 1-3 units");

  // ───────── WhatsApp flow
  S("WhatsApp orders"); await sleep(62000);
  r = await api(A, "POST", "/pos/whatsapp-orders", { items: item(1) }); rec("create needs customer name+phone", r.s === 400, 400, `${r.s} ${r.b?.code}`);
  const wBefore = await avail(big.v.id);
  r = await api(A, "POST", "/pos/whatsapp-orders", { items: item(2), customer_name: "QA Customer", customer_phone: "08031234567" });
  rec("create WhatsApp order", r.s === 200 || r.s === 201, "200/201", `${r.s} ${r.b?.code}`);
  const wo = r.b?.data; const woId = wo?.order_id || wo?.id; const woNum = wo?.order_number;
  eq("stock is reserved (available drops) at creation", wBefore - (await avail(big.v.id)), 2);
  r = await api(Bt, "GET", "/pos/whatsapp-orders"); rec("any cashier sees pending order in list", r.b?.data?.some((o) => o.order_number === woNum), "listed", r.s);
  r = await api(Bt, "GET", "/pos/whatsapp-orders/" + woNum); rec("lookup by order number", r.s === 200, 200, r.s);
  r = await api(Bt, "GET", "/pos/whatsapp-orders/GTS-000000-000000"); eq("lookup unknown number -> 404", r.s, 404);
  r = await api(Bt, "POST", `/pos/whatsapp-orders/${woId}/confirm`, { payment_method: "gold" }); eq("confirm with bad payment method -> 400", r.s, 400);
  const race = await Promise.all([
    api(A, "POST", `/pos/whatsapp-orders/${woId}/confirm`, { payment_method: "cash" }, { keep429: true, fast: true }),
    api(Bt, "PUT", `/pos/whatsapp-orders/${woId}/cancel`, { reason: "race" }, { keep429: true, fast: true }),
  ]);
  const wins = race.filter((x) => x.s === 200).length;
  rec("confirm vs cancel race: exactly one wins", wins === 1, "1 winner", race.map((x) => `${x.s}:${x.b?.code || ""}`).join(" | "), race.some((x) => x.s === 429) ? "rate limiter interfered" : "");
  await sleep(600);
  const wAfter = await avail(big.v.id);
  const confirmWon = race[0].s === 200;
  rec("stock consistent with whichever won", confirmWon ? wBefore - wAfter === 2 : wAfter === wBefore, confirmWon ? "sold: -2" : "restored", `before=${wBefore} after=${wAfter} confirmWon=${confirmWon}`);
  r = await api(A, "POST", `/pos/whatsapp-orders/${woId}/confirm`, { payment_method: "cash" }); rec("double confirm refused", r.s === 409, 409, `${r.s} ${r.b?.code}`);
  r = await api(A, "PUT", `/pos/whatsapp-orders/${woId}/cancel`, { reason: "again" }); rec("cancel after finish refused", r.s === 409, 409, `${r.s} ${r.b?.code}`);
  if (confirmWon) { r = await api(admin, "PUT", `/pos/orders/${woId}/void`, { reason: "QA cleanup" }); rec("admin voids confirmed WhatsApp sale and stock returns", r.s === 200 && (await avail(big.v.id)) === wBefore, "restored", `${r.s} avail=${await avail(big.v.id)}`); }

  // ───────── Flags
  S("Product flags");
  const fp = big.p;
  r = await api(A, "POST", "/pos/flags", { product_id: fp.id, reason: "nonsense" }); eq("invalid reason -> 400", r.s, 400);
  r = await api(A, "POST", "/pos/flags", { product_id: fp.id, reason: "other" }); rec("'other' without a note -> 400", r.s === 400, 400, r.s);
  r = await api(A, "POST", "/pos/flags", { product_id: fp.id, reason: "damaged", note: "x".repeat(501) }); eq("note over 500 chars -> 400", r.s, 400);
  r = await api(A, "POST", "/pos/flags", { product_id: "00000000-0000-0000-0000-000000000000", reason: "damaged" }); rec("flag on unknown product -> 404", r.s === 404, 404, `${r.s} ${r.b?.code}`);
  r = await api(A, "POST", "/pos/flags", { product_id: fp.id, variant_id: all.flatMap((p) => p.variants).find((v) => !fp.variants.some((x) => x.id === v.id)).id, reason: "damaged" }); rec("variant from a different product rejected", r.s === 400, 400, `${r.s} ${r.b?.code}`);
  r = await api(A, "POST", "/pos/flags", { product_id: fp.id, reason: "damaged", note: "<script>alert(1)</script> QA flag" }); eq("valid flag created", r.s, 201);
  const flagId = r.b?.data?.id;
  r = await api(A, "POST", "/pos/flags", { product_id: fp.id, reason: "damaged" }); rec("duplicate open flag -> 409", r.s === 409, 409, `${r.s} ${r.b?.code}`);
  r = await api(A, "GET", "/pos/flags"); rec("cashier sees own flags", r.s === 200 && r.b.data.some((f) => f.id === flagId), "listed", r.s);
  r = await api(Bt, "GET", "/pos/flags"); rec("cashier B does not see A's flags", !r.b.data.some((f) => f.id === flagId), "absent", "checked");
  r = await api(admin, "GET", "/flags?status=bogus"); eq("admin queue: bad status -> 400", r.s, 400);
  r = await api(admin, "PATCH", `/flags/${flagId}`, { status: "resolved" }); rec("closing without a note -> 400", r.s === 400, 400, r.s);
  r = await api(admin, "PATCH", `/flags/${flagId}`, { status: "in_review" }); eq("admin start review", r.s, 200);
  r = await api(admin, "PATCH", `/flags/${flagId}`, { status: "resolved", resolution_note: "QA done" }); eq("admin resolves with note", r.s, 200);
  r = await api(admin, "PATCH", `/flags/${"00000000-0000-0000-0000-000000000000"}`, { status: "in_review" }); eq("update unknown flag -> 404", r.s, 404);

  // ───────── Profile / self-service
  S("Profile");
  r = await api(A, "PATCH", "/staff/me", { phone: "abc" }); eq("invalid phone -> 400", r.s, 400);
  r = await api(A, "PATCH", "/staff/me", { phone: "0803 123 4567" }); eq("valid phone saved", r.s, 200);
  r = await api(A, "PATCH", "/staff/me", { phone: null }); eq("phone can be cleared", r.s, 200);
  r = await api(A, "PATCH", "/staff/me", { role: "admin", full_name: "Hacker" }); rec("cannot escalate role via profile PATCH", (await api(A, "GET", "/staff/me")).b.data.role === "cashier", "still cashier", "checked");
  r = await api(A, "POST", "/staff/me/password", { current_password: "nope", new_password: "Abcdefg1x", confirm_password: "Abcdefg1x" }); rec("wrong current password is 400 (does not sign the user out)", r.s === 400, 400, r.s);
  r = await api(A, "POST", "/staff/me/password", { current_password: qaA.password, new_password: "short", confirm_password: "short" }); eq("weak new password -> 400", r.s, 400);
  r = await api(A, "GET", "/staff/me/sales?range=week"); eq("own sales summary", r.s, 200);
  r = await api(A, "GET", "/staff/me/sales?range=forever"); eq("bad range -> 400", r.s, 400);
  r = await api(A, "GET", "/staff/me/activity"); rec("own activity has entries", r.s === 200 && r.b.data.length > 0, ">0", r.b?.data?.length);
  rec("activity never contains a password", !JSON.stringify(r.b).toLowerCase().includes(String(qaA.password).toLowerCase()), "absent", "checked");

  // ───────── Admin / staff management
  S("Admin & staff");
  admin = (await login(adminEmail, adminPassword)) || admin; // tokens expire during a long run
  r = await api(admin, "GET", `/users/${meA.id}?range=today`); rec("admin views a cashier's record", r.s === 200 && r.b.data.profile.email === qaA.email, "profile", r.s);
  r = await api(admin, "GET", `/users/${meA.id}?range=forever`); eq("bad range -> 400", r.s, 400);
  r = await api(admin, "GET", `/users/00000000-0000-0000-0000-000000000000`); eq("unknown staff -> 404", r.s, 404);
  r = await api(admin, "PATCH", `/users/${meA.id}`, {}); eq("PATCH with nothing -> 400", r.s, 400);
  r = await api(admin, "PATCH", `/users/${meA.id}`, { permissions: { can_void_orders: "yes" } }); eq("non-boolean permission -> 400", r.s, 400);
  r = await api(admin, "PATCH", `/users/${meAdmin.id}`, { is_blocked: true }); rec("admin cannot block themselves", r.s === 400 && r.b?.code === "CANNOT_BLOCK_SELF", "CANNOT_BLOCK_SELF", `${r.s} ${r.b?.code}`);
  r = await api(admin, "PATCH", `/users/${meA.id}`, { permissions: { can_apply_discounts: false } }); eq("admin revokes a permission", r.s, 200);
  r = await api(A, "POST", "/pos/orders", { items: item(1), payment_method: "cash", manual_discount: 100 }); rec("revocation takes effect on the very next request", r.s === 403, 403, r.s);
  await api(admin, "PATCH", `/users/${meA.id}`, { permissions: { can_apply_discounts: true } });
  r = await api(admin, "PATCH", `/users/${meB.id}`, { permissions: { can_process_pos: false } }); await api(Bt, "GET", "/pos/categories").then((x) => rec("revoking POS access closes the terminal immediately", x.s === 403, 403, x.s));
  await api(admin, "PATCH", `/users/${meB.id}`, { permissions: { can_process_pos: true } });
  r = await api(admin, "POST", "/users/staff", { email: qaA.email, full_name: "Dup", role: "cashier" }); rec("adding an existing email -> 409", r.s === 409, 409, `${r.s} ${r.b?.code}`);
  r = await api(admin, "POST", "/users/staff", { email: "bad", full_name: "", role: "customer" }); rec("bad new-staff input -> 400 with field errors", r.s === 400 && r.b?.details, "400 details", `${r.s}`);
  r = await api(admin, "POST", "/users/staff", { email: "z@z.com", full_name: "Z", role: "super_admin" }); rec("cannot create a role that doesn't exist", r.s === 400, 400, r.s);
  r = await api(admin, "GET", "/users/staff"); rec("staff list excludes customers", r.s === 200 && r.b.data.every((u) => u.role !== "customer"), "no customers", r.s);
  rec("staff list never exposes password hashes/secrets", !/password|secret|token/i.test(JSON.stringify(r.b)), "absent", "checked");
  r = await api(admin, "GET", "/settings"); rec("settings GET responds", r.s === 200, 200, r.s);
  rec("settings GET leaks no secrets", !/secret|service_role|api_key|password/i.test(JSON.stringify(r.b)), "absent", "checked");
  r = await api(admin, "PATCH", "/settings", { store_phone: "x".repeat(500) }); rec("settings PATCH rejects absurd input", r.s >= 400 && r.s < 500, "4xx", r.s);

  // ───────── Public storefront API + transport security
  S("Public / security");
  r = await api(null, "GET", "/products?limit=20"); rec("public products list", r.s === 200, 200, r.s);
  rec("cost_price never in public products", !JSON.stringify(r.b).includes("cost_price"), "absent", "checked");
  const slug = r.b?.data?.[0]?.slug; if (slug) { const d = await api(null, "GET", "/products/" + slug); rec("public product detail", d.s === 200, 200, d.s); rec("cost_price not in product detail", !JSON.stringify(d.b).includes("cost_price"), "absent", "checked"); }
  r = await api(null, "GET", "/products/does-not-exist-xyz"); eq("unknown slug -> 404", r.s, 404);
  r = await api(null, "GET", "/products/search?q=" + encodeURIComponent("';--")); rec("public search survives injection probe", r.s < 500, "<500", r.s);
  r = await api(null, "GET", "/categories"); eq("public categories", r.s, 200);
  r = await api(null, "GET", "/settings"); rec("public settings expose only safe columns", r.s === 200 && !/service|secret/i.test(JSON.stringify(r.b)), "safe", r.s);
  r = await api(null, "GET", "/orders/track"); rec("track without order number+email refused", r.s >= 400 && r.s < 500, "4xx", r.s);
  r = await api(null, "GET", "/orders/track?order_number=GTS-202609-000001&email=wrong@example.com"); rec("track with wrong email does not reveal the order", r.s === 404 || r.s === 400, "404/400", r.s);
  r = await api(null, "POST", "/webhooks/paystack", { event: "charge.success", data: { reference: "x" } }); rec("Paystack webhook without signature rejected", [400, 401, 403, 500].includes(r.s), "4xx or 500-unconfigured", r.s);
  r = await api(null, "POST", "/webhooks/paystack", { event: "charge.success" }, { headers: { "x-paystack-signature": "deadbeef" } }); rec("Paystack webhook with forged signature rejected", [400, 401, 403, 500].includes(r.s), "4xx or 500-unconfigured", r.s);
  const pre = await fetch(B + "/auth/login", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
  rec("CORS: evil origin is not allowed", pre.headers.get("access-control-allow-origin") !== "https://evil.example" && pre.headers.get("access-control-allow-origin") !== "*", "not allowed", pre.headers.get("access-control-allow-origin"));
  const home = await fetch(B + "/products?limit=1");
  for (const h of ["content-security-policy", "x-content-type-options", "x-frame-options", "strict-transport-security", "referrer-policy"]) rec(`security header present: ${h}`, !!home.headers.get(h), "present", home.headers.get(h) ? "yes" : "missing", "dev server; HSTS is normally production-only");
  r = await api(A, "GET", "/pos/products/search", undefined, { headers: { Authorization: "Bearer " + A + "x" } }); rec("tampered token rejected", r.s === 401, 401, r.s);

  // brute-force / rate limit (last: may throttle us)
  S("Rate limiting");
  const burst = await Promise.all(Array.from({ length: 25 }, () => api(null, "POST", "/auth/login", { email: "ratelimit@example.com", password: "x" }, { keep429: true, fast: true })));
  rec("login brute-force is throttled (some 429 within 25 rapid attempts)", burst.some((x) => x.s === 429), "some 429", `statuses: ${[...new Set(burst.map((x) => x.s))].join(",")}`);

  console.log("\nSUMMARY", results.filter((x) => x.pass).length, "pass /", results.filter((x) => !x.pass).length, "fail /", results.length, "total; 429 retries:", raw429);
})().catch((e) => { console.error("HARNESS ERROR", e); })
  .finally(async () => {
    for (const a of provisioned) await removeAccount(a.id);
    const out = process.env.QA_RESULTS_FILE || path.resolve(__dirname, "../../.qa-results.json");
    fs.writeFileSync(out, JSON.stringify(results, null, 1));
    process.exit(results.some((r) => !r.pass) ? 1 : 0);
  });
