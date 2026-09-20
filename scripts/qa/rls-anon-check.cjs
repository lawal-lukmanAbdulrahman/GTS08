#!/usr/bin/env node
/**
 * Row-level-security check with the PUBLIC (anon) key, the one every browser holds. For every table it asks
 * Supabase's own REST API for rows, exactly as an attacker could. Tables that hold private data must return
 * nothing; the storefront's public tables may return rows but only ones meant to be public.
 *
 *   node scripts/qa/rls-anon-check.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON) { console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set"); process.exit(2); }

// Tables the storefront reads on purpose without signing in.
const PUBLIC = new Set(["products", "product_variants", "product_images", "categories", "brands", "inventory", "reviews", "size_guides", "content_slots", "delivery_options", "settings"]);
// Columns that must never be visible to the public.
const SECRET_COLUMNS = { products: ["cost_price"], settings: ["tax_rate"], inventory: [], reviews: ["email"] };

const tables = new Set();
for (const f of fs.readdirSync(path.join(ROOT, "supabase/migrations"))) {
  const s = fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8");
  for (const m of s.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)/g)) tables.add(m[1]);
}
const get = async (t, key) => {
  const r = await fetch(`${U}/rest/v1/${t}?select=*&limit=3`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const body = await r.json().catch(() => null);
  return { status: r.status, rows: Array.isArray(body) ? body : [], body };
};
const post = async (t) => {
  const r = await fetch(`${U}/rest/v1/${t}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: "{}" });
  return r.status;
};

(async () => {
  const problems = [];
  const rows = [];
  for (const t of [...tables].sort()) {
    const anon = await get(t, ANON);
    const real = SVC ? await get(t, SVC) : { rows: [] };
    const exposed = anon.rows.length;
    let verdict = "ok";
    if (!PUBLIC.has(t) && exposed > 0) { verdict = "EXPOSED"; problems.push(`${t}: anonymous callers can read ${exposed}+ row(s)`); }
    if (PUBLIC.has(t) && exposed > 0) {
      const leaked = (SECRET_COLUMNS[t] || []).filter((c) => c in anon.rows[0]);
      if (leaked.length) { verdict = "LEAKS " + leaked.join(","); problems.push(`${t}: public rows include ${leaked.join(", ")}`); }
    }
    const w = await post(t);
    if (![401, 403, 400, 404, 409].includes(w) && w < 300 === false ? false : w < 300) { verdict += " WRITABLE"; problems.push(`${t}: anonymous insert answered ${w}`); }
    rows.push(`${t.padEnd(24)} anon rows: ${String(exposed).padStart(2)}   (service sees ${real.rows.length ? "data" : "none"})   ${verdict}`);
  }
  console.log(rows.join("\n"));
  console.log(problems.length ? "\n" + problems.map((p) => "FAIL  " + p).join("\n") : "\nPASS  no private table is readable or writable with the public key");
  process.exit(problems.length ? 1 : 0);
})();
