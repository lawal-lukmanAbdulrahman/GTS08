# GTS Platform: QA Report, second review

**Date:** 2026-09-20 · **Branch:** `store-front` @ `cca84f4` and later · **Environment:** local dev servers (web :3002, dashboard :3001) against the real Supabase project
**Method:** automated suites, both production builds, dependency audit, a live authorization sweep over every route (signed out, and as a throwaway signed-in customer), an anonymous-key row-level-security probe against every table, live checks of rate limiting, headers, caching and latency, code review of the routes handling identity, money and filters, and a browser check of the storefront.

## 1. Results at a glance

| Check | Result |
|---|---|
| Unit, route and component tests | **1,503 web + 568 dashboard pass** (6 opt-in perf benchmarks skipped) |
| Typecheck, both apps | clean |
| Lint | **0 errors** |
| Production build, both apps | **pass** (was failing) |
| `pnpm audit --prod` | **no known vulnerabilities** (was 2 critical, 10 high, 7 moderate) |
| Authorization sweep, signed out (142 route/method pairs) | **pass**: every protected route refuses; no 5xx; no leaked internals |
| Authorization sweep, signed in as a customer (142 pairs) | **pass**: every staff/admin/POS route refuses a customer |
| Anonymous-key RLS probe (35 tables) | **2 failures**: `products.cost_price`, `settings.tax_rate` readable (fix written, not yet applied) |
| Rate limiting (live) | pass: promo validation allowed 20, then 429 |
| Security headers | present: CSP, HSTS (2 years, preload), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| Live cart, quote, promo, ticket round trips against the real DB | pass (test rows removed afterwards) |
| Authenticated admin regression (`scripts/qa/api-e2e.cjs`, 219 checks) | **not re-run**: needs the admin password |
| Playwright flows, pgTAP tests, Lighthouse, Paystack sandbox | **not run** |

## 2. New findings this round

| ID | Severity | Finding | Status |
|---|---|---|---|
| **N1** | 🔴 Critical | `GET /orders/customer` accepted `?email=`, `?customerId=` or `?userId=` with **no sign-in**, and returned every matching order with `select *`, including IP address, session id and staff notes, plus the delivery address. Confirmed live: an anonymous request with a customer's email returned that customer's orders. Found by the new sweep. | ✅ Fixed. Sign-in required, query parameters ignored, customer-safe columns only. 5 regression tests. |
| **N2** | 🟠 High | Checkout could take over another customer's record. The signed-in path looked customers up with a filter built from the **typed** email (`user_id.eq.X,email.eq.<typed>`), and then overwrote `user_id` on whatever matched, so a signed-in user could claim another person's customer record (and their order history) by typing their email or injecting filter syntax. Guests could also overwrite a registered customer's name and phone. | ✅ Fixed. Matching is by account and the person's own verified email; a record owned by someone else is never reused or changed; guests get their own record. 6 regression tests. |
| **N3** | 🟠 High | The public API key could read `products.cost_price` (our margin) directly through Supabase's REST API, bypassing every route-level protection. Violates security contract 7. Confirmed live. | ⏳ **Fix written: migration 00015. Not applied. Apply it.** Until then it is exploitable by anyone. |
| **N4** | 🟡 Medium | The public key can read every column of `settings` (tax rate and other private values). | ⏳ Same migration. |
| **N5** | 🟡 Medium | Public product search built a database filter from the raw search text (`.or(name.ilike.%q%,...)`): a comma or bracket in the query could add conditions. Same pattern, with account emails, in orders, reviews and inquiries. | ✅ Fixed. All values pass through `filterText`/`filterEmail`; regression tests. |
| **N6** | 🟡 Medium | `production build` failed: the storefront header, the dashboard login form and the storefront preview header read the URL without a Suspense boundary. CI's build step would have gone red on first run. | ✅ Fixed. |
| **N7** | 🟡 Medium | 32 routes returned raw database error text (table and constraint names) to callers. | ✅ Fixed (`dbError`). A static test now fails if it comes back. |
| **N8** | 🟡 Medium | Inventory changes with a free-text reason lost their audit row (the movement insert violated a CHECK constraint and the error was ignored). | ✅ Fixed. |
| **N9** | 🟡 Medium | The old order-status route accepted any status (including `paid`), never returned stock on cancel and leaked errors. | ✅ Replaced by a forward-only machine. |
| **N10** | 🟡 Medium | `POST /categories` reported success when the insert failed. | ✅ Fixed. |
| **N11** | 🔵 Low | Public product list was uncached (every visit hit the database) and the framework header `X-Powered-By` was sent. | ✅ Fixed: shared cache 30 s for anonymous callers only; header removed (verify after next deploy). |
| N12 | 🔵 Low | CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts and `http://localhost:*` in `connect-src`. Common with Next but weakens XSS defence. | ⏳ Open. Tighten with nonces and remove localhost in production builds. |
| N13 | 🔵 Low | The storefront home logs a React hydration warning in development. Cause not yet identified (it may predate the catalogue change: I did not compare against the earlier build); the page renders and works. | ⏳ Open. Find the browser-only value rendered on the server. |
| N14 | 🔵 Low | A Cloudinary product image returned 504 through the Next image optimiser once. | Observed. Monitor; consider caching. |
| N15 | 🔵 Low | The product create route contains a hand-written "SQL injection" regex check that gives false confidence (it also rejects legitimate text such as a name containing `--`). The real protection is parameterised queries. | ⏳ Open. Remove the regex, keep validation. |
| N16 | 🔵 Low | `inventory` is publicly readable including thresholds and sold dates (needed for "in stock", not for the rest). | ⏳ Open, low risk. |
| N17 | 🔵 Low | `apps/web/emails/*.tsx` (React Email templates from the spec) are unused; the real templates are in `_lib/email`. | ⏳ Open (dead code). |

