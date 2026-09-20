# GTS Platform: Product Analysis, second review

**Prepared as:** senior product manager review · **Date:** 2026-09-20 · **Branch:** `store-front` (107 commits, unpushed)
**Compared with:** `pm-project-analysis.md` (first review, 34 commits ago). **Evidence:** every route in the policy manifest, both test suites, both production builds, a live sweep against the running API and the real database (`qa-report-v2.md`).

---

## 1. Executive summary

The first review said the platform was **roughly 45 to 50% of the full spec**, with the point of sale and staff administration strong and the online-store revenue path (cart, payment, email, fulfilment) unfinished. That gap has largely closed.

**What changed since the first review**

| Then | Now |
|---|---|
| Storefront ran on a built-in list of 29 sample products; cart and wishlist lived only in the browser | Products come from the database; the cart and wishlist are kept on the server too and follow a shopper who signs in |
| Online checkout trusted the browser (prices, discounts, "paid" before payment) | Server prices everything, holds stock, sends the customer to Paystack, and only the signed webhook marks an order paid |
| No email, no cron, no promo engine, no support tickets, no stored notifications, no analytics beyond one endpoint | Resend email (welcome, receipts, payment, order status, tickets, campaigns), three cron jobs, promo codes end to end, tickets, notifications, seven analytics endpoints |
| 13 route groups returned 501 | None do: every route is real, tested and declared in the policy manifest |
| Admin bell and avatars were fake | Live counts and on-shift staff from real data; POS stock refreshes while a till is open |
| Builds failed; 126 lint errors; 19 dependency advisories (2 critical) | Both apps build; 0 lint errors; no known vulnerabilities |

**Estimated completion of the full spec: about 75%** (was 45 to 50%). Of what a store needs to open with (walk-in and WhatsApp selling, stock, staff, online ordering and payment, customer email, admin basics) roughly **90%** is in place.

