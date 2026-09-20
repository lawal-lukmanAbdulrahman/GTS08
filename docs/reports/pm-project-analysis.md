# GTS Platform — Product Analysis Report

**Prepared as:** Senior Product Manager review · **Date:** 2026-09-20 · **Branch analysed:** `store-front` (34 commits ahead of `dev`, unpushed)
**Method:** read the PRD, scope amendments, decision log, testing strategy and all six specs; inventoried every API route (84), every page (33), all 11 migrations and both test suites; cross-checked with a live end-to-end QA run (see `qa-report.md`).

---

## 1. Executive summary

GTS is a unified retail system for a Nigerian men's-wear brand: **one backend, one inventory, four user types, two (now three) sales channels.** The vision in the PRD is sound and the architecture matches it.

**Where it stands:** the *point of sale* and *staff administration* are the most complete and best-tested parts of the product. The *storefront* is visually rich but only partly wired to the real backend. The *employee portal* is not built (four stub pages). Several *platform services* the specs treat as launch-critical (transactional email, cron jobs, real rate limiting, error monitoring, promo engine, support tickets, reviews write path, wishlist/cart APIs) do not exist yet.

| Area | Spec'd scope | Built | Verdict |
|---|---|---|---|
| POS (walk-in + WhatsApp + receipts) | 100% + client extras | ~90% | **Strong.** Promo codes, barcode scan, receipt email missing |
| Staff access, audit, product flags (D003/D004) | client extras | ~90% | **Strong.** |
| Admin dashboard | 12 modules | ~45% | Products, inventory, orders, storefront editor, settings, staff, flags, broadcast built; promos, content slots, categories, email centre, support inbox, customers, deals not |
| Storefront | 10 page groups | ~50% | Pages exist; search/cart/wishlist run on static sample data; no order-success page |
| Employee portal | 5 modules | ~5% | **Stubs only** (`/inventory`, `/orders`, `/tickets`, `/pending` are a heading) |
| Platform (email, cron, rate limit, monitoring, RLS tests) | Sprints 1, 3, 9, 10 | ~25% | Largest launch risk |
| Testing | TDD + RLS + E2E | Unit strong; RLS 1 file (unrun); E2E none | Gap |

**Overall completion of the full spec: roughly 45–50%.** Roughly 70% of *what a store could open with on day one* (walk-in and WhatsApp selling, stock, staff, admin basics) is in place; the online-store revenue path (real cart → Paystack → email → fulfilment) is the main unfinished mile.

**Launch-blocking findings from QA (details in `qa-report.md`)**
1. **Four critical exposures outside the POS code:** `GET /inventory` needs no login; `PUT /storefront/sections` needs no login (anyone can rewrite the homepage); the public product-detail API returns `cost_price`; the Paystack webhook skips signature checking when its secret is blank (and falls back to a public default).
2. **`POST /upload` is unauthenticated** and ships a fallback Cloudinary API key in source; **any cashier can create categories/brands** and **read all orders, inquiries and stock movements**.
3. **Employee portal pages don't exist**, yet the super admin can already create `inventory_staff` accounts who will land on a blank page.
4. **No transactional email, cron, Upstash rate limiting or monitoring** — the PRD's launch success criteria (customer receives lifecycle emails; reservations expire; abuse throttled) cannot be met.

---

## 2. Product, users and channels

| User | Portal | Core job |
|---|---|---|
| Customer | storefront (`gts.ng`) | Browse → cart → guest checkout → Paystack → email → track by order number + email |
| Cashier / sub-admin | `dashboard/pos` | Serve walk-in and WhatsApp customers; every action recorded on their record |
| General employee | `dashboard` (permission-gated modules) | Inventory, orders, products, tickets by grant; "Pending Access" until granted |
| Admin | `dashboard/admin` | Full control; **Super admin** (D004) alone can add staff |

Channels: `online`, `walk_in`, and `whatsapp` (D001, staff-recorded — no WhatsApp Business API).

