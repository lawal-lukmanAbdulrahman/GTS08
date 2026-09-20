# QA Fix Results (Phases 0–5)

Companion to `qa-report.md` (what was found) and `qa-fix-plan.md` (what was planned).
**Branch:** `store-front` · **Verified:** 1,081 web + 490 dashboard unit tests, both typechecks clean, lint ratchet clean, live API regression (see §5).

## 1. Every issue in the QA report

| ID | Issue | Status | How |
|---|---|---|---|
| C1 | `/inventory` readable with no login (and `PUT /inventory/[id]` let anyone set stock) | ✅ Fixed | `can_manage_inventory` on all three inventory routes; validated, atomic adjustments; UI shows real failures |
| C2 | `PUT /storefront/sections` unauthenticated | ✅ Fixed | admin-only, checked before the body is read; layout validated |
| C3 | `cost_price` in public product detail (and drafts public) | ✅ Fixed | cost stripped at any depth for non-staff; drafts hidden from the public |
| C4 | Paystack webhook fail-open | ✅ Fixed | refuses to run without a secret; constant-time HMAC first; amount/currency must match; compare-and-swap claim; errors return non-2xx so Paystack retries |
| H1 | `/upload` unauthenticated + hard-coded Cloudinary key | ✅ Fixed in code · ⚠️ **you must rotate the key** | product-access only; real image bytes, ≤ 5 MB; no fallback account |
| H2 | Any cashier (or customer) could create categories/brands | ✅ Fixed | `can_manage_products` |
| H3 | Over-broad reads (orders, inquiries, movements, broadcast, drafts) | ✅ Fixed | orders scoped to own unless `can_view_all_orders`; inquiries inbox needs `can_handle_tickets`; broadcast writes admin-only (dev-mode bypass removed); drafts need product access |
| H4 | Only POS routes enforced the seven grants | ✅ Fixed | `requirePermission` everywhere; **route policy manifest + test** fails CI if any route lacks a declared, enforced policy |
| M1 | Malformed JSON → 500 | ✅ Fixed | `serverError()` in every catch-all (400 for bad JSON); internal messages never echoed (a test forbids it) |
| M2 | Rate limiting per IP, in memory | ✅ Fixed | per-person buckets + per-address ceiling; credential-only auth tier (20/min/address) + **8/min per account**; Upstash Redis store when configured (in-memory fallback) |
| M3 | No cron | ✅ Fixed | `cleanup-reservations`, `expire-orders` (unpaid WhatsApp 24 h / online 60 min), `CRON_SECRET`-protected, `vercel.json` schedules |
| M4 | "28 dead image paths" | ✅ Corrected & fixed | **The original finding was wrong**: the `/products/*.png` files exist in both apps. The real fault was the POS image resolver rejecting local paths, so those products showed placeholders. It now accepts `/products/...` and https URLs (and still refuses `javascript:`/`data:`/`//` and `..`). Products whose image field is genuinely empty still show a placeholder. |
| M5 | One-time password never forced to change | ✅ Fixed | `must_change_password` (migration 00012): server refuses everything but the change until done; app redirects; profile shows only the password form |
| M6 | Stub routes | ➖ Out of scope | tracked in the PM backlog; each is `stub` in the policy manifest |
| Low | tsbuildinfo tracked · missing `@supabase/supabase-js` · flaky benchmark | ✅ Fixed | untracked; dependency added (web typecheck now fully clean); benchmark is an opt-in `test:perf` job |
| UX §6.1 | 13 POS items | ✅ All 13 | Enter-to-scan, compact view, "N left", short-cash guard, hold/resume sales, discount % chips (+ cap hint), dismissible/auto-clearing errors, WhatsApp totals, **find-a-sale + reprint** (new `GET /pos/orders`), 44 px flag button, no-access screen, tablet layout, units in confirm modal (+ double-tap guard) |
| UX §6.2 | Staff/admin | ✅ | login copy; Inventory-staff role hidden until its portal exists; staff list search, filters, paging; login labels linked (a11y) |
| UX §6.3 | Storefront | ✅ mostly | per-page titles (was "Aura — Aura V1 Pro Vacuum"); fonts self-hosted (Satoshi) with **no** third-party font requests and the CSP untouched; skip link; touch targets 154 → 0 buttons/inputs under 44 px on mobile; **first-visit cart and wishlist start empty** (they were pre-filled with demo items) |
| §7 | Coverage gaps | ✅ Built, ⚠️ not all executed | see §3 |
| Email | No transactional email | ✅ Built (Resend) | welcome (password only if the admin opts in), password-changed, POS receipt, online payment confirmation, flag update, access change. Best-effort and after-response: a missing key or a provider outage never fails the action. Needs `RESEND_API_KEY` + `EMAIL_FROM`. |
| §8 | Order `GTS-202609-000004` | ⏳ Waiting on you | same-day void rule blocks it; needs a +1 Pixel stock adjustment |

