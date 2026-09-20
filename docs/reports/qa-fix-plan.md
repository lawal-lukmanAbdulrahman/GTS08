# QA Fix Plan

**Scope:** every issue in `qa-report.md` (C1–C4, H1–H4, M1–M6, Low, UX §6, coverage gaps §7, data §8).
**Status:** PLAN ONLY — nothing here has been implemented yet. Awaiting your go-ahead and the decisions in §7.
**Estimated effort:** ~13 working days for everything; **Phase 0–1 (all security) ≈ 3 days**.

## 1. Rules of engagement (apply to every fix)

1. **TDD:** write the failing test first, see it fail for the right reason, then fix. No test is weakened to pass.
2. **One commit per issue**, Conventional Commits, **no AI attribution of any kind**. Nothing is pushed without your explicit say-so.
3. **Fail closed:** missing config or unknown route policy means *deny*, not allow.
4. **Regression net:** promote the QA harness to `scripts/qa/api-e2e.cjs` (credentials from env, not argv) and re-run it after every phase. It must end **all green** (currently 171/187) with new checks added for each fix.
5. **Callers move with the server:** adding auth to a route breaks every caller that sends no token. Each fix lists its callers (§3) and updates them in the same commit, using `apiCall` (already sends the bearer token and handles 401/blocked).
6. **Full gate before each phase closes:** web + dashboard tests, `tsc` (both), lint on touched files, QA harness.

## 2. Phase order (and why)

| Phase | Theme | Issues | Effort | Why this order |
|---|---|---|---|---|
| **0** | Stop the bleeding | C3, C4, C2, C1, H1 (+ key rotation) | 1 day | Public exposure of cost data, stock, homepage write, uploads, webhook forgery |
| **1** | One permission system | H4, H2, H3 | 2 days | Fixes the root cause of C1/H2/H3 so it can't recur |
| **2** | Robustness & operations | M1, M2, M3, M5, Low | 3 days | Real-world failure modes: throttling, stale reservations, weak onboarding |
| **3** | POS experience | §6.1 | 2–3 days | Daily-use speed and error-proofing |
| **4** | Storefront & staff-UI quick wins | §6.2, §6.3 | 1.5 days | Trust, SEO, accessibility |
| **5** | Test infrastructure | §5, §7 | 3 days | So this never regresses silently |
| **6** | Data | M4, §8 | 0.5 day | Owner-dependent clean-up |

Phases 0–1 must finish before any public exposure. Phases 2–6 can be re-ordered by priority.

---

## 3. Phase 0 — Critical fixes (1 day)

### C3 — `cost_price` leaks in public product detail
- **Cause:** `products/[slug]/route.ts` selects all columns. Also verify the *list* route: it computes `cost_price`/profit margin and only appears clean by default — confirm the `include_all_status` parameter (and any margin fields) is admin-only.
- **Fix:** explicit column allow-list for every public product response; cost/margin only when the caller is an authenticated admin.
- **Tests (first):** a contract test that requests every public product endpoint (list, detail, search, `include_all_status=true`, drafts) anonymously and as a cashier and fails if any key matching `cost|margin|profit` appears; positive test that an admin still gets margin in the admin list.
- **Callers:** admin products page reads margin — keep working by sending the token.
- **Effort:** 1.5 h.

### C4 — Paystack webhook fails open
- **Cause:** signature check is skipped when the key equals a hard-coded default; blank key ⇒ default.
- **Fix:** delete the default; if `PAYSTACK_SECRET_KEY` is missing return 500 `WEBHOOK_NOT_CONFIGURED` (never process); always verify HMAC-SHA512 with `timingSafeEqual` **before** parsing; additionally verify the event's amount and currency equal the order total before marking paid (defence in depth), keep idempotency.
- **Tests (first):** no key → refuses; missing/forged signature → 401; correct signature → processed once; replay → no double effect; amount mismatch → not paid, logged. Existing webhook tests set a test key instead of relying on the dummy.
- **Ops step (owner):** set `PAYSTACK_SECRET_KEY` in every environment.
- **Effort:** 2 h.

### C2 — `PUT /storefront/sections` unauthenticated
- **Fix:** `requireAdmin` first, before reading the body. `GET` stays public (storefront reads the layout).
- **Tests:** anonymous/cashier PUT → 401/403 and nothing written; admin PUT works; GET public.
- **Callers:** `admin/storefront/page.tsx` → `apiCall` with token.
- **Effort:** 1 h.

