# GTS Platform — QA Report

**Prepared as:** Senior QA review · **Date:** 2026-09-20 · **Build under test:** branch `store-front` @ latest (API on :3002, dashboard on :3001, real Supabase database)

## 1. What was run

| Layer | How | Result |
|---|---|---|
| Unit / component / route tests | Vitest — web + dashboard | **543 web + 369 dashboard = 912 pass, 0 fail** (1 latency benchmark is load-sensitive, see §5) |
| Type checking | `tsc --noEmit`, both apps | Dashboard clean. Web: 1 pre-existing error (`@supabase/supabase-js` not installed in `apps/web`) |
| Lint | ESLint, both apps | **117 errors / ~430 warnings**, all in older files (unused vars/imports); files added on this branch are clean |
| API end-to-end | 187 scripted checks against the live API + DB: authentication, authorization matrix, input abuse, business rules, concurrency races, public/security | **171 pass / 16 fail** on first full run; 1 of the 16 fixed since (§4) |
| Browser | Storefront pages on desktop and 375 px mobile: title, console, CSP, overflow, tap targets, dead images | Findings in §6 |
| Not run | Authenticated browser click-through of dashboard/POS; real Paystack; real receipt printer; load test; Playwright (none exist) | See §7 |

Test data created during QA (2 cashiers, flags, ~17 sales/WhatsApp orders) was removed or reversed; one exception is noted in §8.

---

## 2. What is working

**Authentication and sessions**
- Wrong password and unknown email return the same message (no user enumeration); tampered/garbage/absent tokens → 401.
- Blocking an account cuts off its *existing* token on the very next request (`ACCOUNT_BLOCKED`) and blocks login; unblocking restores it.
- Revoking a permission takes effect on the next request (verified for discounts and POS access).
- Login brute-force is throttled (429).

**Authorization on POS, staff and admin routes** — every check passed: cashiers cannot reach admin flags, staff list, staff records, settings PATCH, or add staff (even with void+discount); admins cannot block themselves; a cashier cannot escalate their own role through the profile endpoint; another cashier's flags, sales and receipts are invisible.

**POS business rules (all pass)**
- Sale totals are exact; order numbers match `GTS-YYYYMM-NNNNNN`.
- Stock falls by exactly the quantity sold and is restored *exactly* on void.
- Discount rules: no grant → refused; > 20% → refused (and stock untouched); exactly 20% → allowed; admin > 20% → allowed; discount larger than the sale → refused.
- Void rules: needs the grant; reason mandatory; own sales only (cashiers cannot void an admin's or another cashier's); admin can void any; double void refused; voided sale cannot be reprinted.
- Reprint: own sales only, marked duplicate, audited.
- **Concurrency:** 4 parallel sales for 1 remaining unit → never oversold, no 5xx, stock fully restored after cleanup.
- **WhatsApp flow:** stock reserved at creation; visible in the pending list to any cashier; confirm-vs-cancel fired simultaneously → exactly one wins and stock ends consistent; double-confirm and cancel-after-finish both refused; void of a confirmed WhatsApp sale returns stock.
- Product flags: reason/note/product/variant validation, duplicate-open-flag protection, per-cashier visibility, admin review with mandatory closing note.
- Profile: phone validation, password rules, wrong current password is a 400 (does not sign the user out).

**Public / security controls that held:** `cost_price` absent from POS and public *list* responses; unknown slug → 404; order tracking refuses a wrong email; CORS rejects a foreign origin; injection-shaped search strings no longer break search (after fixes); staff list never exposes secrets; settings GET leaks nothing sensitive.

---

## 3. What is NOT working — defects, ranked

Severity: **Critical** = fix before any public exposure · **High** · **Medium** · **Low**.

### Critical