Business rules that bind every feature: money is integer **kobo** (never floats); UUIDs internally, `GTS-YYYYMM-NNNNNN` order numbers publicly; UTC stored, **WAT (UTC+1)** shown; statuses are DB-CHECKed string enums with a strict state machine; RLS on every table; `cost_price` never public; Paystack **webhook is the only** thing that marks an order paid; delivery/driver system is **removed** (Amendment 001).

---

## 3. Documentation inventory and requirements traceability

### 3.1 Documents that define requirements

| Document | Type | What it governs | Health |
|---|---|---|---|
| `docs/PRD.md` | Functional (summary) | Vision, users, 8 capabilities, success criteria, risks | Good; defers to specs |
| `specs/gts_00_project_overview.md` | Functional + NFR | Architecture, conventions, permission matrix, 11-sprint plan, 10 open business questions | Good |
| `specs/gts_01_backend_spec.md` (2,055 lines) | Functional + NFR | 32-table schema, all routes, business logic, emails, cron, **security contracts, rate limits** | Authoritative; large |
| `specs/gts_02_storefront_spec.md` | Functional + NFR | Pages, psychology rules, UX rules, **performance budgets** | Good |
| `specs/gts_03_cashier_spec.md` | Functional | POS behaviour | Good; **now extended by D001–D004** |
| `specs/gts_04_employee_portal_spec.md` | Functional | Employee modules | Good; unbuilt |
| `specs/gts_05_admin_dashboard_spec.md` | Functional | 12 admin modules | Good; ~45% built |
| `specs/gts_06_flowcharts.md` | Functional | Flows | Reference |
| `03-scope-amendments.md` | Change control | Delivery removal; revised order state machine | Binding |
| `00-open-questions.md` | Decision log | D001–D004 | Current (updated this cycle) |
| `01-testing-strategy.md` | NFR (quality) | TDD, per-layer test rules, gate command | Good |
| `02-sprint-workflow.md` | Process | Sprint gate + sign-off | Good |
| `CLAUDE.md` | Engineering rules | Conventions, security contracts, "never do" | Good |

### 3.2 Documentation gaps found (fix these)
1. **Spec index in `CLAUDE.md` doesn't match the filenames** (it lists `gts_01_overview`, `gts_04_delivery`, `gts_05_cashier`…; the folder has `gts_00_project_overview`, `gts_04_employee_portal`, `gts_03_cashier`…). New contributors will open the wrong file.
2. **`PRD.md` §9 refers to business questions A1–A10 "requiring owner input", but `00-open-questions.md` has no Section A.** The ten questions exist only in overview §11 — and are unanswered (courier partner, size system, returns policy, Paystack live verification, `hello@gts.ng` domain, launch product count, low-stock default, free-shipping threshold, WhatsApp number). Several block real features (returns, shipping tiers, emails).
3. **`sprints/sprint-01.md` is an empty template; no sprint has been logged or signed off** although substantial work exists. The governance model ("nothing merges without sign-off") is not being followed on paper.
4. **Spec API map vs reality:** spec routes `/checkout/initiate`, `/checkout/reserve`, `/auth/anonymous`, `/promos/email-capture`, `/pos/sale` differ from what is built (`/checkout`, no anonymous auth). Either update the spec or the code.
5. **No environment/runbook doc** for the dev-port collision (dashboard hard-coded `localhost:3000`; fixed this cycle via `NEXT_PUBLIC_API_URL`, undocumented until now).
6. **No data-model doc for the additive migrations** (`00003`–`00011`); migration `00002` is missing from the sequence.

---

## 4. Feature catalogue — how each feature should behave, and where it stands

Legend: ✅ done · 🟡 partial · ❌ not built · 🔒 done but has a defect (see QA)

### 4.1 Point of sale (cashier spec + D001–D004)