### C1 — `GET /inventory` (and `/inventory/[id]`, `/inventory/movements`) public
- **Fix:** `requirePermission("can_manage_inventory")` (admin implicit) on all three; responses trimmed to what the screen needs.
- **Tests:** anonymous 401; cashier without grant 403; inventory_staff with grant 200; admin 200; a revoke takes effect on the next request.
- **Callers:** `admin/inventory/page.tsx` (6 call sites) → `apiCall`. Storefront and POS do **not** call it (POS has its own stock routes) — safe.
- **Effort:** 2 h.

### H1 — `POST /upload` unauthenticated + hard-coded Cloudinary key
- **Fix:** `requirePermission("can_manage_products")`; accept only `image/jpeg|png|webp|avif`, ≤ 5 MB (checked server-side by size and magic bytes, not the file extension); **remove** the fallback API key, cloud name and preset — if the env vars are missing return 503; never echo Cloudinary internals in errors.
- **Owner step (mandatory):** **rotate the Cloudinary API key/secret** (the old key is in git history) and set the new values in env.
- **Tests:** anonymous 401; cashier 403; oversized/non-image rejected; valid image accepted (Cloudinary mocked); missing config → 503.
- **Callers:** `admin/products/cloudinary-upload.ts` (2 call sites) sends the token.
- **Effort:** 2 h.

**Phase 0 exit:** QA harness checks for C1–C4/H1 green; manual anonymous `curl` of each route returns 401/403.

---

## 4. Phase 1 — One permission system (2 days)

### H4 — Central permission layer + a route policy manifest (root cause)
- **Build:** generalise `requirePosPermission` into `requirePermission(request, key)` in `staff-access.ts` (admin implicit, blocked refused, re-read from DB each request).
- **Route policy manifest:** `apps/web/app/api/v1/_lib/route-policies.ts` declares, per route file and HTTP method, one of: `public`, `authenticated`, `staff`, `permission:<key>`, `admin`, `super_admin`, `webhook:paystack`, `cron`, `stub`.
- **Guard test (the important part):** `authz-matrix.test.ts` walks the filesystem for every `route.ts`, fails if any exported method has **no declared policy**, then calls each route with anonymous / customer / cashier-no-grants / matching-grant / admin identities and asserts the outcome the manifest promises. A future route without a policy fails CI.
- **Effort:** 1 day (test harness + manifest for ~84 routes).

### H2 — Categories and brands writes
- `POST` (and later PATCH/DELETE) → `permission:can_manage_products`; `GET` stays public (the storefront reads brands).
- **Callers:** admin product new/edit pages (4 sites) send the token.
- **Effort:** 1.5 h (after H4).

### H3 — Over-broad reads
| Route | New policy | Notes |
|---|---|---|
| `GET /orders` | `permission:can_view_all_orders` | Storefront uses `/orders/customer` and `/orders/track`, **not** `/orders` — verify and leave those alone |
| `GET /inventory/movements` | `permission:can_manage_inventory` | done in C1 |
| `GET /inquiries` | **split:** a signed-in customer sees only their own; `?all=true` → `permission:can_handle_tickets` | Customers *create* inquiries from the storefront — keep `POST` working |
| `/broadcast` mutations/analytics | `admin` | `GET` of the active broadcast stays public (storefront modal reads it) |
- **Callers to fix (send no token today):** `admin/layout.tsx` (inquiry badge poll), `admin/questions/*`, `admin/broadcast/*`, `admin/storefront/*`.
- **Tests:** per route via the H4 matrix, plus customer-scoping tests for inquiries.
- **Effort:** 4 h.

**Phase 1 exit:** matrix test green for all routes; QA harness authorization section 100%; the seven permission switches genuinely restrict the routes their labels claim (removes the "looks functional but isn't" UX issue).

---

## 5. Phase 2 — Robustness and operations (3 days)

