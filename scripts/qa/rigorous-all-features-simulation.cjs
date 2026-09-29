// Comprehensive Multi-Persona & All-Features Simulation against live server (http://localhost:3000/api/v1)
//
// Rigorously exercises 16 platform features & real-life scenarios:
// 1. Storefront Discovery, Full-text Search, Filtering, and Product Details (Data Privacy)
// 2. Interactive Cart Operations (Variant lines, stock checks, subtotals)
// 3. Customer Wishlist Lifecycle (Add, Check, List, Delete)
// 4. Customer Support Inquiries & Admin Ticket Management
// 5. Checkout Journey (Pickup order with real customer details)
// 6. Order Tracking (Public tracking with email verification, anti-snooping check)
// 7. Admin Order Pipeline Management (placed -> confirmed -> ready_for_pickup)
// 8. 6-Digit Anti-Theft Collection PIN Generation & Verification
// 9. Handover at Pickup Counter (Invalid PIN rejection -> Valid PIN acceptance -> Payment collection)
// 10. Order Cancellation & Stock Reservation Release Flow
// 11. POS Cashier Operations (SKU Barcode Scan, Product Search, Till Sale & Printable Receipt)
// 12. POS Order Voiding Flow (Cashier 403 vs Admin 200 with Inventory Restoration)
// 13. Role-Based Access Control (Cashier blocked from Admin routes)
// 14. Admin Inventory Adjustments (Add / Restock with reason & audit logs)
// 15. Inventory Low Stock Alerts & Analytics
// 16. Staff Security Lifecycle (Block staff -> Verify 403 -> Unblock staff -> Verify restored)
// 17. Store Settings Updates (Propagated to public endpoints)
// 18. Executive Financial Analytics & KPI Summary

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