| # | Feature | Expected behaviour (PRD) | Status |
|---|---|---|---|
| P1 | Access & login | Staff with `can_process_pos` reach `/pos`; everyone else refused; permissions re-read from DB on every request; blocked accounts cut off on the next call | ✅ |
| P2 | Two-panel layout | Search left, cart right, both always visible; no navigation mid-sale; tablet-friendly | ✅ (scroll/checkout-visibility fixed this cycle) |
| P3 | Products on load | Grid shows best sellers before any search; category tabs; "Load more"; 300 ms debounced search by name/SKU | ✅ |
| P4 | Stock badges + variants | In stock / Low / Out; out-of-stock not addable; single-variant products add in one tap, multi-variant open a size/colour modal | ✅ |
| P5 | Product pictures | Show catalogue image; graceful placeholder if missing | ✅ (fixed this cycle; 28 of 46 stored images are dead paths → data clean-up needed) |
| P6 | Cart | Steppers capped at available stock; remove; live totals in kobo | ✅ |
| P7 | Manual discount | Needs `can_apply_discounts`; cashier ≤ 20% of subtotal, admin unlimited; validated server-side; audited | ✅ |
| P8 | Promo codes | Validated code applies a discount | ❌ (`/promos/validate` stub; explicitly deferred by owner) |
| P9 | Payment | Cash (with exact change calc) or card terminal; confirmation modal; optional customer email | ✅ |
| P10 | Sale creation | Stock re-validated at confirmation; race-safe (compare-and-swap, all-or-nothing with rollback); order `GTS-…` created `completed`; movement + audit logged | ✅ 🔒 input validation fixed this cycle |
| P11 | Receipt | Print for 58 mm / 80 mm / A4; store details from admin settings; WhatsApp share (wa.me); no server WhatsApp send | ✅ (no real-printer test) |
| P12 | Reprint | Own sales only (admin any); audited; marked **DUPLICATE**; voided sales can't be reprinted | ✅ |
| P13 | Today's orders | Own walk-in/WhatsApp orders for the **Lagos day** | ✅ |
| P14 | Void | Needs `can_void_orders`; own sales only (admin any); same-day; reason mandatory; stock restored; audited | ✅ |
| P15 | WhatsApp order — record | Staff builds cart from chat; customer name+phone required; stock **reserved**; order number given to customer | ✅ |
| P16 | WhatsApp order — confirm | Cashier picks from the pending list (or types the number), takes payment; reservation converts to sale; exactly one of confirm/cancel wins | ✅ |
| P17 | WhatsApp order — cancel | Reason required; reserved stock released | ✅ |
| P18 | Unpaid WhatsApp expiry | Old unpaid orders should lapse and free their reserved stock | ❌ (stock stays reserved forever) |
| P19 | Session security | Idle warning at 25 min, lock at 30; unlock by password; cart survives | ✅ |
| P20 | Flag a product | Cashier raises a ticket-like flag (reason + note); one open flag per person/product/reason; admin reviews | ✅ |
| P21 | Barcode scan | Scanner types SKU + Enter → exact variant preselected | 🟡 API exists (`/pos/products/:sku`); UI Enter-to-scan not wired (spec says Phase 2) |
| P22 | Keyboard shortcuts | Ctrl/Cmd+Enter confirm, Esc clear | ❌ (Phase 2) |
| P23 | POS receipt email | Email receipt if customer email given | ❌ (template exists; no sending) |

### 4.2 Staff accounts, access and audit (client additions)