| ID | Fix | Tests | Effort |
|---|---|---|---|
| **M1** login malformed/empty JSON → 500 | Parse safely; 400 `INVALID_BODY`. Sweep all `request.json()` calls for the same pattern (shared `readJson()` helper) | malformed body on every JSON route → 400 | 3 h |
| **M2** rate limiting per-IP, in-memory | Upstash sliding window (spec Part 5.2). **Authenticated routes keyed by user id** (from the verified token), anonymous by IP, login by IP **and** email. POS sales 20/min per user per spec. Interim in-memory fallback only when Upstash env is absent (dev). Limiter behind an interface so tests inject a fake | user A hitting the limit does not throttle user B on the same IP; login lock-out is per email; 429 has `Retry-After` | 1 day |
| **M3** no cron: reservations never expire | Implement the stub `cron/*` routes (Vercel cron, `CRON_SECRET` bearer required): release expired checkout reservations (5 min), **expire unpaid WhatsApp orders** (window from §7 decision, releases reserved stock, audited), low-stock alert generation (hourly). All idempotent and race-safe using the existing compare-and-swap helpers | expired reservation released once; cron rejects wrong/missing secret; WhatsApp expiry loses the race gracefully to a concurrent confirm | 1 day |
| **M5** one-time password never forced to change | Migration `00012` adds `users.must_change_password`; set true on staff creation; server rejects every staff route except `/staff/me/password` and logout with `PASSWORD_CHANGE_REQUIRED` until changed; dashboard redirects to a change-password screen | flag set on create; blocked routes; clears after change; can't reuse the temp password | 0.5 day |
| **Low** tracked `tsconfig.tsbuildinfo` | `git rm --cached`, add to `.gitignore` | — | 10 min |
| **Low** `@supabase/supabase-js` missing in `apps/web` | Add the dependency (or remove the import if unused) so `tsc` is clean | typecheck green | 30 min |
| **Low** flaky latency benchmark | Compare against a baseline measured in the same run (ratio), not an absolute 0.19 ms | stable when machine is loaded | 30 min |
| **M6** stub routes return 501 | **Not part of this plan** — feature work tracked in the PM backlog. Each stub is listed as `stub` in the H4 manifest so it can't be mistaken for protected code | — | — |

---

## 6. Phase 3 — POS experience (2–3 days)

All are dashboard changes with component tests first.

| # | Fix | Detail |
|---|---|---|
| 1 | **Enter-to-add by SKU** | Enter in search with an exact SKU adds that variant (via `/pos/products/:sku`), toast on success, "not found" inline |
| 2 | **Denser grid** | Density toggle (comfortable/compact), 4–5 columns on wide screens, smaller optional images; remember choice |
| 3 | **Units left** | Low-stock badge shows "3 left" |
| 4 | **Short-cash guard** | "Short by ₦X"; Confirm disabled for cash below total unless the cashier explicitly overrides |
| 5 | **Hold / resume sale** | Park the current cart locally (per till), list held sales, resume; cleared at sign-out |
| 6 | **Discount % chips** | 5 / 10 / 20 % buttons fill the amount; the cap shown inline; admins get a free-amount box |
| 7 | **Stale error banner** | Clear on any cart change; dismiss button; success clears |
| 8 | **WhatsApp record tab totals** | Show subtotal/total like the walk-in cart |
| 9 | **Find a sale** | Search **own** sales by order number/date range and reprint (audited, DUPLICATE) — new endpoint `GET /pos/orders?q=&from=&to=` with the same ownership rule |
| 10 | **Flag button** | 44 px target with a text label, keyboard focus ring |
| 11 | **No-access screen** | Full-page "You don't have POS access — ask an admin" when `can_process_pos` is false |
| 12 | **Tablet layout** | Auto-collapse the admin sidebar and hide the mobile top bar on `/pos` |
| 13 | **Confirm modal** | "Items" → units; show discount line |

---

## 7. Phase 4 — Storefront and staff UI quick wins (1.5 days)