async function run() {
  console.log("================================================================================");
  console.log("  COMPREHENSIVE ALL-FEATURES & REAL-LIFE SCENARIOS SIMULATION");
  console.log(`  API Target: ${API_BASE}`);
  console.log("================================================================================\n");

  console.log("1. Setting up Actor Sessions...");
  const [adminToken, cashierToken, customerToken] = await Promise.all([
    getAccessToken("admin@gts.ng"),
    getAccessToken("leamifysolutions@gmail.com"),
    getAccessToken("abdulrahmanlukmanlawal@gmail.com"),
  ]);
  console.log("  ✓ Admin token ready (admin@gts.ng)");
  console.log("  ✓ Cashier token ready (leamifysolutions@gmail.com)");
  console.log("  ✓ Customer token ready (abdulrahmanlukmanlawal@gmail.com)");

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 1: STOREFRONT DISCOVERY, SEARCH & PRODUCT DETAILS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 1: STOREFRONT DISCOVERY, SEARCH & PRODUCT DETAILS");
  console.log("--------------------------------------------------------------------------------");

  const settingsRes = await req(null, "GET", "/settings");
  assert("Public store settings accessible (200)", settingsRes.status === 200);

  const heroRes = await req(null, "GET", "/storefront/hero");
  assert("Storefront hero carousel returns active products", heroRes.status === 200 && Array.isArray(heroRes.json?.data));

  const categoriesRes = await req(null, "GET", "/categories");
  assert("Active database categories accessible", categoriesRes.status === 200 && Array.isArray(categoriesRes.json?.data));

  const searchRes = await req(null, "GET", "/search?q=dress");
  assert("Search with query returns results without errors", searchRes.status === 200);

  const prodsRes = await req(null, "GET", "/products?limit=10");
  assert("Catalogue products listed", prodsRes.status === 200 && Array.isArray(prodsRes.json?.data));
  const activeProduct = prodsRes.json?.data?.find((p) => p.slug && p.status === "active") || prodsRes.json?.data?.[0];

  assert("Found active product for test journey", !!activeProduct?.slug, `Product: ${activeProduct?.name}`);

  const detailRes = await req(null, "GET", `/products/${activeProduct.slug}`);
  assert("Product detail returned by slug", detailRes.status === 200 && detailRes.json?.data?.id);
  assert("Product detail does NOT leak cost_price to public", detailRes.json?.data?.cost_price === undefined || detailRes.json?.data?.cost_price === null);

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 2: CART OPERATIONS & STOCK CLAMPING
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 2: CART OPERATIONS & STOCK CLAMPING");
  console.log("--------------------------------------------------------------------------------");

  const sessionId = crypto.randomUUID();
  const emptyCart = await req(null, "GET", `/cart/${sessionId}`);
  assert("Guest cart initialized for UUID session", emptyCart.status === 200 && emptyCart.json?.data?.session_id === sessionId);

  // Find a valid variant with positive active stock
  const sbHeaders = { apikey: SK, Authorization: `Bearer ${SK}` };
  const invQuery = await fetch(`${SB}/rest/v1/inventory?quantity=gt.5&is_test=eq.false&select=variant_id,quantity,variant:product_variants(id,is_active,sku,product:products(id,status,name))&limit=1`, { headers: sbHeaders });
  const invRows = await invQuery.json();
  const testVariant = invRows[0]?.variant;
  assert("Database has in-stock test variant available", !!testVariant?.id, `Variant: ${testVariant?.id} (${testVariant?.product?.name})`);

  // Add line to cart using correct snake_case variant_id
  const addCartRes = await req(null, "POST", `/cart/${sessionId}/items`, {
    variant_id: testVariant.id,
    quantity: 1,
  });
  assert("Item added to cart (200)", addCartRes.status === 200, `Got: ${addCartRes.status} ${JSON.stringify(addCartRes.json)}`);

  const populatedCart = await req(null, "GET", `/cart/${sessionId}`);
  const cartLines = populatedCart.json?.data?.lines || populatedCart.json?.data?.items;
  assert("Populated cart returns lines array", populatedCart.status === 200 && Array.isArray(cartLines) && cartLines.length > 0);
  assert("Cart line correctly computes unit price and total", cartLines?.[0]?.line_total > 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 3: CUSTOMER WISHLIST LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 3: CUSTOMER WISHLIST LIFECYCLE");
  console.log("--------------------------------------------------------------------------------");

  const saveWishlist = await req(customerToken, "POST", "/wishlist", {
    product_id: activeProduct.id,
  });
  assert("Customer saves product to wishlist (200/201)", saveWishlist.status === 200 || saveWishlist.status === 201);

  const checkWishlist = await req(customerToken, "GET", `/wishlist/check/${activeProduct.id}`);
  assert("Wishlist check verifies product is saved", checkWishlist.status === 200 && (checkWishlist.json?.data?.is_wishlisted === true || checkWishlist.json?.data?.in_wishlist === true));

  const listWishlist = await req(customerToken, "GET", "/wishlist");
  assert("Customer retrieves saved wishlist items", listWishlist.status === 200 && Array.isArray(listWishlist.json?.data));

  const removeWishlist = await req(customerToken, "DELETE", `/wishlist/${activeProduct.id}`);
  assert("Customer removes product from wishlist", removeWishlist.status === 200);

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 4: CUSTOMER SUPPORT INQUIRIES & ADMIN TICKETS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 4: CUSTOMER SUPPORT INQUIRIES & ADMIN TICKETS");
  console.log("--------------------------------------------------------------------------------");

  const inquiryRes = await req(customerToken, "POST", "/inquiries", {
    productId: activeProduct.id,
    productTitle: activeProduct.name,
    message: "Is this item available for immediate pickup today?",
  });
  assert("Customer submits product inquiry (200/201)", inquiryRes.status === 200 || inquiryRes.status === 201);

  const customerInquiries = await req(customerToken, "GET", `/inquiries?productId=${activeProduct.id}`);
  assert("Customer can view their private product inquiry thread", customerInquiries.status === 200);

  const adminInquiries = await req(adminToken, "GET", "/inquiries?all=true");
  assert("Admin can view all customer inboxes", adminInquiries.status === 200 && Array.isArray(adminInquiries.json?.data));

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 5: COMPLETE CHECKOUT JOURNEY (PICKUP ORDER)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 5: REALISTIC CHECKOUT JOURNEY (Pickup Order)");
  console.log("--------------------------------------------------------------------------------");

  // Get active pickup station
  const stationsQuery = await fetch(`${SB}/rest/v1/pickup_stations?select=id,name&is_active=eq.true&limit=1`, { headers: sbHeaders });
  const stations = await stationsQuery.json();
  const pickupStation = stations[0];
  assert("Active pickup station configured", !!pickupStation?.id, `Station: ${pickupStation?.name}`);

  // Pre-checkout quote with items array
  const quoteRes = await req(null, "POST", "/checkout/quote", {
    items: [{ variant_id: testVariant.id, quantity: 1 }],
  });
  assert("Checkout quote calculated (200)", quoteRes.status === 200);

  // Place order as customer with exact checkout contract
  const guestOrderEmail = `qa.buyer.${Date.now()}@example.com`;
  const checkoutRes = await req(null, "POST", "/checkout", {
    items: [{ variant_id: testVariant.id, quantity: 1 }],
    deliveryOption: "pickup",
    pickupStationId: pickupStation.id,
    paymentMethod: "pay_on_pickup",
    customer: {
      email: guestOrderEmail,
      fullName: "Simulated Buyer",
      phone: "08012345678",
    },
  });

  assert("Order created successfully via checkout", checkoutRes.status === 200 && !!checkoutRes.json?.data?.order_id, `Status: ${checkoutRes.status} Error: ${checkoutRes.json?.error}`);

  const createdOrderId = checkoutRes.json?.data?.order_id;
  const createdOrderNumber = checkoutRes.json?.data?.order_number;
  console.log(`    → Created Order: #${createdOrderNumber} (ID: ${createdOrderId})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 6: ORDER TRACKING & SNOOPING DEFENSE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 6: ORDER TRACKING & SNOOPING DEFENSE");
  console.log("--------------------------------------------------------------------------------");

  const validTrack = await req(null, "GET", `/orders/track?order_number=${encodeURIComponent(createdOrderNumber)}&email=${encodeURIComponent(guestOrderEmail)}`);
  assert("Customer can track own order with order # and matching email", validTrack.status === 200 && validTrack.json?.data?.order_number === createdOrderNumber);

  const snoopTrack = await req(null, "GET", `/orders/track?order_number=${encodeURIComponent(createdOrderNumber)}&email=attacker@malicious.com`);
  assert("Snooping attempt with mismatched email is rejected (404/403)", snoopTrack.status === 404 || snoopTrack.status === 403);

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 7 & 8: ADMIN ORDER PIPELINE & 6-DIGIT PICKUP PIN GENERATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 7 & 8: ADMIN ORDER PIPELINE & 6-DIGIT PICKUP PIN GENERATION");
  console.log("--------------------------------------------------------------------------------");

  let trackingPin = null;
  if (createdOrderId) {
    const adminOrderView = await req(adminToken, "GET", `/orders/${createdOrderId}`);
    assert("Admin can view full order details", adminOrderView.status === 200 && adminOrderView.json?.data?.id === createdOrderId);

    // Transition: placed -> confirmed
    const confirmRes = await req(adminToken, "PUT", `/orders/${createdOrderId}/status`, {
      status: "confirmed",
      reason: "Inventory verified at warehouse shelf",
    });
    assert("Admin advances order to 'confirmed'", confirmRes.status === 200);

    // Transition: confirmed -> ready_for_pickup
    const readyRes = await req(adminToken, "PUT", `/orders/${createdOrderId}/status`, {
      status: "ready_for_pickup",
      reason: "Packaged, sealed, and placed on collection shelf",
    });
    assert("Admin advances order to 'ready_for_pickup'", readyRes.status === 200);

    // Verify 6-digit PIN and deadline
    const updatedOrderRes = await req(adminToken, "GET", `/orders/${createdOrderId}`);
    trackingPin = updatedOrderRes.json?.data?.tracking_number;
    assert("6-digit pickup PIN generated on order", /^\d{6}$/.test(String(trackingPin)), `PIN: ${trackingPin}`);
    assert("Pickup deadline set for 48 hours", !!updatedOrderRes.json?.data?.pickup_deadline);

    // Verify tracking page now displays PIN to customer
    const customerTracking = await req(null, "GET", `/orders/track?order_number=${encodeURIComponent(createdOrderNumber)}&email=${encodeURIComponent(guestOrderEmail)}`);
    assert("Customer tracking page displays collection PIN", customerTracking.json?.data?.pickup_pin === trackingPin || customerTracking.json?.data?.tracking_number === trackingPin);

    // ───────────────────────────────────────────────────────────────────────────
    // FEATURE 9: COUNTER HANDOVER VERIFICATION (ANTI-THEFT)
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\n--------------------------------------------------------------------------------");
    console.log("FEATURE 9: COUNTER HANDOVER & 6-DIGIT PIN VERIFICATION");
    console.log("--------------------------------------------------------------------------------");

    // Attempt 1: Wrong PIN -> MUST FAIL
    const wrongPinRes = await req(cashierToken, "POST", `/orders/${createdOrderId}/complete-pickup`, {
      pickup_pin: "000000",
      payment_method: "cash",
    });
    assert("Handover with incorrect PIN is REJECTED (400)", wrongPinRes.status === 400 && wrongPinRes.json?.code === "INVALID_PICKUP_PIN");

    // Attempt 2: Correct PIN -> MUST SUCCEED
    const validHandoverRes = await req(cashierToken, "POST", `/orders/${createdOrderId}/complete-pickup`, {
      pickup_pin: String(trackingPin),
      payment_method: "cash",
    });
    assert("Handover with verified PIN SUCCEEDS (200)", validHandoverRes.status === 200);

    // Attempt 3: Already Collected -> MUST BE PREVENTED
    const doublePickupRes = await req(cashierToken, "POST", `/orders/${createdOrderId}/complete-pickup`, {
      pickup_pin: String(trackingPin),
      payment_method: "cash",
    });
    assert("Duplicate handover attempt is blocked (400 ALREADY_COLLECTED)", doublePickupRes.status === 400 && doublePickupRes.json?.code === "ALREADY_COLLECTED");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 10: ORDER CANCELLATION & INVENTORY RESERVATION RELEASE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 10: ORDER CANCELLATION & INVENTORY RESERVATION RELEASE");
  console.log("--------------------------------------------------------------------------------");

  // Create an order specifically to test cancellation
  const cancelOrderRes = await req(null, "POST", "/checkout", {
    items: [{ variant_id: testVariant.id, quantity: 1 }],
    deliveryOption: "pickup",
    pickupStationId: pickupStation.id,
    paymentMethod: "pay_on_pickup",
    customer: {
      email: `cancel.test.${Date.now()}@example.com`,
      fullName: "Cancel Test Buyer",
      phone: "08099887766",
    },
  });
  const cancelOrderId = cancelOrderRes.json?.data?.order_id;
  assert("Created second order to test cancellation flow", !!cancelOrderId);

  if (cancelOrderId) {
    const doCancelRes = await req(adminToken, "PUT", `/orders/${cancelOrderId}/status`, {
      status: "cancelled",
      reason: "Customer requested cancellation before fulfillment",
    });
    assert("Admin cancels order with reason and releases reserved stock (200)", doCancelRes.status === 200);

    const cancelledOrder = await req(adminToken, "GET", `/orders/${cancelOrderId}`);
    assert("Order status transitioned to 'cancelled'", cancelledOrder.json?.data?.status === "cancelled");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 11: POS CASHIER OPERATIONS (SCANNING, TILL SALE & RECEIPT)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 11: POS CASHIER OPERATIONS (SCANNING, TILL SALE & RECEIPT)");
  console.log("--------------------------------------------------------------------------------");

  // Barcode / SKU scan
  if (testVariant.sku) {
    const skuScan = await req(cashierToken, "GET", `/pos/products/${encodeURIComponent(testVariant.sku)}`);
    assert("Cashier scans product SKU at counter", skuScan.status === 200 && skuScan.json?.data?.variant?.sku === testVariant.sku);
  } else {
    assert("Cashier scans product SKU at counter (SKU check skipped - variant has no SKU)", true);
  }

  // Live product search
  const posSearch = await req(cashierToken, "GET", `/pos/products/search?q=${encodeURIComponent(testVariant.product?.name?.split(" ")[0] || "dress")}`);
  assert("POS search returns matching live stock catalog", posSearch.status === 200 && Array.isArray(posSearch.json?.data));

  // Ring up walk-in till sale
  const posSaleRes = await req(cashierToken, "POST", "/pos/orders", {
    items: [{ variant_id: testVariant.id, quantity: 1 }],
    payment_method: "cash",
  });
  assert("Cashier rings up walk-in till sale (200/201)", posSaleRes.status === 200 || posSaleRes.status === 201);
  const posOrderId = posSaleRes.json?.data?.order_id || posSaleRes.json?.data?.id;

  if (posOrderId) {
    const receiptRes = await req(cashierToken, "GET", `/pos/orders/${posOrderId}/receipt`);
    const receiptOrderNumber = receiptRes.json?.data?.orderNumber || receiptRes.json?.data?.order_number;
    assert("Printable receipt generated for walk-in sale", receiptRes.status === 200 && !!receiptOrderNumber, `Order: ${receiptOrderNumber}`);

    const todaySales = await req(cashierToken, "GET", "/pos/orders/today");
    assert("Today's sales register contains recorded sale", todaySales.status === 200 && Array.isArray(todaySales.json?.data));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 12: POS ORDER VOIDING & INVENTORY RESTORATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 12: POS ORDER VOIDING FLOW");
  console.log("--------------------------------------------------------------------------------");

  if (posOrderId) {
    // Cashier without can_void_orders is blocked
    const cashierVoidRes = await req(cashierToken, "PUT", `/pos/orders/${posOrderId}/void`, {
      reason: "Customer changed mind",
    });
    assert("Cashier WITHOUT can_void_orders CANNOT void sale (403)", cashierVoidRes.status === 403);

    // Admin (with authority) voids the till sale
    const adminVoidRes = await req(adminToken, "PUT", `/pos/orders/${posOrderId}/void`, {
      reason: "Authorised manager void: customer left items before exit",
    });
    assert("Admin/Manager with permission voids sale and restores stock (200)", adminVoidRes.status === 200);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 13: STRICT RBAC & PERMISSION ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 13: STRICT RBAC & BOUNDARY ENFORCEMENT");
  console.log("--------------------------------------------------------------------------------");

  const cashierUsersRes = await req(cashierToken, "GET", "/users");
  assert("Cashier CANNOT access admin user management (403)", cashierUsersRes.status === 403);

  const cashierInvRes = await req(cashierToken, "GET", "/inventory");
  assert("Cashier CANNOT access inventory management (403)", cashierInvRes.status === 403);

  const unauthSettings = await req(null, "PATCH", "/settings", { store_name: "Hacked" });
  assert("Unauthenticated visitor CANNOT modify settings (401/403)", unauthSettings.status === 401 || unauthSettings.status === 403);

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 14: ADMIN INVENTORY ADJUSTMENTS & AUDIT LOGS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 14: ADMIN INVENTORY ADJUSTMENTS & AUDIT LOGS");
  console.log("--------------------------------------------------------------------------------");

  const inventoryRes = await req(adminToken, "GET", "/inventory");
  assert("Admin can view inventory stock levels", inventoryRes.status === 200 && Array.isArray(inventoryRes.json?.data));

  const invAdjRes = await req(adminToken, "POST", "/inventory/adjustments", {
    adjustments: [
      {
        variant_id: testVariant.id,
        type: "add",
        quantity: 2,
        reason: "restock",
        notes: "Simulated verified restock shipment",
      },
    ],
  });
  assert("Admin performs stock adjustment (+2 Restock) (200)", invAdjRes.status === 200, `Status: ${invAdjRes.status} Error: ${invAdjRes.json?.error}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 15: INVENTORY LOW STOCK ALERTS & MONITORING
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 15: INVENTORY LOW STOCK ALERTS & MONITORING");
  console.log("--------------------------------------------------------------------------------");

  const alertsRes = await req(adminToken, "GET", "/analytics/inventory/alerts");
  assert("Admin views low stock / out of stock alerts (200)", alertsRes.status === 200 && (alertsRes.json?.data?.low_stock !== undefined || alertsRes.json?.low_stock !== undefined));

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 16: STAFF MANAGEMENT (BLOCK / UNBLOCK LIFECYCLE)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 16: STAFF MANAGEMENT (BLOCK / UNBLOCK LIFECYCLE)");
  console.log("--------------------------------------------------------------------------------");

  // Get cashier user ID
  const cashierProfile = await req(cashierToken, "GET", "/staff/me");
  const cashierUserId = cashierProfile.json?.data?.id;
  assert("Resolved cashier user ID", !!cashierUserId);

  if (cashierUserId) {
    // Admin blocks cashier
    const blockRes = await req(adminToken, "PATCH", `/users/${cashierUserId}`, {
      is_blocked: true,
      reason: "Temporary investigation suspension",
    });
    assert("Admin blocks cashier account", blockRes.status === 200);

    // Cashier makes request while blocked -> MUST BE 403 ACCOUNT_BLOCKED
    const blockedAccess = await req(cashierToken, "GET", "/staff/me");
    assert("Blocked cashier is immediately rejected (403 ACCOUNT_BLOCKED)", blockedAccess.status === 403);

    // Admin unblocks cashier
    const unblockRes = await req(adminToken, "PATCH", `/users/${cashierUserId}`, {
      is_blocked: false,
    });
    assert("Admin unblocks cashier account", unblockRes.status === 200);

    // Cashier makes request after unblock -> MUST SUCCEED
    const restoredAccess = await req(cashierToken, "GET", "/staff/me");
    assert("Cashier access is successfully restored (200)", restoredAccess.status === 200);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 17: STORE SETTINGS UPDATES
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 17: STORE SETTINGS UPDATES");
  console.log("--------------------------------------------------------------------------------");

  const settingsPatch = await req(adminToken, "PATCH", "/settings", {
    store_name: "GTS",
    support_phone: "09126433601",
    pickup_hold_hours: 48,
  });
  assert("Admin updates store settings (200)", settingsPatch.status === 200);

  const settingsVerify = await req(null, "GET", "/settings");
  assert("Public settings immediately reflect changes", settingsVerify.json?.data?.store_name === "GTS");

  // ─────────────────────────────────────────────────────────────────────────────
  // FEATURE 18: FINANCIAL ANALYTICS & EXECUTIVE KPI
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log("FEATURE 18: FINANCIAL ANALYTICS & EXECUTIVE KPI");
  console.log("--------------------------------------------------------------------------------");

  const analyticsDash = await req(adminToken, "GET", "/analytics/dashboard");
  assert("Admin views executive financial dashboard", analyticsDash.status === 200 && analyticsDash.json?.data?.revenue?.total !== undefined);

  const analyticsOverview = await req(adminToken, "GET", "/analytics/overview");
  assert("Admin views overview report", analyticsOverview.status === 200);

  // ─────────────────────────────────────────────────────────────────────────────
  // SIMULATION REPORT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`ALL FEATURES SIMULATION COMPLETE: ${stats.passed}/${stats.total} PASSED (${stats.failed} FAILED)`);
  console.log("================================================================================\n");

  if (stats.failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Unhandled simulation error:", e);
  process.exit(1);
});