## 3. Earlier findings: re-verified

| Earlier ID | Was | Now |
|---|---|---|
| C1 to C4 (inventory, storefront sections, cost price in product detail, webhook fail-open) | Critical | ✅ Still fixed (sweep and route tests). C3 also needs 00015 for the direct-REST path (N3) |
| H1 upload without login, Cloudinary key | High | ✅ Code fixed; **key rotation is still an owner action** |
| H2 to H4 (any cashier creates categories, over-broad reads, grants only on POS) | High | ✅ Fixed; manifest test enforces it |
| M1 malformed JSON, M2 rate limits, M3 cron, M5 forced password change | Medium | ✅ Fixed |
| M4 "28 dead images" | Medium | ✅ Was a wrong finding; resolver fixed |
| M6 stub routes | Medium | ✅ All built |
| Privilege escalation via `users_update_own` | Critical | ✅ Migration 00013 applied; re-verified by the customer sweep |
| Online checkout trusts the browser | Critical | ✅ Server-authoritative; test purchase still to run |
| Admin inventory sample data, direct Cloudinary upload | Medium | ✅ Fixed |

## 4. Functional review

| Area | Verified | Gaps found |
|---|---|---|
| Storefront catalogue | 30 products load from the database on the home page, search and product page; prices, sizes, colour galleries and top-level categories correct; no broken images | none seen in the pages checked (home, search, one product page) |
| Cart and wishlist sync | Live PUT capped 999 to the 31 in stock, dropped an unknown product, ignored a fake price; merge and wishlist covered by tests | Sign-in merge and wishlist sync not exercised with a real login |
| Checkout and payment | Quote, promo, hold, Paystack start, status polling covered by tests and live quote | **Real Paystack round trip never run** |
| Orders admin | Status machine, refund flag, stock return covered by tests | Not clicked through as an admin |
| POS | Receipt in the new format, live stock refresh, cart reconciliation covered by tests | Real printer output not checked |
| Email | Every template and hook covered by tests | **No real message has been sent**: needs `RESEND_API_KEY`/`EMAIL_FROM` |
| Notifications and live data | Summary endpoint and bell covered; live polling ran in dev | Not seen with several staff signed in at once |

## 5. Performance (dev server, one region, cold caches)

Product list 0.73 s (94 KB, 30 products), product detail 0.75 s, search 0.98 s, settings 0.95 s, checkout quote 1.1 s. Dominated by database round trips; the list is now cacheable. Production numbers need measuring on the deployed stack (Lighthouse budgets exist in `lighthouserc.json` and run in CI nightly).

## 6. Test gaps

1. The authenticated admin regression and Playwright flows have not run since these changes.
2. pgTAP tests (3 files, including the new column-privilege test) only run in CI against a local Supabase.
3. Nothing exercises Paystack, Resend or Cloudinary for real.
4. No load test; the rate-limit store is per server unless Upstash is set.
5. Component tests cover pieces of the admin pages; several large pages (product create/edit, broadcast editor, storefront editor) have no tests.

## 7. Recommendation

**Not ready to take real customers until:** N3/N4 applied (minutes), the Cloudinary key rotated, and a Paystack test purchase plus a real email have been run end to end. Everything else in section 2 marked open is low severity and can follow launch. The two new tools (`scripts/qa/authz-sweep.cjs`, `scripts/qa/rls-anon-check.cjs`) should run after every deploy: they found N1 and N3, which unit tests could not, because both were problems in how the pieces fit together rather than in any one piece.