| Fix | Detail |
|---|---|
| **Per-page titles** | GTS default + `generateMetadata` on product/shop/search/track/cart; remove the leftover "Aura" title |
| **Fonts vs CSP** | Self-host Athelas/Satoshi with `next/font/local` (spec requirement); do **not** loosen the CSP |
| **Tap targets** | Shared button/link/chip styles get a 44 px minimum; audit with a script counting elements < 44 px per page (target 0 on primary flows) |
| **Skip link + landmarks** | "Skip to content", `main`/`nav` landmarks, visible focus |
| **Login copy** | Replace "check email for the password" with "Your admin will give you your password" |
| **Roles without a portal** | Until the employee portal exists, mark `inventory_staff` in the add-staff form as "portal coming soon" or hide it (owner decision) |
| **Admin lists** | Search + paging for staff and flags |
| **Static data → live API** (search, cart, wishlist) | Larger feature work: tracked in the PM backlog; only the **cart preloaded with sample items** is checked here to confirm it is leftover browser state, not a seeded default |
| **Nav vs catalogue** | Owner decision (men's wear per PRD, or general retail); then align nav, category names and copy |

---

## 8. Phase 5 — Test infrastructure (3 days)

| Gap | Plan |
|---|---|
| **No browser E2E** | Add Playwright to `apps/dashboard` with a **dedicated test-account seed** (script creates/removes accounts; passwords in env, never typed by an assistant). Four flows: walk-in sale → receipt → void; WhatsApp record → confirm; staff onboarding (super admin adds cashier → cashier signs in and is forced to change password); permission revoke closes POS. Runs headless in CI |
| **RLS untested** | Run `pnpm test:rls` in CI against a Supabase branch/local stack; add policy tests for every table touched by migrations 00008–00012 (product_flags exists, unrun) |
| **No CI evidence** | GitHub Actions workflow: install → typecheck → lint (touched files, then ratchet the 117 legacy errors down) → unit → RLS → QA API harness against a seeded branch DB |
| **Legacy lint debt (117 errors)** | Ratchet: CI fails on *new* errors; clear old ones opportunistically (mostly unused vars) |
| **Accessibility / performance** | Lighthouse CI on home, shop, product, cart with the spec budgets (Perf ≥ 85, LCP < 2.5 s); axe checks in Playwright |
| **Printer** | A one-page manual checklist for 58 mm, 80 mm and A4 with a real device; results recorded in `docs/` |
| **Paystack** | Test-mode end-to-end purchase in a sandbox script once C4 is done |

---

## 9. Phase 6 — Data (0.5 day, owner-dependent)

- **M4 dead images:** script lists the 28 products whose image path was never uploaded; you (or the store) re-upload, or we null the field so the placeholder shows deliberately.
- **Order `GTS-202609-000004`** (test WhatsApp sale, Pixel 10 Pro): pick one — (a) leave it, (b) a documented **+1 stock adjustment** with reason "QA test sale reversal", (c) an admin adds it in the inventory screen.

---

## 10. Decisions I need from you

| # | Decision | My recommendation |
|---|---|---|
| 1 | Permission → route mapping | inventory→`can_manage_inventory`; orders→`can_view_all_orders`; inquiries/tickets→`can_handle_tickets`; products/categories/brands/upload→`can_manage_products`; broadcast/storefront/settings→admin |
| 2 | Unpaid WhatsApp order expiry | 24 hours, then auto-cancel and release stock (configurable) |
| 3 | Rate-limit store | Create an Upstash Redis instance and add `UPSTASH_REDIS_REST_URL/TOKEN` to env |
| 4 | Rotate the Cloudinary key and set `PAYSTACK_SECRET_KEY` | Do both now — they are yours to do; I can't |
| 5 | Brand direction | Decide men's wear vs general retail before we touch nav/categories |
| 6 | `inventory_staff` role before its portal exists | Hide it in the add-staff form until the portal ships |
| 7 | Forced first-login password change | Yes |
| 8 | CI target for RLS/E2E | GitHub Actions + a Supabase branch database |
| 9 | Leftover order 000004 | (b) documented +1 adjustment |
| 10 | Passkey / PIN / phone login (unspecified extras) | Keep only if you want them; otherwise put them behind a flag |

## 11. Definition of done for the whole plan
- QA harness: **all checks green** (including the new ones); zero critical/high findings.
- `authz-matrix.test.ts` proves every route has a declared policy and enforces it.
- Web and dashboard suites green; typecheck clean in both apps; no new lint errors.
- The four Playwright flows pass in CI.
- No secret with a fallback value in source (`grep` gate in CI for known key patterns).
- A short changelog entry per phase and a signed-off sprint log in `docs/sprints/`.

## 12. Risks
| Risk | Mitigation |
|---|---|
| Adding auth breaks admin pages that send no token | Callers are inventoried in §3–4 and updated in the same commit; the E2E flows and harness catch misses |
| Shared routes (`/inquiries`, `/broadcast`, `/brands`, `/orders`) are also used by customers | Split policies per method/query (§4 H3); storefront callers verified before merge |
| Cloudinary key already in git history | Rotation is the only real fix; history rewrite is optional and not recommended on a shared branch |
| Upstash outage | Fail closed for login, fail open with in-memory limiter for read routes, and alert |
| Work lands on an unpushed 36-commit branch | Open PRs to `dev` per phase for review and sign-off |