| # | Defect | Evidence | Recommendation |
|---|---|---|---|
| C1 | **`GET /inventory` needs no login.** Anyone can read every variant's stock, reserved count and last-sold time. | Anonymous request returned 200 with full inventory rows | Require auth + `can_manage_inventory` (or admin); return only what each caller needs |
| C2 | **`PUT /storefront/sections` has no authentication.** Anyone can rewrite the homepage layout/hero products (persists to the database). | Code has no auth call; anonymous/cashier PUT with a bad body got a *validation* 400, meaning a valid body would be accepted. Not exercised, to avoid altering live content | Gate with `requireAdmin` before parsing the body |
| C3 | **Public product detail leaks `cost_price`** (e.g. a fridge showing cost ₦14,700 vs price ₦35,000). Violates Security Contract #7. | `GET /products/standing-fan` → `cost_price: 1470000` | Explicit column selection on public routes; add a regression test that scans public responses for `cost_price` |
| C4 | **Paystack webhook signature check is skipped when the secret is blank/dummy** and the code falls back to a public default secret. Locally, forged and unsigned `charge.success` events returned 200. In production with the key unset, anyone who knows the default string can forge a valid signature and mark orders paid. | Both forged and unsigned webhook probes → 200; `PAYSTACK_SECRET_KEY` is empty in `.env` | Fail closed: refuse (500/401) if the key is missing; never default a secret; verify HMAC unconditionally; test in CI |

### High

