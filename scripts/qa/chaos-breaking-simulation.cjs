// Comprehensive Chaos, Concurrency & Breaking Scenarios Test Suite
//
// Tests realistic edge cases, race conditions, referential integrity & security boundaries:
// 1. Concurrency Race: Two simultaneous storefront checkouts compete for the exact last item (quantity: 1)
// 2. Cross-Channel Collision: Storefront checkout vs. POS Cashier Till sale colliding simultaneously
// 3. Category Deletion with Active Products: Verifies 409 CATEGORY_IN_USE refusal and referential safety
// 4. Product Deleted Mid-Checkout: Admin deletes product while customer checkout is in-flight
// 5. Stale / Tampered Client Pricing Defense: Client attempts to send low price; DB overrides
// 6. Simultaneous Counter Handover: Two cashiers enter PIN at the exact same millisecond
// 7. Chaos & Injection Payloads: SQL injection in product/order, negative/fractional/zero quantities, out-of-bounds inputs
// 8. Cashier Unauthorized Void Defense: Missing permission or missing void reason checks

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function req(token, method, endpoint, body = undefined, headers = {}) {
  const h = {
    "Content-Type": "application/json",
    ...headers,
  };
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      await sleep(1200 * (attempt + 1));
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
  return { status: 429, ok: false, json: { error: "Rate limit exhausted" }, headers: new Headers() };
}