| # | Feature | Expected behaviour | Status |
|---|---|---|---|
| S1 | Staff profile | Name, role, phone (editable), password change, access list ("you can / can't"), own sales and activity | ✅ |
| S2 | Sign in/out | Sign-out revokes + clears cookies; expired/blocked sessions bounce to login with a reason | ✅ |
| S3 | Permission flags | 7 grants; admin implicit; changes effective on the very next request | ✅ (only POS flags are *enforced*; others gate by role — see QA) |
| S4 | Admin staff record | Any cashier's profile, permissions, block/unblock, sales by range, activity | ✅ |
| S5 | Audit trail | Every staff write action logged with actor, target, details, IP; cashiers see own, admins all | ✅ |
| S6 | Super admin adds staff | Only the super admin can create cashier / inventory / admin accounts with chosen grants; one-time password shown once | ✅ |
| S7 | Staff invitation email | Magic-link invite email | ❌ (replaced by one-time password; no forced change on first login) |
| S8 | Admin edits/blocks other admins; transfer super admin | — | ❌ |
| S9 | Product flag queue | Status tabs with counts; start review; resolve/dismiss needs a note; reopen | ✅ |

### 4.3 Admin dashboard (admin spec)

| # | Module | Expected behaviour | Status |
|---|---|---|---|
| A1 | Shell | Sidebar, breadcrumbs, notifications bell, dark mode | ✅ (now also wraps POS for admins) |
| A2 | Home KPIs | Revenue, orders, channel split, chart, recent orders, top products, low stock | 🟡 UI 1,600 lines; `/analytics/overview` live; `/analytics` stub |
| A3 | Orders | Filter, state-machine transitions, notes, CSV export, tracking info | 🟡 list + status live; detail/PATCH stub (`/orders/[id]`) |
| A4 | Products | CRUD, 6-tab editor, drafts, Excel import, Cloudinary upload | ✅ largely (create/edit live; delete/pricing rules unverified) |
| A5 | Categories | CRUD | 🟡 list/create only (`/categories/[id]` stub); creation is **not permission-gated** 🔒 |
| A6 | Inventory | Table, adjust, movements, bulk restock, Excel | 🟡 adjust/movements live; `/inventory/adjustments` stub; **read is public** 🔒 |
| A7 | Deals & promos | Promo CRUD, atomic usage | ❌ |
| A8 | Content slots | Homepage managed without a developer | 🟡 storefront section editor exists (`/storefront/sections`); spec'd `content-slots` API is stub |
| A9 | Email centre | Campaigns, audience, bulk send | ❌ (a "broadcast" module exists but is a different feature) |
| A10 | Support inbox | Tickets, assign, reply, internal notes | 🟡 "questions" module exists (customer inquiries); spec'd `/tickets` API is stub |
| A11 | Staff & customers | Staff list/permissions ✅; customer list ❌ | 🟡 |
| A12 | Settings | Store info ✅ (D002); shipping tiers ❌; thresholds ❌; integration status ❌ | 🟡 |

### 4.4 Storefront (storefront spec)

| # | Feature | Expected behaviour | Status |
|---|---|---|---|
| W1 | Homepage | Hero, featured, bestsellers, category links; ISR | 🟡 built; data source mixed |
| W2 | Category/shop pages | Filter sidebar, grid, ISR | 🟡 |
| W3 | Product detail | Gallery, variants, trust strip, real-scarcity signals, reviews | 🟡 (6 API calls) |
| W4 | Search | Full-text on name/tags/description | 🟡 UI runs on **static sample data**, not the live `/products/search` |
| W5 | Cart | Optimistic, 30-day persistence, server-synced, free-shipping bar | 🟡 client context + localStorage; `/cart` API is a stub |
| W6 | Checkout | 3-step, guest-first, stock reservation (20 min), Paystack inline | 🟡 `/checkout` + webhook live; never exercised against real Paystack; **no `/checkout/success` page** |
| W7 | Paystack webhook | HMAC-SHA512 first; idempotent; only path that marks paid | ✅ (rejects unsigned/forged calls) |
| W8 | Order tracking | Order number **and** email required | ✅ |
| W9 | Customer account | Orders, addresses, wishlist, profile, register/login | 🟡 large page; 9 API calls; passkeys/PIN/phone auth exist beyond spec |
| W10 | Wishlist | Persisted | 🟡 local only; API stub |
| W11 | Reviews | Verified-purchase, admin-moderated | 🟡 read only |
| W12 | Promo codes / email capture | Welcome discount | ❌ |
| W13 | Size guides | Per category | ❌ (stub) |

