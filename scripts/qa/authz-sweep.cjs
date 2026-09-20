#!/usr/bin/env node
/**
 * Live authorization sweep: calls every route and method in the policy manifest with NO credentials and
 * checks the answer matches what the manifest declares. Anything not public must refuse (401/403);
 * public routes must not refuse for lack of a login. Also flags any 5xx and any answer that leaks an internal message.
 *
 *   QA_API_BASE=http://localhost:3002/api/v1 node scripts/qa/authz-sweep.cjs
 */
const fs = require("fs");
const path = require("path");
const B = process.env.QA_API_BASE || "http://localhost:3002/api/v1";
const src = fs.readFileSync(path.resolve(__dirname, "../../apps/web/app/api/v1/_lib/route-policies.ts"), "utf8");
const UUID = "11111111-1111-4111-8111-111111111111";
const rows = [];
for (const m of src.matchAll(/^\s*"([^"]+)":\s*\{([^}]*)\}/gm)) {
  for (const p of m[2].matchAll(/(GET|POST|PUT|PATCH|DELETE):\s*"([^"]+)"/g)) rows.push({ route: m[1], method: p[1], policy: p[2] });
}
const fill = (r) => "/" + r.replace(/\[(?:sessionId|id|ref|sku|productId|variantId)\]/g, UUID).replace(/\[categorySlug\]/, "shirts").replace(/\[key\]/, "hero_1").replace(/\[[^\]]+\]/g, UUID);
// Answers that are 200 without a login on purpose: signing out with no session is a no-op, and product Q&A is public reading.
const KNOWN_SAFE = new Set(["POST /auth/logout", "GET /inquiries"]);
const LEAK = /relation "|column "|violates|pg_|postgrest|PGRST|supabase|stack|at .*\(.*:\d+:\d+\)/i;

(async () => {
  const problems = [];
  let checked = 0;
  for (const r of rows) {
    let res, text = "";
    try {
      res = await fetch(B + fill(r.route), { method: r.method, headers: { "Content-Type": "application/json", "Idempotency-Key": "qa-" + Math.random() }, body: r.method === "GET" || r.method === "DELETE" ? undefined : "{}" });
      text = await res.text();
    } catch (e) { problems.push(`${r.method} /${r.route}: request failed (${e.message})`); continue; }
    checked++;
    const open = /^(public|optionalStaff|session\|optionalStaff)/.test(r.policy);
    const cronOrHook = /^(cron|webhook)/.test(r.policy);
    if (!open && !cronOrHook && !KNOWN_SAFE.has(`${r.method} /${r.route}`) && ![401, 403].includes(res.status)) problems.push(`${r.method} /${r.route} [${r.policy}] answered ${res.status} with no credentials`);
    if (cronOrHook && ![401, 403, 500].includes(res.status)) problems.push(`${r.method} /${r.route} [${r.policy}] answered ${res.status}`);
    if (open && [401, 403].includes(res.status) && !/session/.test(r.policy)) problems.push(`${r.method} /${r.route} [public] refused with ${res.status}`);
    if (res.status >= 500 && !cronOrHook) problems.push(`${r.method} /${r.route} answered ${res.status} (a server error on a bad request)`);
    if (LEAK.test(text)) problems.push(`${r.method} /${r.route} response looks like it leaks internals: ${text.slice(0, 120)}`);
  }
  console.log(`${checked} route/method pairs checked`);
  console.log(problems.length ? problems.map((p) => "FAIL  " + p).join("\n") : "PASS  every route enforces what the manifest declares, no 5xx, no leaks");
  process.exit(problems.length ? 1 : 0);
})();
