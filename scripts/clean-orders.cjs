const { createClient } = require("./../apps/web/node_modules/@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Simple .env.local parser
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv(path.resolve(__dirname, "../apps/web/.env.local"));

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("Connecting to Supabase at:", supabaseUrl);

  // 1. Delete order items
  const { error: itemsErr } = await supabase
    .from("order_items")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (itemsErr) console.error("Error clearing order_items:", itemsErr.message);
  else console.log("✓ Cleared all order_items");

  // 2. Delete transactions
  const { error: txErr } = await supabase
    .from("transactions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (txErr) console.error("Error clearing transactions:", txErr.message);
  else console.log("✓ Cleared all transactions");

  // 3. Delete orders
  const { error: ordersErr } = await supabase
    .from("orders")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (ordersErr) console.error("Error clearing orders:", ordersErr.message);
  else console.log("✓ Cleared all orders");

  // 4. Reset reserved quantities on inventory
  const { error: invErr } = await supabase
    .from("inventory")
    .update({ reserved_quantity: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (invErr) console.error("Error resetting reserved inventory:", invErr.message);
  else console.log("✓ Reset all reserved stock to 0");

  // 5. Clear pickup_stations so admin starts fresh
  const { error: stErr } = await supabase
    .from("pickup_stations")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (stErr) console.error("Error clearing pickup_stations:", stErr.message);
  else console.log("✓ Cleared all pickup_stations (empty fresh slate)");

  console.log("\nSuccess: Database is completely fresh! No mock data, no old orders.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