### 4.5 Employee portal (employee spec) — **not built**

`/pending` (live "Pending Access" screen with Realtime), `/inventory` (+movements, bulk restock), `/orders`, `/products`, `/tickets`, shared nav, `/profile`: **all ❌** (four 9-line stubs). Only `/profile` (built for staff generally) exists. Because middleware routes `inventory_staff` to `/inventory`, **an inventory employee currently gets a blank page.**

### 4.6 Platform services

| # | Service | Expected | Status |
|---|---|---|---|
| X1 | Transactional email (Resend) | 13 lifecycle emails | ❌ 2 of 13 templates, no sender wired |
| X2 | Cron | Release expired reservations (5 min), low-stock alerts (hourly), expire orders, review requests | ❌ routes are stubs; no pg_cron in migrations |
| X3 | Rate limiting | Upstash sliding window, per-user tiers | 🟡 in-memory, **per-IP** (see §5) |
| X4 | Realtime | Permissions → Pending screen; notifications | ❌ |
| X5 | Monitoring | Sentry | ❌ |
| X6 | Notifications API | Admin notifications | ❌ stub |
| X7 | RLS | On every table with a test per policy | 🟡 RLS enabled (event trigger); **1 pgTAP file, never run**, no CI |
| X8 | E2E | Playwright on critical flows | ❌ none exist |
| X9 | Idempotency | Mutations replay-safe | ✅ (`idempotency_keys`, client helper) |
| X10 | Passkeys/PIN/phone login | (not in spec) | ✅ extra, unspecified — needs a spec/owner decision |

---

## 5. Non-functional requirements — target vs. status

| NFR | Target (source) | Status | Note |
|---|---|---|---|
| Security: RLS everywhere | Backend spec Part 9 #1 | 🟡 | Enabled; policy tests missing |
| Security: authZ on every protected route | CLAUDE.md, Part 9 | 🔴 | 9 of ~60 live routes fail the QA authZ matrix (inventory, storefront sections, upload, categories, brands, orders, movements, inquiries, broadcast); POS/staff/admin routes all pass |
| Security: secrets server-side, `cost_price` private | Part 9 #2, #7 | 🔴 | `cost_price` leaks in public **product detail**; POS/list responses are clean; a Cloudinary API key is hard-coded as a fallback |
| Security: Paystack HMAC first | Part 9 #3 | 🔴 | Skipped when the secret is blank/dummy (fails open) |
| Security: rate limits | Part 5.2 | 🟡 | Login 5/min ✅; sales limited **per IP**, in-memory: a store's till PCs share one NAT address, so all cashiers share one 15-sales/min budget; not shared across serverless instances |
| Security: blocked-user check cached 60 s | Part 9 #10 | ✅ (stricter: checked every request) |
| Performance: LCP < 2.5 s, CLS < 0.1, INP < 200 ms, JS < 150 kB, Lighthouse ≥ 85 | Storefront Part 4 | ❓ Not measured; storefront pages are 1,700–4,900-line client components and hero uses static data |
| Performance: POS action feedback < 500 ms | Cashier Part 8 | ✅ by design; not benchmarked |
| Accessibility: WCAG AA, 44 px targets, keyboard nav | Storefront Part 3 | ❓ Not audited |
| Reliability: no oversell across channels | PRD success #2 | ✅ Proven by parallel-sale test |
| Reliability: reservations expire | Part 8 | 🔴 No cron |
| Auditability: manual discounts + staff actions | Cashier Part 8 #5 | ✅ |
| Data integrity: money in kobo integers | CLAUDE.md | ✅ (float-free Naira parsing added) |
| Time: WAT display, UTC store | Conventions | ✅ (Lagos-day boundaries tested) |
| Observability: request logging, Sentry | Part 5.4, overview | ❌ |
| Testing: TDD; unit+RLS+E2E; typecheck+lint clean | Testing strategy | 🟡 unit ✅; typecheck ✅ (1 known dep error); **lint: 117 errors, all in older files**; RLS/E2E ❌ |
| Delivery governance: sprint sign-off | Workflow | 🔴 not being recorded |