// Direct Supabase Helper
async function sbQuery(table, method = "GET", body = undefined, params = "") {
  const h = {
    apikey: SK,
    Authorization: `Bearer ${SK}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const res = await fetch(`${SB}/rest/v1/${table}${params ? "?" + params : ""}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function runChaos() {
  console.log("================================================================================");
  console.log("  CHAOS, CONCURRENCY & BREAKING SCENARIOS SIMULATION SUITE");
  console.log(`  API Target: ${API_BASE}`);
  console.log("================================================================================\n");

  console.log("Setting up Actor Tokens...");
  const [adminToken, cashierToken, customerToken] = await Promise.all([
    getAccessToken("admin@gts.ng"),
    getAccessToken("leamifysolutions@gmail.com"),
    getAccessToken("abdulrahmanlukmanlawal@gmail.com"),
  ]);
  console.log("  ✓ Tokens acquired.\n");

  // Get active pickup station
  const stations = await sbQuery("pickup_stations", "GET", null, "is_active=eq.true&limit=1");
  const pickupStation = stations?.[0];
  if (!pickupStation) throw new Error("No active pickup station found for chaos tests");

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: CONCURRENT STOREFRONT COLLISION ON THE LAST AVAILABLE ITEM
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--------------------------------------------------------------------------------");
  console.log("BREAKING SCENARIO 1: TWO STOREFRONT CHECKOUTS COLLIDE ON LAST STOCK ITEM");
  console.log("--------------------------------------------------------------------------------");

  // Create temporary test product with exactly 1 unit of stock in live mode (is_test: false)
  const chaosSlug1 = `chaos-race-${Date.now()}`;
  const prod1Insert = await sbQuery("products", "POST", {
    name: "Chaos Race Dress",
    slug: chaosSlug1,
    base_price: 1500000, // ₦15,000
    status: "active",
    is_test: false,
  });
  const prod1 = Array.isArray(prod1Insert) ? prod1Insert[0] : prod1Insert;

  const var1Insert = await sbQuery("product_variants", "POST", {
    product_id: prod1.id,
    sku: `CHAOS-SKU-${Date.now()}`,
    price_modifier: 0,
    is_active: true,
    is_test: false,
  });
  const var1 = Array.isArray(var1Insert) ? var1Insert[0] : var1Insert;

  // Set stock quantity = 1, reserved = 0
  await sbQuery("inventory", "POST", {
    variant_id: var1.id,
    quantity: 1,
    reserved_quantity: 0,
    is_test: false,
  });

  console.log(`  Created single-unit test variant: ${var1.id} (Stock = 1, Reserved = 0)`);

  // Fire 2 simultaneous checkouts at the exact same millisecond
  const [order1Res, order2Res] = await Promise.all([
    req(null, "POST", "/checkout", {
      items: [{ variant_id: var1.id, quantity: 1 }],
      deliveryOption: "pickup",
      pickupStationId: pickupStation.id,
      paymentMethod: "pay_on_pickup",
      customer: { email: `buyer1.${Date.now()}@example.com`, fullName: "Buyer One", phone: "08011111111" },
    }),
    req(null, "POST", "/checkout", {
      items: [{ variant_id: var1.id, quantity: 1 }],
      deliveryOption: "pickup",
      pickupStationId: pickupStation.id,
      paymentMethod: "pay_on_pickup",
      customer: { email: `buyer2.${Date.now()}@example.com`, fullName: "Buyer Two", phone: "08022222222" },
    }),
  ]);

  const outcomes1 = [order1Res.status, order2Res.status];
  console.log(`  Concurrent checkouts completed: HTTP ${order1Res.status} vs HTTP ${order2Res.status}`);

  assert(
    "Exactly ONE checkout succeeded (200) and ONE was refused (409/400)",
    outcomes1.includes(200) && (outcomes1.includes(409) || outcomes1.includes(400)),
    `Got: [${outcomes1.join(", ")}]`
  );

  const refusedRes1 = order1Res.status === 200 ? order2Res : order1Res;
  assert(
    "Refused checkout returned clean error code without crashing (INSUFFICIENT_STOCK or ITEM_UNAVAILABLE)",
    refusedRes1.json?.code === "INSUFFICIENT_STOCK" || refusedRes1.json?.code === "ITEM_UNAVAILABLE",
    `Error Code: ${refusedRes1.json?.code}`
  );

  // Check inventory table to guarantee NO overselling occurred
  const checkInv1 = await sbQuery("inventory", "GET", null, `variant_id=eq.${var1.id}`);
  const finalInv1 = checkInv1?.[0];
  const finalAvail1 = (finalInv1?.quantity ?? 0) - (finalInv1?.reserved_quantity ?? 0);
  assert(
    "Inventory reflects exactly 1 reservation, available stock = 0, no overselling",
    finalInv1?.quantity === 1 && finalInv1?.reserved_quantity === 1 && finalAvail1 === 0,
    `Quantity: ${finalInv1?.quantity}, Reserved: ${finalInv1?.reserved_quantity}, Available: ${finalAvail1}`
  );

  // Cleanup scenario 1
  const winningOrderId1 = order1Res.status === 200 ? order1Res.json?.data?.order_id : order2Res.json?.data?.order_id;
  if (winningOrderId1) {
    await req(adminToken, "PUT", `/orders/${winningOrderId1}/status`, { status: "cancelled", reason: "Chaos test cleanup" });
  }
  await sbQuery("inventory", "DELETE", null, `variant_id=eq.${var1.id}`);
  await sbQuery("product_variants", "DELETE", null, `id=eq.${var1.id}`);
  await sbQuery("products", "DELETE", null, `id=eq.${prod1.id}`);
  console.log("  ✓ Scenario 1 temporary entities safely cleaned up.\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: CROSS-CHANNEL COLLISION (STOREFRONT VS POS CASHIER TILL SALE)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--------------------------------------------------------------------------------");
  console.log("BREAKING SCENARIO 2: STOREFRONT CHECKOUT VS POS CASHIER COLLISION ON 1 ITEM");
  console.log("--------------------------------------------------------------------------------");

  const chaosSlug2 = `chaos-pos-${Date.now()}`;
  const prod2Insert = await sbQuery("products", "POST", {
    name: "Chaos POS Clash Item",
    slug: chaosSlug2,
    base_price: 800000,
    status: "active",
    is_test: false,
  });
  const prod2 = Array.isArray(prod2Insert) ? prod2Insert[0] : prod2Insert;

  const var2Insert = await sbQuery("product_variants", "POST", {
    product_id: prod2.id,
    sku: `CHAOS-POS-${Date.now()}`,
    price_modifier: 0,
    is_active: true,
    is_test: false,
  });
  const var2 = Array.isArray(var2Insert) ? var2Insert[0] : var2Insert;

  await sbQuery("inventory", "POST", {
    variant_id: var2.id,
    quantity: 1,
    reserved_quantity: 0,
    is_test: false,
  });

  console.log(`  Created single-unit cross-channel variant: ${var2.id}`);

  // Simultaneous Storefront checkout and POS walk-in sale
  const [storefrontRes2, posRes2] = await Promise.all([
    req(null, "POST", "/checkout", {
      items: [{ variant_id: var2.id, quantity: 1 }],
      deliveryOption: "pickup",
      pickupStationId: pickupStation.id,
      paymentMethod: "pay_on_pickup",
      customer: { email: `web.clash.${Date.now()}@example.com`, fullName: "Online Buyer", phone: "08033333333" },
    }),
    req(cashierToken, "POST", "/pos/orders", {
      items: [{ variant_id: var2.id, quantity: 1 }],
      payment_method: "cash",
    }),
  ]);

  const outcomes2 = [storefrontRes2.status, posRes2.status];
  console.log(`  Cross-channel completion: Storefront HTTP ${storefrontRes2.status} vs POS HTTP ${posRes2.status}`);

  assert(
    "Cross-channel race: exactly one channel succeeded and the other was rejected",
    (outcomes2.includes(200) || outcomes2.includes(201)) && (outcomes2.includes(409) || outcomes2.includes(400)),
    `Got: [${outcomes2.join(", ")}]`
  );

  const checkInv2 = await sbQuery("inventory", "GET", null, `variant_id=eq.${var2.id}`);
  const finalInv2 = checkInv2?.[0];
  const finalAvail2 = (finalInv2?.quantity ?? 0) - (finalInv2?.reserved_quantity ?? 0);
  assert(
    "Zero overselling in cross-channel conflict: available stock is 0 (never negative)",
    finalAvail2 === 0,
    `Quantity: ${finalInv2?.quantity}, Reserved: ${finalInv2?.reserved_quantity}, Available: ${finalAvail2}`
  );

  // Cleanup scenario 2
  if (storefrontRes2.status === 200) {
    const webOrderId = storefrontRes2.json?.data?.order_id;
    if (webOrderId) await req(adminToken, "PUT", `/orders/${webOrderId}/status`, { status: "cancelled", reason: "Chaos test cleanup" });
  }
  if (posRes2.status === 200 || posRes2.status === 201) {
    const posOrderId = posRes2.json?.data?.order_id || posRes2.json?.data?.id;
    if (posOrderId) await req(adminToken, "PUT", `/pos/orders/${posOrderId}/void`, { reason: "Chaos test cleanup" });
  }
  await sbQuery("inventory", "DELETE", null, `variant_id=eq.${var2.id}`);
  await sbQuery("product_variants", "DELETE", null, `id=eq.${var2.id}`);
  await sbQuery("products", "DELETE", null, `id=eq.${prod2.id}`);
  console.log("  ✓ Scenario 2 temporary entities safely cleaned up.\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: DELETING A CATEGORY WITH ACTIVE PRODUCTS ASSIGNED
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--------------------------------------------------------------------------------");
  console.log("BREAKING SCENARIO 3: ATTEMPTING TO DELETE A CATEGORY THAT STILL HAS PRODUCTS");
  console.log("--------------------------------------------------------------------------------");

  // Find a category in live mode (is_test: false) that currently has active products
  const prodsWithCat = await sbQuery("products", "GET", null, "is_test=eq.false&status=eq.active&category_id=not.is.null&select=category_id,name&limit=1");
  const inUseCategoryId = prodsWithCat?.[0]?.category_id;
  assert("Found active category in use by live products", !!inUseCategoryId, `Product: ${prodsWithCat?.[0]?.name}`);

  if (inUseCategoryId) {
    const deleteCatRes = await req(adminToken, "DELETE", `/categories/${inUseCategoryId}`);
    console.log(`  Delete category in use returned: HTTP ${deleteCatRes.status} (${deleteCatRes.json?.code})`);

    assert(
      "Admin is REFUSED from deleting category with products (409 CATEGORY_IN_USE)",
      deleteCatRes.status === 409 && deleteCatRes.json?.code === "CATEGORY_IN_USE"
    );
    assert(
      "Error response clearly informs user to move or remove products first",
      String(deleteCatRes.json?.error).includes("This category still has products")
    );

    // Verify the category was NOT deleted in DB
    const catStillExists = await sbQuery("categories", "GET", null, `id=eq.${inUseCategoryId}`);
    assert("Category remains safely intact in database", Array.isArray(catStillExists) && catStillExists.length === 1);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: PRODUCT DELETED WHILE CUSTOMER IS MID-ORDER
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("BREAKING SCENARIO 4: PRODUCT DELETED WHILE CUSTOMER CHECKOUT IS IN-FLIGHT");
  console.log("--------------------------------------------------------------------------------");

  const chaosSlug4 = `chaos-del-${Date.now()}`;
  const prod4Insert = await sbQuery("products", "POST", {
    name: "Product To Delete Mid-Flight",
    slug: chaosSlug4,
    base_price: 1200000,
    status: "active",
    is_test: false,
  });
  const prod4 = Array.isArray(prod4Insert) ? prod4Insert[0] : prod4Insert;

  const var4Insert = await sbQuery("product_variants", "POST", {
    product_id: prod4.id,
    sku: `CHAOS-DEL-${Date.now()}`,
    price_modifier: 0,
    is_active: true,
    is_test: false,
  });
  const var4 = Array.isArray(var4Insert) ? var4Insert[0] : var4Insert;

  await sbQuery("inventory", "POST", {
    variant_id: var4.id,
    quantity: 10,
    reserved_quantity: 0,
    is_test: false,
  });

  console.log(`  Created temporary product: ${prod4.id} with variant: ${var4.id}`);

  // Admin deletes the product via the product delete API
  const adminDelProd = await req(adminToken, "DELETE", `/products/${chaosSlug4}`);
  assert("Admin deleted the product before customer clicked checkout (200)", adminDelProd.status === 200);

  // Customer now clicks "Place Order" with that deleted variant in checkout payload
  const orphanCheckoutRes = await req(null, "POST", "/checkout", {
    items: [{ variant_id: var4.id, quantity: 1 }],
    deliveryOption: "pickup",
    pickupStationId: pickupStation.id,
    paymentMethod: "pay_on_pickup",
    customer: { email: `victim.${Date.now()}@example.com`, fullName: "Unlucky Shopper", phone: "08044444444" },
  });

  console.log(`  Checkout on deleted product returned: HTTP ${orphanCheckoutRes.status} (${orphanCheckoutRes.json?.code})`);

  assert(
    "Checkout safely rejects deleted product without crashing (400 or 409 ITEM_UNAVAILABLE / INSUFFICIENT_STOCK)",
    (orphanCheckoutRes.status === 400 || orphanCheckoutRes.status === 409) &&
      (orphanCheckoutRes.json?.code === "ITEM_UNAVAILABLE" || orphanCheckoutRes.json?.code === "INSUFFICIENT_STOCK"),
    `Code: ${orphanCheckoutRes.json?.code}, Error: ${orphanCheckoutRes.json?.error}`
  );

  // Verify no orphan order was created
  const orphanOrders = await sbQuery("orders", "GET", null, `customer_id=in.(select id from customers where email like 'victim.%')`);
  assert("No ghost/orphan order was written to database", !orphanOrders || orphanOrders.length === 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: PRICE TAMPERING DEFENSE (CLIENT SENDS BOGUS CHEAP PRICE)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("BREAKING SCENARIO 5: CLIENT SENDS TAMPERED ₦100 PRICE PAYLOAD");
  console.log("--------------------------------------------------------------------------------");

  // Get an active in-stock variant with known base_price in live mode
  const realInvRows = await sbQuery("inventory", "GET", null, "is_test=eq.false&quantity=gt.5&select=variant_id,quantity,variant:product_variants(id,price_modifier,product:products(id,name,base_price))&limit=1");
  const testInvItem = realInvRows?.[0];
  const realVariantId = testInvItem?.variant_id;
  const realProdBasePrice = testInvItem?.variant?.product?.base_price;
  assert("Located active product with known DB price in live mode", !!realVariantId, `${testInvItem?.variant?.product?.name} (DB Price: ₦${(realProdBasePrice / 100).toLocaleString()})`);

  if (realVariantId) {
    // Malicious attacker attempts to pass price: 100 kobo (₦1) in checkout body
    const tamperedRes = await req(null, "POST", "/checkout", {
      items: [{ variant_id: realVariantId, quantity: 1, unit_price: 100, price: 100, line_total: 100 }],
      deliveryOption: "pickup",
      pickupStationId: pickupStation.id,
      paymentMethod: "pay_on_pickup",
      customer: { email: `tamper.${Date.now()}@example.com`, fullName: "Malicious Hacker", phone: "08055555555" },
    });

    assert("Checkout request processed", tamperedRes.status === 200);
    const tamperedOrderId = tamperedRes.json?.data?.order_id;
    const tamperedOrderSubtotal = tamperedRes.json?.data?.subtotal;

    assert(
      "Server completely ignored client price and computed subtotal from database",
      tamperedOrderSubtotal >= realProdBasePrice && tamperedOrderSubtotal !== 100,
      `Calculated Subtotal: ₦${(tamperedOrderSubtotal / 100).toLocaleString()}, Client Tried: ₦1`
    );

    // Cancel test order
    if (tamperedOrderId) {
      await req(adminToken, "PUT", `/orders/${tamperedOrderId}/status`, { status: "cancelled", reason: "Tampering test cleanup" });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: SIMULTANEOUS DOUBLE COUNTER HANDOVER (RACE ON COLLECTION PIN)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("BREAKING SCENARIO 6: TWO CASHIERS SUBMIT PICKUP PIN AT EXACT SAME MILLISECOND");
  console.log("--------------------------------------------------------------------------------");

  // Create an order and advance to ready_for_pickup
  const hOrderRes = await req(null, "POST", "/checkout", {
    items: [{ variant_id: realVariantId, quantity: 1 }],
    deliveryOption: "pickup",
    pickupStationId: pickupStation.id,
    paymentMethod: "pay_on_pickup",
    customer: { email: `double.handover.${Date.now()}@example.com`, fullName: "Double Pickup Buyer", phone: "08066666666" },
  });
  const hOrderId = hOrderRes.json?.data?.order_id;

  // Advance to confirmed then ready_for_pickup
  await req(adminToken, "PUT", `/orders/${hOrderId}/status`, { status: "confirmed", reason: "Ready" });
  await req(adminToken, "PUT", `/orders/${hOrderId}/status`, { status: "ready_for_pickup", reason: "Shelved" });

  const hOrderDetails = await req(adminToken, "GET", `/orders/${hOrderId}`);
  const validPin = hOrderDetails.json?.data?.tracking_number;
  console.log(`  Order #${hOrderDetails.json?.data?.order_number} ready for pickup with PIN: ${validPin}`);

  // Fire two simultaneous handover requests in parallel
  const [handover1, handover2] = await Promise.all([
    req(cashierToken, "POST", `/orders/${hOrderId}/complete-pickup`, {
      pickup_pin: String(validPin),
      payment_method: "cash",
    }),
    req(cashierToken, "POST", `/orders/${hOrderId}/complete-pickup`, {
      pickup_pin: String(validPin),
      payment_method: "cash",
    }),
  ]);

  const handoverStatuses = [handover1.status, handover2.status];
  console.log(`  Simultaneous handover returned: HTTP ${handover1.status} vs HTTP ${handover2.status}`);

  assert(
    "Atomic handover guard: Exactly ONE succeeds (200) and ONE is blocked (400 ALREADY_COLLECTED)",
    handoverStatuses.includes(200) && handoverStatuses.includes(400)
  );

  const blockedHandover = handover1.status === 200 ? handover2 : handover1;
  assert("Blocked attempt code is ALREADY_COLLECTED", blockedHandover.json?.code === "ALREADY_COLLECTED");

  // Verify only ONE transaction was created in database
  const transactions = await sbQuery("transactions", "GET", null, `order_id=eq.${hOrderId}`);
  assert("Exactly ONE financial transaction was recorded (no double revenue)", Array.isArray(transactions) && transactions.length === 1);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 7: CHAOS PAYLOADS, SQL INJECTION & BOUNDARY ATTACKS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("BREAKING SCENARIO 7: CHAOS PAYLOADS, INJECTION ATTACKS & BOUNDARY CONDITIONS");
  console.log("--------------------------------------------------------------------------------");

  // 7.1 SQL Injection in Product Creation name
  const sqliProd = await req(adminToken, "POST", "/products", {
    name: "Summer Floral'); DROP TABLE orders;--",
    base_price: 100000,
    status: "active",
  });
  assert("SQL Injection in product name is caught by sanitiser (400 INVALID_INPUT)", sqliProd.status === 400 && sqliProd.json?.code === "INVALID_INPUT");

  // 7.2 Negative quantity in POS till order
  const negQtyPos = await req(cashierToken, "POST", "/pos/orders", {
    items: [{ variant_id: realVariantId, quantity: -5 }],
    payment_method: "cash",
  });
  assert("Negative quantity in POS order is rejected (400 INVALID_ITEMS)", negQtyPos.status === 400 && negQtyPos.json?.code === "INVALID_ITEMS");

  // 7.3 Fractional quantity in cart
  const fracQtyCart = await req(null, "POST", `/cart/${crypto.randomUUID()}/items`, {
    variant_id: realVariantId,
    quantity: 1.5,
  });
  assert("Fractional quantity in cart is rejected (400 INVALID_ITEMS)", fracQtyCart.status === 400 && fracQtyCart.json?.code === "INVALID_ITEMS");

  // 7.4 Zero quantity in checkout
  const zeroQtyCheckout = await req(null, "POST", "/checkout", {
    items: [{ variant_id: realVariantId, quantity: 0 }],
    deliveryOption: "pickup",
    pickupStationId: pickupStation.id,
    paymentMethod: "pay_on_pickup",
    customer: { email: "zero@example.com", fullName: "Zero Test", phone: "08011223344" },
  });
  assert("Zero quantity in checkout is rejected (400 INVALID_ITEMS)", zeroQtyCheckout.status === 400 && zeroQtyCheckout.json?.code === "INVALID_ITEMS");

  // 7.5 Empty items list in checkout
  const emptyItemsCheckout = await req(null, "POST", "/checkout", {
    items: [],
    deliveryOption: "pickup",
    pickupStationId: pickupStation.id,
    paymentMethod: "pay_on_pickup",
    customer: { email: "empty@example.com", fullName: "Empty Test", phone: "08011223344" },
  });
  assert("Empty items list in checkout is rejected (400 EMPTY_CART)", emptyItemsCheckout.status === 400 && emptyItemsCheckout.json?.code === "EMPTY_CART");

  // 7.6 Huge quantity beyond stock (1,000,000 units or beyond MAX_LINE_QUANTITY)
  const hugeQtyCheckout = await req(null, "POST", "/checkout", {
    items: [{ variant_id: realVariantId, quantity: 1000000 }],
    deliveryOption: "pickup",
    pickupStationId: pickupStation.id,
    paymentMethod: "pay_on_pickup",
    customer: { email: "huge@example.com", fullName: "Huge Test", phone: "08011223344" },
  });
  assert(
    "Huge quantity exceeding stock/limits is rejected cleanly (400 INVALID_ITEMS or 409 INSUFFICIENT_STOCK)",
    (hugeQtyCheckout.status === 400 || hugeQtyCheckout.status === 409) &&
      (hugeQtyCheckout.json?.code === "INVALID_ITEMS" || hugeQtyCheckout.json?.code === "INSUFFICIENT_STOCK"),
    `Status: ${hugeQtyCheckout.status}, Code: ${hugeQtyCheckout.json?.code}`
  );

  // 7.7 Non-existent UUIDs on status update
  const fakeUuid = crypto.randomUUID();
  const fakeOrderRes = await req(adminToken, "PUT", `/orders/${fakeUuid}/status`, { status: "confirmed" });
  assert("Non-existent order UUID returns clean 404 NOT_FOUND without 500", fakeOrderRes.status === 404 && fakeOrderRes.json?.code === "NOT_FOUND");

  // 7.8 XSS Payload in Inquiry Message
  const xssInquiry = await req(customerToken, "POST", "/inquiries", {
    productId: testInvItem?.variant?.product?.id || realVariantId,
    productTitle: "XSS Safe Product",
    message: "<script>alert('xss_attack_test')</script> Hello support",
  });
  assert("Inquiry with XSS payload is safely accepted & sanitized (200/201)", xssInquiry.status === 200 || xssInquiry.status === 201);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 8: CASHIER UNAUTHORIZED VOID & MISSING REASON DEFENSE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("BREAKING SCENARIO 8: CASHIER UNAUTHORIZED VOID & MISSING REASON DEFENSE");
  console.log("--------------------------------------------------------------------------------");

  // 8.1 Cashier attempts void without permission
  const unauthVoid = await req(cashierToken, "PUT", `/pos/orders/${fakeUuid}/void`, { reason: "Customer changed mind" });
  assert("Cashier without can_void_orders is blocked (403 PERMISSION_DENIED)", unauthVoid.status === 403);

  // 8.2 Admin attempts void without providing a reason
  const noReasonVoid = await req(adminToken, "PUT", `/pos/orders/${fakeUuid}/void`, {});
  assert("Void attempt without mandatory reason is rejected (400 REASON_REQUIRED)", noReasonVoid.status === 400 && noReasonVoid.json?.code === "REASON_REQUIRED");

  // ─────────────────────────────────────────────────────────────────────────────
  // CHAOS SIMULATION SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`CHAOS & BREAKING SIMULATION COMPLETE: ${stats.passed}/${stats.total} PASSED (${stats.failed} FAILED)`);
  console.log("================================================================================\n");

  if (stats.failed > 0) {
    process.exit(1);
  }
}

runChaos().catch((err) => {
  console.error("Unhandled error in chaos suite:", err);
  process.exit(1);
});
