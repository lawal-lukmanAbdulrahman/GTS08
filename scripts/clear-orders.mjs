import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE credentials in apps/web/.env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function clearOrders() {
  console.log("Connecting to Supabase at:", supabaseUrl);

  // 1. Delete transactions
  const { error: txErr } = await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (txErr) console.warn("Notice deleting transactions:", txErr.message);
  else console.log("✓ Cleared transactions");

  // 2. Delete promo_code_uses
  const { error: promoErr } = await supabase.from("promo_code_uses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (promoErr) console.warn("Notice deleting promo_code_uses:", promoErr.message);
  else console.log("✓ Cleared promo_code_uses");

  // 3. Delete order_items
  const { error: itemErr } = await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (itemErr) console.warn("Notice deleting order_items:", itemErr.message);
  else console.log("✓ Cleared order_items");

  // 4. Delete orders
  const { error: orderErr } = await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (orderErr) {
    console.error("Error deleting orders:", orderErr.message);
  } else {
    console.log("✓ Cleared all orders");
  }

  // 5. Reset reserved_quantity in inventory so stock is completely unblocked
  const { error: invErr } = await supabase.from("inventory").update({ reserved_quantity: 0 }).gte("reserved_quantity", 0);
  if (invErr) console.warn("Notice resetting inventory reserved_quantity:", invErr.message);
  else console.log("✓ Reset all inventory reserved_quantity to 0");

  // 6. Reset user order stats
  const { error: userErr } = await supabase.from("users").update({ total_orders: 0, total_spent: 0, last_order_at: null }).neq("id", "00000000-0000-0000-0000-000000000000");
  if (userErr) console.warn("Notice resetting user order stats:", userErr.message);
  else console.log("✓ Reset user order stats");

  console.log("\nSuccessfully cleared all order data for a fresh clean slate!");
}

clearOrders().catch((err) => {
  console.error("Failed to clear orders:", err);
  process.exit(1);
});