---

## 6. What is done vs. what is left

### 6.1 Done (this engagement, on `store-front`)
Walk-in and WhatsApp sales with race-safe stock; void / cancel / reprint; 3-paper-size receipts; admin-managed store details; permissioned discounts (20% cap); per-cashier void/discount grants; ownership-scoped voids; product flags + admin queue; staff profile, sign-out, idle lock; admin staff record (sales, activity, permissions, block); super-admin staff creation; products-on-load and categories; large-type scrollable POS with admin sidebar; image fallback; configurable API URL; 535 web + 369 dashboard unit tests; QA-found input-validation fixes.

### 6.2 Left to complete (prioritised)

**P0 — before any real users**
0. **Close QA criticals C1–C4 and H1–H3:** auth on `/inventory`, `/storefront/sections`, `/upload`; strip `cost_price` from public product detail; make the Paystack webhook fail closed; rotate the Cloudinary key.
1. Gate `/inventory*`, `/orders`, `/broadcast`, `/inquiries` reads and `/categories`, `/brands` writes by permission; audit **all** 62 live routes with a route-level authZ test matrix in CI.
2. Build the employee portal shell + `/pending` so `inventory_staff` and other non-admins don't hit stubs (or stop offering those roles until it exists).
3. Apply and verify RLS tests in CI (`pnpm test:rls`).
4. Real distributed rate limiting keyed by **user id** for POS routes.
5. Add first-login forced password change for staff created with a one-time password.

**P1 — required for online revenue**
6. Server-side cart (`/cart`), reservations (20 min) and the two cron jobs; checkout success page; connect storefront search/cart/wishlist to live APIs.
7. Resend sender + 11 missing email templates; verify `gts.ng` domain.
8. Paystack live-mode verification and an end-to-end test purchase.
9. Order detail/PATCH (state machine, tracking fields, cancellation) and admin CSV export.

**P2 — admin completeness**
10. Promos (API + UI + POS integration), categories CRUD, content slots, customers, email centre, support tickets, settings (shipping tiers, thresholds, integration status).

**P3 — quality and polish**
11. Playwright E2E for the 4 critical flows; Lighthouse/a11y audit; Sentry; expire unpaid WhatsApp orders; barcode Enter-to-add; keyboard shortcuts; data clean-up of the 28 dead image paths; lint debt.

**Owner decisions still needed (block work):** courier/tracking format, size system, returns policy, Paystack live status, `hello@gts.ng` verification, free-shipping threshold, launch product count, WhatsApp support number, whether passkey/PIN/phone login is in scope, and how staff should be onboarded (email invite vs one-time password).

### 6.3 Suggested next three sprints
1. **Hardening (1 wk):** P0 items 1, 3, 4, 5 + record sprint sign-off.
2. **Employee portal + inventory (2 wk):** spec Part 1–3 with permission gating and Realtime pending screen.
3. **Online revenue path (3 wk):** cart API → reservation → Paystack → email → success/track, with an E2E test.

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Public stock/order endpoints | Competitive leakage, trust | P0-1 |
| Staff roles offered that have no UI | Confusing first-day experience | P0-2 or hide roles |
| Client-heavy storefront pages (thousands of lines) | Fails LCP/JS budgets, hard to maintain | Split, server-render, measure |
| Paystack live verification lead time | Delays launch | Start now |
| Unreviewed/unsigned work accumulating on an unpushed branch | Merge risk | Open PR to `dev` in slices; record sign-off |
| In-memory limiter behind serverless | Ineffective in production | Upstash |