## 2. New findings during this work

| Severity | Finding | Status |
|---|---|---|
| 🔴 **Critical** | **Any signed-in customer could make themselves an admin.** The `users_update_own` policy let a user update every column of their own row via Supabase's public REST API; I confirmed it against the live database with a throwaway account (`role` became `admin`). | ✅ Fixed — migration 00013 (allow-list trigger) **applied**. |
| 🔴 **Critical** | **Online checkout trusts the browser**: unit prices and `discountPercent` came from the request, and prepaid orders were created as already "paid" before any payment (stock never decremented). | ✅ Fixed — the server now reads only variant ids and quantities, prices from the database, applies no client discount, uses fixed delivery fees, accepts prepaid methods only, holds stock, and creates the order `pending_payment` with a pending transaction. Only the Paystack webhook marks it paid. **Still to do:** the storefront cart runs on sample data with no real variant ids, so a real purchase will be refused ("invalid product variant") until the storefront is wired to the catalogue; promo codes are not honoured at checkout until they have real server-side rules. |
| 🟠 High | `PUT /inventory/[id]` let anyone with no login set any stock count | ✅ Fixed (C1) |
| 🟠 High | Broadcast POST/DELETE skipped authentication whenever `NODE_ENV=development`; `getAuthenticatedUser` could impersonate an admin with an opt-in dev flag | ✅ Both removed |
| 🟠 High | Login/session calls under `/auth/*` shared 5 requests/min per address and every `/pos/*` call (each search keystroke) shared 15/min, which would cripple a shop with several tills | ✅ Fixed (M2) |
| 🟡 Medium | Checkout never reserves stock; webhook would have failed every online payment against the strict stock helper | ✅ Webhook clamps the release (`clampReserved`); reservation itself belongs to the checkout rewrite |
| 🟡 Medium | Admin inventory screen swallowed failed adjustments and showed the new number anyway; storefront editor showed "Saved Live!" even when the save failed | ✅ Fixed — both now show the real outcome |
| 🟡 Medium | Admin inventory screen fell back to hard-coded sample stock and movements when the API failed | ✅ Fixed — shows a retryable error / an honestly empty list |
| 🟡 Medium | The dashboard image uploader talked to Cloudinary directly with an unsigned preset and fell back to a local `blob:` URL that would be saved | ✅ Fixed — uploads go only through the authenticated `/api/v1/upload`; a failure is an error, never a saved local URL (the broadcast editor stops saving) |

## 3. What was built but not executed by me

- **Playwright flows** (`apps/dashboard/e2e`, 5 tests): compile and list, but I did not run them because they sign in through the real login form with passwords. Run `pnpm test:e2e` (needs the apps running against a non-production database and the service key in `.env`); they create and delete their own test accounts.
- **RLS pgTAP tests** (`product_flags`, and the new `users_privileged_columns`): need a local Supabase (`supabase start`); CI runs them.
- **Lighthouse budgets, perf job, printer checklist, Paystack sandbox script**: written; run in CI nightly / by hand.
- **CI**: the workflow is committed and YAML-valid; it has not run on GitHub.

## 4. Things only you can do

1. ~~Apply migrations 00012 and 00013~~ — done.
2. Review the two accounts that aren't customers: `admin@gts.ng` (super admin) and `rolatzarza@gmail.com` (cashier, created today). Confirm you know both.
3. **Rotate the Cloudinary API key**; set `PAYSTACK_SECRET_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` (a sender on a domain verified in Resend) and optionally `UPSTASH_REDIS_REST_URL/TOKEN` in each environment.
4. Wire the storefront cart to real variant ids (the checkout API is now safe but only accepts real variants), and decide how promo codes should work server-side.
5. Add the staging secrets in GitHub for the nightly jobs; adjust the `STAGING_*` names if you prefer others.
6. Decide the stock fix for order `GTS-202609-000004`.

## 5. Final regression

| Check | Result |
|---|---|
| Web unit/route/component tests | 1,081 pass (6 perf benchmarks are the opt-in `test:perf` job) |
| Dashboard tests | 490 pass |
| Typecheck, web and dashboard | clean (web was previously failing on a missing dependency) |
| Lint ratchet | no new errors (132 legacy errors recorded in `.lint-baseline.json`) |
| **Live API regression** — last run *before* the email, checkout and upload changes; re-run `node scripts/qa/api-e2e.cjs` (with `QA_ADMIN_EMAIL`/`QA_ADMIN_PASSWORD`) to confirm. Earlier result: (`scripts/qa/api-e2e.cjs`, 219 checks incl. auth, authorization, security fixes, POS rules, concurrency races, WhatsApp, flags, staff, public/security, rate limiting) | **219 / 219 pass**, 0 rate-limit retries (the first full run needed 17) |

A first attempt at this run showed a burst of 500s: that was the Next dev server's own corrupted build cache after many edits, not an application fault. A clean restart (`rm -rf .next`) cleared it.