**What still stands between this and launch (owner actions, in order)**
1. Apply migration **00015** (hides `cost_price` and private settings from the public API key: a live exposure found this round). Migrations 00012 to 00014 are already applied.
2. Rotate the Cloudinary key that was once committed. Set `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (and Upstash, optionally) in every environment.
3. Run one full test purchase with a Paystack **test** key, end to end, including the webhook. This has never been exercised.
4. Load real stock: 6 variants were created at zero stock so the database matches the old catalogue (Nexus washing machine, two colours).

## 2. Scope against the spec

The backend spec lists 133 routes. By literal method and path, 76 are present; most of the 57 "missing" ones are the same capability under this codebase's own naming (for example `POST /checkout/initiate` is `POST /checkout`, `orders/my` is `orders/customer`, `users/:id/block` is a PATCH on `users/[id]`). Real gaps:

| Gap | Impact | Suggested priority |
|---|---|---|
| Product edit sub-routes (images reorder, variants CRUD, duplicate, status, featured) | Admin edits products through the existing create/patch flow; no bulk image or variant tools | Medium |
| Reviews moderation (`pending`, `approve`, `delete`, `mine`, per-product list) | Reviews can be written; there is no approval queue, so unmoderated reviews are a brand risk | **High before launch** |
| Delivery options table and admin | Delivery fees are fixed in code (₦1,500 door, ₦1,100 pickup, ₦4,500 express) | Medium |
| Password reset (`password-reset/request|confirm`), token refresh, anonymous-to-account conversion | A customer who forgets a password has no self-service path in the API | **High** |
| Inventory `low-stock`, `out-of-stock`, `restock` shortcuts | Covered by `analytics/inventory/alerts` and `inventory/adjustments`; screens don't use them yet | Low |
| Order export, refund, cancel-by-customer | Refunds are manual in Paystack (the system flags them) | Medium |
| Email opt-in and a suppression list | Campaigns can't be sent to an "opted in" audience; unsubscribing is by replying | **High before any marketing send** |
| `promos/email-capture`, `categories/:slug/filters`, `products/featured|bestsellers|related` | Storefront derives these client-side | Low |

## 3. Product readiness by area

| Area | First review | Now | Notes |
|---|---|---|---|
| POS (walk-in, WhatsApp, receipts, reprint, holds) | ~90% | ~95% | Receipt now follows the shop's handwritten format; barcode scanner beyond Enter-to-scan not built |
| Staff access, audit, flags | ~90% | ~95% | Audit now covers admin actions too, with readable labels |
| Admin dashboard | ~45% | ~75% | New: promos, order detail/status rules, live bell, staff record live. Missing: customers list screen, email campaign screen, reviews queue, categories screen, content-slot editor |
| Storefront | ~50% | ~80% | DB-backed catalogue, real checkout and confirmation, promo codes, server cart and wishlist. Missing: order-success emails to guests beyond payment confirmation, reviews moderation, password reset |
| Employee portal (`/inventory`, `/orders`, `/tickets`, `/pending`) | ~5% | ~5% | **Still four blank pages.** `inventory_staff` accounts land on a heading. The role is hidden from the Add Staff form until this exists |
| Platform (email, cron, rate limit, monitoring, tests, CI) | ~25% | ~80% | No error monitoring service yet; rate limit store is per-server unless Upstash is configured |

## 4. Delivery health

| Measure | First review | Now |
|---|---|---|
| Unit and component tests | 1,012 web + 456 dashboard | **1,503 web + 568 dashboard** |
| Test files | not counted | 151 |
| API routes | 84 (13 stubs) | **104, none stubbed** |
| Source size | not measured | 39.6k lines (web), 42.0k (dashboard) |
| Lint errors | 132 | **0** |
| `pnpm audit --prod` | not run | **clean** |
| Production build | failing | **passing, both apps** |
| RLS (pgTAP) tests | 1 file | 3 files (still only run by CI, not locally) |
| Live checks | 219 API assertions | + 142-route authorization sweep (signed out and as a customer), anonymous-key RLS check |

The engineering habits held: every route ships with tests, a static test refuses a route that doesn't declare and enforce a policy, another refuses any route that echoes a database message, and CI now also runs the audit and the build.

## 5. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Online payment path never run with real Paystack callbacks | High | High | Test purchase with a test key before launch; `scripts/qa/paystack-sandbox.cjs` exists |
| R2 | Public key can read cost prices until 00015 is applied | Certain today | High (margin leak) | Apply 00015; `scripts/qa/rls-anon-check.cjs` proves the fix |
| R3 | Marketing email without consent records | Medium | High (regulatory, reputation) | Build opt-in and suppression before enabling campaigns; campaigns default to draft |
| R4 | Unmoderated reviews go live | Medium | Medium | Build the approval queue |
| R5 | Stock is only as good as the counts entered; imported variants are at zero | High | Medium | Stock take, then adjustments screen |
| R6 | Single points of failure: one Supabase project, Cloudinary images timing out under load (seen once in testing) | Medium | Medium | Monitoring, image CDN caching |
| R7 | Employee portal missing for a role the system can create | Low today (role hidden) | Medium | Build it or remove the role |

## 6. Recommended backlog

**Before launch (about 1.5 to 2 weeks)**
1. Apply 00015 and re-run the anonymous-key check. (owner, minutes)
2. Test purchase end to end with Paystack test keys; fix what it finds.
3. Password reset and account recovery.
4. Reviews moderation queue.
5. Error monitoring (for example Sentry) and an uptime check on the webhook.
6. Real stock counts.

**First month after launch**
7. Email opt-in and suppression list, then a campaigns screen.
8. Delivery options as data with an admin screen.
9. Customers list and order export.
10. Employee portal (or retire the `inventory_staff` role).
11. Categories and content-slot admin screens.

**Later:** product bulk tools, barcode hardware support, refunds through the Paystack API, returns.

## 7. Decisions the owner should make

- Is `inventory_staff` a real role for launch? If yes the portal moves up; if not, remove it.
- Will there be email marketing at launch? If yes, opt-in and suppression become launch work.
- Do promo codes need a per-customer limit? Today a code has a total limit only.
- Should the storefront cart be allowed to hold items the database has no stock record for? Today they are refused at checkout.