| # | Defect | Evidence | Recommendation |
|---|---|---|---|
| H1 | **`POST /upload` is unauthenticated** and has a hard-coded fallback Cloudinary API key in source. Anyone can push files into your Cloudinary account. | Anonymous POST reached the upload code (500 without a file) | Auth (admin / `can_manage_products`), file-type/size limits, remove the fallback key and **rotate** it (it is in git history) |
| H2 | **Any cashier can create categories and brands** (`POST /categories`, `POST /brands` → 201). | Cashier without product grants got 201 (test rows removed) | Require `can_manage_products` / admin |
| H3 | **Cashiers without the grant can read** `/inventory/movements`, `/orders` (all customers' orders), `/inquiries` (customer messages) and `/broadcast`. | All returned 200 to a cashier with only POS access | Permission-gate each; scope `/orders` to the caller unless `can_view_all_orders` |
| H4 | **Only POS routes enforce the 7 permission flags.** The others gate by role or not at all, so "give a staff member inventory access" cannot be trusted anywhere else. | Follows from C1, H2, H3 | Central `requirePermission(key)` used by every staff route; an authZ test matrix that iterates all routes |

### Medium

| # | Defect | Recommendation |
|---|---|---|
| M1 | Login with malformed JSON returns **500** instead of 400 | Wrap body parsing; return `INVALID_BODY` |
| M2 | Rate limiting is **per IP and in memory** — a store's tills share one address, so all cashiers share one budget (5 logins/min, ~15 sales/min); it also won't work across serverless instances. It throttled QA itself repeatedly (17 retries). | Upstash, keyed by user id for authenticated routes; per-IP only for anonymous/login |
| M3 | No cron: reservations never expire; unpaid WhatsApp orders keep stock reserved forever | pg_cron / Vercel cron jobs per backend spec Part 8 |
| M4 | 28 of 46 stored product images are dead paths (`/products/x.png`) | Re-upload to Cloudinary or null the field; POS now shows a placeholder |
| M5 | A staff member created with a one-time password is never forced to change it | Add `must_change_password` and a first-login screen |
| M6 | The Paystack path, checkout, cart API, promos, tickets, wishlist, reviews-write, cron and email routes are **stubs** (22 routes return 501) | See PM report backlog |

### Low
- `tsconfig.tsbuildinfo` is tracked in git and changes on every build (remove and ignore).
- `@supabase/supabase-js` missing from `apps/web` breaks its typecheck.
- The search-latency benchmark (p99 < 0.19 ms) fails when the machine is busy; make it relative or move it out of the unit gate.

---

## 4. Defects found by QA and fixed during this pass

| Defect | Fix | Regression tests |
|---|---|---|
| Sale/WhatsApp create accepted quantity 0, negative, fractional, string, non-UUID variants → **500** (and unbounded quantities) | Shared `validateOrderItems` (whole qty 1–999, real UUIDs, ≤ 50 lines, duplicate lines merged); `INVALID_ITEMS` 400 | 19 unit + 9 route tests |
| A non-UUID id in a URL (`/pos/orders/abc/receipt`, void, confirm, cancel, flags, users) → **500 DATABASE_ERROR** | UUID guard → clean 404 before any query | 28 route tests |
| POS search: page number past the end → **500** | Empty page, 200 | 1 |
| POS search with `;` / `--` → upstream firewall HTML error page **echoed back** as the API error | Strip separators/comments; never echo HTML errors | 2 |
| POS SKU lookup with hostile text → **500** | Non-SKU values are a 404 without a database call | 5 |
| Product pictures broken in POS (wrong hard-coded cloud name; dead stored paths) | Resolver + graceful placeholder + `onError` fallback | 10 |
| POS grid didn't scroll; checkout button pushed off-screen; type too small; no admin sidebar | Constrained grid rows, larger type scale, admin shell around POS | verified in browser |
| Commit history carried an AI co-author trailer on 28 commits | Rewritten; verified 0 remain in any ref | — |

Suite after fixes: web **543 passing**, dashboard **369 passing**.

---

## 5. Test-suite health notes
- The unit suite is strong for POS, staff, flags, validation and money math. **Zero** browser-level (Playwright) tests, **one** unrun RLS file (`product_flags.test.sql`), no CI pipeline run evidence.
- Fixtures in six route tests used non-UUID ids like `order-1`; they now use real UUIDs (assertions unchanged).
- The performance benchmark is environment-sensitive (machine load average was 30–57 during the first full run; it passed when quiet).

---

## 6. User-experience critique and recommendations

Evidence type: **(O)** observed in the running app · **(C)** confirmed in code.

### 6.1 Point of sale (the daily-use screen)

| Issue | Why it matters | Recommendation |
|---|---|---|
| **No barcode/Enter-to-add** (C): search box ignores Enter; scanner input just filters | Slower queue; spec Part 7 | On Enter, if input matches a SKU exactly, add that variant; keep autofocus |
| **Cards are large squares, 2–3 per row** (O) | A cashier sees ~6 products; scrolling through 46+ items is slow | Compact density toggle, 4–5 columns on wide screens, smaller/optional images |
| **Stock badge shows a label but not units** (C) | "Low stock" doesn't say 2 or 4 | Show "3 left" on low-stock cards |
| **No "short cash" warning** (C): Confirm allowed when cash received < total | Cashier can complete an underpaid cash sale | Show "Short by ₦X" and require ≥ total (or explicit override) |
| **No hold/park sale** (C) | A second customer arrives mid-sale → cart lost or blocked | "Hold" and "Resume" (local, per till) |
| **Discount entry is a raw ₦ box** (C) | Cashiers think in percent; 20% cap needs mental math | Quick chips (5 / 10 / 20 %) that fill the amount; show the cap inline |
| **Error banner isn't dismissed when the cart changes** (C) | A stale "insufficient stock" message lingers after the fix | Clear on any cart edit; auto-dismiss on success |
| **WhatsApp "Record order" tab shows no running total** (C) | The cashier can't quote the customer a total | Show subtotal/total like the walk-in cart |
| **Reprint only from *today's* list; no search by order number** (C) | Customers return for yesterday's receipt | "Find a sale" by number/date range (own sales), same audit |
| **Flag button is 24 px with a ⚑ glyph and no visible label** (C) | Under the 44 px touch rule; not discoverable | 44 px target with a text label on hover/focus; tooltip on first use |
| **No dedicated screen for a user without POS access** (C): grid renders, then errors | Confusing for a newly created staff member | "You don't have POS access — ask an admin" full-page state |
| **Admin shell around POS on tablets** (C): mobile top bar *plus* POS bar | Wastes ~15% of vertical space | Auto-collapse the admin sidebar/hide the mobile bar on `/pos`; the collapse shortcut exists (Ctrl/Cmd+B) |
| Confirm modal shows *lines* as "items" (C) | Says "2 items" for 5 units | Show units |

### 6.2 Staff and admin
| Issue | Recommendation |
|---|---|
| **Login page says "check email for the password"** (O) but no email is ever sent (accounts now get a one-time password shown to the super admin) | Change copy to "Your admin will give you your password" |
| **Super admin can create `inventory_staff` accounts whose portal is a blank page** (C/O) | Hide unbuilt roles in the form, or build the portal (P0 in PM report) |
| **Permission switches for non-POS grants look functional but don't restrict anything** (see H4) | Label them "not enforced yet", or fix H4 first |
| After creating an account, the one-time password is visible only once, in plain text | Add "copy" (done) plus "email it" once email exists; force change on first login |
| Admin lists lack search/sort/pagination (staff, flags capped at 100) | Add search and paging before the team grows |

### 6.3 Storefront (observed in the browser)
| Issue | Evidence | Recommendation |
|---|---|---|
| **Every page title is "Aura — Aura V1 Pro Vacuum"** (O) | All 8 pages checked show the same title | Per-page titles and a GTS default; matters for SEO and browser tabs |
| **Brand fonts are blocked by the site's own Content-Security-Policy** (O): Athelas and Satoshi from third-party hosts are refused, so pages render in fallback fonts | 5 CSP errors in the console on load | Self-host the fonts via `next/font` (as the spec requires) |
| **Navigation says Men / Women / Children / Apparel / Footwear, but the catalogue is appliances, gaming, phones, beauty** (O) | Header buttons vs. product data | Decide the brand: men's wear (per PRD) or general retail; align nav, categories and copy |
| **Mobile tap targets: 154 of 241 interactive elements on the home page and 28 of 42 on a product page are under 44 px** (O) | Spec Part 3 rule 5 | Enforce a 44 px minimum in shared button/link styles |
| No "skip to content" link (O) | Keyboard/screen-reader users tab through the whole header | Add skip link; audit WCAG AA |
| Product page mobile shows no visible "Add to cart" in the button list scan (O, inconclusive) | Re-check with a logged-in cart flow | Verify the primary CTA is reachable without scrolling |
| Cart, search and wishlist run on **static sample data**, not the live catalogue (C) | Search page imports a local products file | Wire to `/products/search` and the cart API |
| Cart page opens showing three sample items for a fresh visitor (O) | Preloaded items in the browser session | Confirm this is leftover local state, not seeded defaults |

---

## 7. Coverage gaps and limits of this QA
1. **Authenticated dashboard/POS was not click-tested in the browser.** Signing in would have meant typing a password into the login form, which I don't do; behaviour was verified through the API and the component tests, plus screenshots earlier in this engagement. A 30-minute scripted pass by you (or a Playwright suite using a test account) closes this.
2. **No real Paystack transaction**, no live webhook delivery, and no order-confirmation email path (not built).
3. **No real receipt printer** (58 mm / 80 mm / A4 layouts are verified as text/CSS only).
4. **No load or soak test**; rate limiting prevented meaningful parallel volume anyway.
5. **RLS policies were not tested** (the one pgTAP file has never been run; the API uses the service role, which bypasses RLS).
6. **Accessibility and performance budgets (Lighthouse, LCP, WCAG AA) were not measured.**

## 8. Data left behind (needs your decision)
- **Order `GTS-202609-000004`** — a WhatsApp test sale ("Ngozi A.", 1 × Google Pixel 10 Pro, ₦1,250,000) from an earlier development session is still *completed*, so Pixel stock is 1 lower than reality. The system only allows same-day voids, and I did not bypass that. Options: (a) leave it, (b) I add a documented stock adjustment of +1, (c) an admin adds one via the inventory screen.
- Other QA sales/WhatsApp orders are voided or cancelled and remain in order history with reasons "QA …".

## 9. Recommended order of work
1. **Today:** C1–C4, H1–H3 (a day of work; each is a few lines plus a test). Rotate the Cloudinary key. Set `PAYSTACK_SECRET_KEY`.
2. **This week:** H4 (central permission check + full-route authZ matrix test in CI), M1, M2, M3, first-login password change, POS UX items in §6.1 marked "cash short", "Enter-to-scan", "clear errors".
3. **Next sprint:** employee portal, real storefront data wiring, per-page titles and fonts, tap targets; then Playwright for the four critical flows (walk-in sale, WhatsApp order, checkout, staff onboarding).

**Overall QA verdict:** the **POS and staff-access core is solid and correct under abuse and concurrency**. The **surrounding platform is not yet safe to expose publicly** because of four critical exposures (C1–C4) that sit outside the POS code and pre-date this work.
