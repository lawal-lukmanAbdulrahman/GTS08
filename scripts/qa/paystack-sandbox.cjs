// Online purchase check against a NON-PRODUCTION database, using a Paystack TEST secret key.
//
//   PAYSTACK_SECRET_KEY=sk_test_... node scripts/qa/paystack-sandbox.cjs
//   (the running API must use the same key; optional QA_API_BASE=http://localhost:3002/api/v1)
//
// It places an order, sends a correctly signed `charge.success` webhook (what Paystack does),
// and checks what should be true of a safe checkout. Test rows are removed afterwards and the
// stock count is put back. Exit code 1 if any expectation fails.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const B = process.env.QA_API_BASE || "http://localhost:3002/api/v1";
for (const line of fs.readFileSync(path.resolve(__dirname, "../../.env"), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_ROLE_KEY, PAY = process.env.PAYSTACK_SECRET_KEY;
if (!PAY) { console.log("Set PAYSTACK_SECRET_KEY (a Paystack TEST key) for this script and for the API."); process.exit(2); }
if (/^sk_live/.test(PAY)) { console.log("Refusing to run with a LIVE Paystack key."); process.exit(2); }

const svc = { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json", Prefer: "return=representation" };
const sb = async (m, r, b) => { const res = await fetch(SB + r, { method: m, headers: svc, body: b ? JSON.stringify(b) : undefined }); const t = await res.text(); return t ? JSON.parse(t) : null; };
const results = [];
const check = (name, pass, detail) => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `   (${detail})`}`); };
const sign = (raw) => crypto.createHmac("sha512", PAY).update(raw).digest("hex");

(async () => {
  const listing = (await (await fetch(`${B}/products?limit=30`)).json()).data || [];
  const pick = listing.flatMap((p) => (p.variants || []).map((v) => ({ p, v }))).find((x) => x.v.available >= 3 && x.p.base_price >= 100000);
  if (!pick) { console.log("no in-stock variant found"); process.exit(2); }
  const { p, v } = pick;
  const dbPriceKobo = p.base_price + (v.price_modifier || 0);
  const stockOf = async () => (await sb("GET", `/rest/v1/inventory?select=quantity,reserved_quantity&variant_id=eq.${v.id}`))[0];
  const before = await stockOf();
  const createdOrders = [];

  const checkout = async (overrides = {}) => {
    const res = await fetch(`${B}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        customer: { fullName: "Sandbox Buyer", email: `sandbox.${Date.now()}@example.com`, phone: "08031234567" },
        address: { addressLine1: "1 Test Street", city: "Lagos", state: "Lagos" },
        items: [{ variant_id: v.id, quantity: 1, price: dbPriceKobo / 100, product: { id: p.id, title: p.name, priceNum: dbPriceKobo / 100 } }],
        deliveryOption: "pickup",
        paymentMethod: "paystack",
        ...overrides,
      }),
    });
    const json = await res.json();
    if (json?.data?.order_id) createdOrders.push(json.data.order_id);
    return { status: res.status, data: json?.data, json };
  };

  try {
    console.log(`Using "${p.name}" (${v.id}), price ${dbPriceKobo} kobo, stock ${before.quantity}\n`);

    // 1. A new online order must wait for payment
    const a = await checkout();
    check("checkout creates an order that is waiting for payment (not already paid)", a.data?.status === "pending_payment", `status=${a.data?.status}`);
    check("the payment record is pending until the webhook says otherwise", a.data?.payment?.status === "pending", `payment=${a.data?.payment?.status}`);

    // 2. The server, not the browser, decides the price and discounts
    const cheat = await checkout({ discountPercent: 100, items: [{ variant_id: v.id, quantity: 1, price: 1, product: { id: p.id, title: p.name, priceNum: 1 } }] });
    check("a browser-supplied price and discount are ignored", cheat.data ? cheat.data.subtotal >= dbPriceKobo && cheat.data.discount_amount === 0 : true, `subtotal=${cheat.data?.subtotal} discount=${cheat.data?.discount_amount}`);

    // 3. Paystack's signed webhook is what pays it
    const ref = a.data?.payment?.reference;
    const event = JSON.stringify({ event: "charge.success", data: { id: Date.now(), reference: ref, amount: a.data?.total, currency: "NGN", channel: "card", fees: 0 } });
    const hook = (raw, sig) => fetch(`${B}/webhooks/paystack`, { method: "POST", headers: { "x-paystack-signature": sig }, body: raw });
    check("an unsigned webhook is refused", (await hook(event, "")).status === 401, "expected 401");
    const good = await hook(event, sign(event));
    check("a correctly signed webhook is accepted", good.status === 200, `status=${good.status}`);
    const [paid] = (await sb("GET", `/rest/v1/orders?select=status&id=eq.${a.data?.order_id}`)) || [];
    check("the order is now paid", paid?.status === "paid", `status=${paid?.status}`);
    const afterPay = await stockOf();
    check("stock went down by exactly one", before.quantity - afterPay.quantity === 1, `before=${before.quantity} after=${afterPay.quantity}`);

    // 4. Paystack retries: the same event twice must not take stock twice
    await hook(event, sign(event));
    const afterReplay = await stockOf();
    check("a repeated webhook does not take stock twice", afterReplay.quantity === afterPay.quantity, `after=${afterPay.quantity} then ${afterReplay.quantity}`);

    // 5. A payment for the wrong amount is not accepted
    const b = await checkout();
    const wrong = JSON.stringify({ event: "charge.success", data: { id: Date.now() + 1, reference: b.data?.payment?.reference, amount: 100, currency: "NGN" } });
    await hook(wrong, sign(wrong));
    const [notPaid] = (await sb("GET", `/rest/v1/orders?select=status&id=eq.${b.data?.order_id}`)) || [];
    check("a payment for the wrong amount does not mark the order paid", notPaid?.status !== "paid", `status=${notPaid?.status}`);
  } finally {
    for (const id of createdOrders) {
      await sb("DELETE", `/rest/v1/stock_movements?order_id=eq.${id}`);
      await sb("DELETE", `/rest/v1/transactions?order_id=eq.${id}`);
      await sb("DELETE", `/rest/v1/order_items?order_id=eq.${id}`);
      await sb("DELETE", `/rest/v1/orders?id=eq.${id}`);
    }
    await sb("PATCH", `/rest/v1/inventory?variant_id=eq.${v.id}`, { quantity: before.quantity, reserved_quantity: before.reserved_quantity });
    console.log(`\nremoved ${createdOrders.length} test order(s); stock restored to ${before.quantity}`);
  }
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
