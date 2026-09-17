# GTS Platform — Project Overview

**Version:** 2.2  
**Date:** June 2026  
**Classification:** Master Planning Document  
**Status:** Authoritative — supersedes all v1.x and v2.0/2.1 docs

**Document set:**
```
gts_00_project_overview.md       ← this document
gts_01_backend_spec.md           ← database, API, security
gts_02_storefront_spec.md        ← customer-facing site
gts_03_cashier_spec.md           ← POS portal
gts_04_employee_portal_spec.md   ← general staff portal
gts_05_admin_dashboard_spec.md   ← admin portal
gts_06_flowcharts.md             ← screen-to-screen navigation flows
```

---

## 1. The Vision

GTS is a Nigerian men's wear brand. What we are building is not a standard e-commerce store. It is a **unified retail operating system** that merges two mental models:

- **Jumia / online storefront** — customers browse, discover, and buy from any device, anywhere.
- **Justrite / in-store POS** — walk-in customers are served by cashiers using the same inventory and order system, just through a different interface.

On top of these two sales channels sits a **general employee portal** (inventory management, order visibility) and a **full admin dashboard** (the owner's command centre for the whole business).

One backend. One inventory. Four types of users. Every sale — online or in-store — touches the same products, the same stock, the same order pipeline.

**Fulfillment for online orders is handled via third-party couriers** (e.g., GIG, Kwik, DHL — see Open Questions). There is no in-house delivery driver app in this build. Admin manually progresses an order's status and can attach a courier's tracking number and name once dispatched. The customer sees this tracking info on the public order tracking page.

---

## 2. User Types & Their Portals

### 2.1 Customer (Online)
**Who:** Anyone who visits `gts.ng`.  
**Access level:** Public. No account required to browse or purchase.  
**Portal:** The storefront (`gts.ng`).  
**Key experience:** Browse the catalog → Add to cart → Checkout anonymously using name, email, phone, address → Pay via Paystack → Receive confirmation email → Track order by order number + email.  
**Account creation:** Optional. Prompted post-checkout ("Save your details for next time"). Registered accounts unlock order history and saved addresses.

### 2.2 Cashier
**Who:** In-store GTS staff who serve walk-in customers at a physical till.  
**Access level:** Employee with cashier permission (`can_process_pos = true`).  
**Portal:** `dashboard.gts.ng/pos/*`  
**Key experience:** Search products by name or SKU → Build the customer's cart → Apply discounts → Confirm cash or terminal payment → Print/send receipt → Order auto-created (channel: `walk_in`).  
**Device:** Optimized for tablet landscape in-store. Desktop supported.

### 2.3 General Employee
**Who:** GTS staff assigned non-cashier roles — e.g., inventory manager, order processor.  
**Access level:** Employee. Specific permissions granted by admin per `employee_permissions` table.  
**Portal:** `dashboard.gts.ng/*` (accessible features depend on permissions).  
**Key experience:** If no permissions granted → "Pending Access" screen (live-polls for permission changes). As permissions are granted → relevant modules unlock in real-time.

### 2.4 Admin
**Who:** GTS business owner and designated super-users.  
**Access level:** Full unrestricted access to all portals and all data.  
**Portal:** `dashboard.gts.ng/admin/*`  
**Key experience:** Full analytics + financial overview → Manage products, inventory, categories → Manage orders across both channels (including marking shipped with courier tracking info) → Manage all staff accounts and permissions → Email campaigns → Support tickets → System settings.

---

## 3. System Architecture

```
┌─────────────────────────────────────┐
│         gts.ng  (Storefront)         │
│    Next.js 15 — App Router           │
│  • Public product catalog (ISR)      │
│  • Cart + Checkout (SSR)             │
│  • Customer account pages            │
│  • ALL API Route Handlers            │
│    (gts.ng/api/v1/*)                 │
└───────────────┬─────────────────────┘
                │  REST (JWT auth)
                │
┌───────────────▼─────────────────────┐
│      dashboard.gts.ng  (Staff App)  │
│    Next.js 15 — App Router           │
│  • /login          — all staff       │
│  • /pending        — unassigned      │
│  • /admin/*        — admin role      │
│  • /pos/*          — cashier role    │
│  • /inventory/*    — inv. staff      │
│  • /orders/*       — order access    │
└─────────────────────────────────────┘
                │
                │ (same API)
                │
┌───────────────▼─────────────────────┐
│              Supabase                │
│  PostgreSQL (all tables + RLS)       │
│  Supabase Auth (JWTs, anon, magic)  │
│  Supabase Realtime (live updates)   │
└───────────────┬─────────────────────┘
                │
     ┌──────────┴──────────┐
     │                     │
┌────▼───────┐    ┌────────▼────────┐
│ Cloudinary  │    │  Paystack        │
│ (images)    │    │  (online pay)   │
└────────────┘    └─────────────────┘
     │
┌────▼───────────────────────────────┐
│  Upstash Redis (Vercel add-on)     │
│  • Rate limiting (Edge middleware)  │
│  • Cart reservation caching         │
└────────────────────────────────────┘
     │
┌────▼───────────────────────────────┐
│  Resend + React Email              │
│  All transactional emails           │
└────────────────────────────────────┘
```

**Key architectural decisions:**

1. **Storefront hosts the API.** `gts.ng` Next.js app serves both public pages AND all API Route Handlers at `/api/v1/*`. The dashboard is a pure frontend calling this API. No business logic in any dashboard frontend.
2. **One inventory, two channels.** Both online checkout (Paystack webhook) and POS (cashier confirms payment) decrement the same `inventory` table.
3. **Supabase Auth for all users.** Anonymous sessions for guest checkout. Persistent sessions for registered users and all staff. Custom JWT claims inject `role` so middleware can gate without a DB query.
4. **RLS is the final defense.** Every table has RLS. Even if the API has a bug, the database refuses to return unauthorized data.
5. **Cloudinary via backend only.** All uploads proxy through `/api/v1/upload`. The Cloudinary API secret never touches the client.
6. **Paystack webhook is the only fulfillment trigger.** The frontend success callback is cosmetic only — it never marks an order as paid.
7. **Shipping is courier-based, not app-managed.** Admin marks an order `shipped` and attaches a tracking number + carrier name manually. There is no internal driver app, GPS tracking, or proof-of-delivery photo capture in this build.

---

## 4. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Storefront + API | Next.js 15 (App Router) | ISR for SEO, Route Handlers for API, single deployment |
| Dashboard (staff) | Next.js 15 (App Router) | Consistent stack across team |
| Database | Supabase (PostgreSQL 15) | Managed Postgres, built-in Auth, Realtime, RLS, pg_cron |
| Auth | Supabase Auth | Anonymous auth, JWT sessions, magic links, custom claims hook |
| File storage | Cloudinary | Image transformations at URL level, no re-upload needed |
| Payments | Paystack | Nigerian market native — card, bank transfer, USSD |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` | Serverless-compatible, Vercel Edge middleware, sliding window |
| Transactional email | Resend + React Email | Reliable delivery, developer-friendly, bulk send for campaigns |
| Hosting | Vercel | Both Next.js apps on Vercel serverless + edge |
| Monitoring | Sentry | Error tracking for both apps |
| Analytics | Vercel Analytics | Core Web Vitals + visitor data |

---

## 5. Monorepo Structure

```
gts/
├── apps/
│   ├── web/                       ← Storefront + API (gts.ng)
│   │   ├── app/
│   │   │   ├── (storefront)/      ← Public routes (SEO-indexed)
│   │   │   │   ├── page.tsx
│   │   │   │   ├── shop/[slug]/
│   │   │   │   ├── product/[slug]/
│   │   │   │   ├── cart/
│   │   │   │   ├── checkout/
│   │   │   │   ├── account/
│   │   │   │   ├── track/
│   │   │   │   └── search/
│   │   │   └── api/v1/            ← ALL API Route Handlers
│   │   │       ├── auth/
│   │   │       ├── products/
│   │   │       ├── categories/
│   │   │       ├── cart/
│   │   │       ├── checkout/
│   │   │       ├── orders/
│   │   │       ├── pos/
│   │   │       ├── inventory/
│   │   │       ├── reviews/
│   │   │       ├── wishlist/
│   │   │       ├── promos/
│   │   │       ├── tickets/
│   │   │       ├── users/
│   │   │       ├── analytics/
│   │   │       ├── notifications/
│   │   │       ├── content-slots/
│   │   │       ├── email-campaigns/
│   │   │       ├── settings/
│   │   │       ├── size-guides/
│   │   │       ├── upload/
│   │   │       └── webhooks/
│   │   ├── middleware.ts           ← Rate limiting + CORS
│   │   └── public/
│   │       ├── llms.txt
│   │       └── robots.txt
│   │
│   └── dashboard/                 ← Staff portal (dashboard.gts.ng)
│       ├── app/
│       │   ├── login/
│       │   ├── pending/
│       │   ├── admin/
│       │   ├── pos/
│       │   ├── inventory/
│       │   ├── orders/
│       │   ├── tickets/
│       │   └── profile/
│       └── middleware.ts           ← Auth guard + role routing
│
├── packages/
│   ├── database/                   ← Supabase client, generated types
│   ├── ui/                         ← Shared components
│   ├── types/                      ← Shared TypeScript interfaces
│   └── utils/                      ← Money, dates, slugs
│
├── supabase/
│   ├── migrations/                 ← All SQL migration files (numbered)
│   ├── seed.sql
│   └── functions/                  ← Edge functions for cron jobs
│
└── turbo.json
```

---

## 6. Shared Data Conventions

### 6.1 IDs
All IDs are **UUID v4**. Never sequential integers in URLs. Use `slug` for product/category URLs. Use `order_number` for order tracking. UUID in internal APIs only.

### 6.2 Money
All monetary values stored in **kobo** (1 Naira = 100 kobo). Paystack natively uses kobo. Never do arithmetic on Naira values — always work in kobo in backend and DB. Format for display only: `₦` + `(kobo / 100).toLocaleString('en-NG')`.

### 6.3 Timestamps
All stored as **TIMESTAMPTZ** (UTC) in the database. Display in West Africa Time (UTC+1). Utility function in `packages/utils/date.ts` handles all conversion.

### 6.4 Images
Cloudinary `public_id` only in the database. Full URL constructed at display time:
```
https://res.cloudinary.com/<cloud>/image/upload/q_auto,f_auto,w_800/gts/products/abc123
```

### 6.5 Slugs
Lowercase, hyphen-separated, globally unique per entity type. Auto-generated from name. Regex enforced: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.

### 6.6 Order Numbers
Format: `GTS-YYYYMM-NNNNNN`. Example: `GTS-202606-000142`. Generated by a Postgres function using a `order_number_seq` sequence. Never use UUIDs in order tracking URLs.

### 6.7 Status Enums
All status fields use human-readable string enums. Never integers. Database-level `CHECK` constraint enforces valid values.

### 6.8 Environment Variables
- `NEXT_PUBLIC_*` prefix only for values genuinely safe to expose (Supabase anon key, Paystack public key, Cloudinary cloud name).
- All secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`) are server-only.

---

## 7. Order State Machine

### Online Orders
```
PENDING_PAYMENT
    │ (Paystack webhook: charge.success)
    ▼
  PAID
    │ (admin confirms)
    ▼
CONFIRMED
    │ (staff packs)
    ▼
PROCESSING
    │ (admin hands off to courier, enters tracking_number + carrier_name)
    ▼
SHIPPED
    │ (admin marks delivered — either manually or customer confirms receipt)
    ▼
DELIVERED

At any point before SHIPPED:
    → CANCELLED (admin action, reason required)

After delivery:
    → RETURN_REQUESTED (customer)
    → REFUNDED (admin action)
```

### POS / Walk-in Orders
```
PENDING → COMPLETED
    │
    └── VOIDED (same-day only, cashier or admin)
```

---

## 8. Employee Permission Matrix

| Permission Flag | Effect |
|---|---|
| `can_process_pos` | Access to `/pos/*` POS portal |
| `can_manage_inventory` | Access to `/inventory/*`, can adjust stock |
| `can_view_all_orders` | Access to `/orders/*`, can view + update order status |
| `can_manage_products` | Can create/edit products (not delete, not pricing) |
| `can_handle_tickets` | Access to `/tickets/*`, can reply to support tickets |

Note: `role = 'admin'` bypasses all permission flags — full access everywhere.

---

## 9. Sprint Plan

**Team:** 2 developers  
- **Dev A:** Backend-focused (Supabase, API routes, auth, data model, security)  
- **Dev B:** Frontend-focused, backend-capable (UI, integrations, can write API routes)  

**Sprint duration:** 2 weeks  
**Total sprints:** 11 (22 weeks / ~5 months)  
**Delivery model:** Single commissioned product. All features ship. Sprints are internal work organization, not phased client delivery.

---

### Sprint 1 — Weeks 1–2: Infrastructure & Foundation
**Goal:** Both apps running, fully wired to Supabase, deployable.

| Dev A (Backend) | Dev B (Frontend) |
|---|---|
| Supabase project: full schema migration (all tables from spec), auth config (anonymous enabled, email/password, custom JWT claims hook, RLS on all tables) | Turborepo monorepo init, both Next.js 15 apps (`web` + `dashboard`), shared packages scaffold |
| Upstash Redis setup, rate limiting middleware skeleton, CORS config | Global layouts (fonts, Tailwind, color tokens), shared UI component library bootstrap |
| Cloudinary account setup, upload proxy route `/api/v1/upload` | Supabase browser client setup in both apps, auth context/provider |
| Environment variables: Vercel project setup, all secrets configured | CI/CD: Vercel deployments for both apps on push to main |
| **Deliverable:** All migrations run, API returns `{ status: 'ok' }` from base route | **Deliverable:** Both apps deploy to Vercel, login page renders, env vars connected |

---

### Sprint 2 — Weeks 3–4: Product Catalog
**Goal:** Full product catalog browsable. ISR working.

| Dev A | Dev B |
|---|---|
| Products API (CRUD + search + slug lookup), Categories API, Inventory read routes | Homepage (hero, featured products, bestsellers, category quick links) |
| Cloudinary upload proxy: image validation, size limits, format enforcement | Category pages with filter sidebar and product grid (ISR) |
| RLS for products, categories, inventory, product_variants tables | PDP — full implementation (gallery, variants, add to cart UI stub, trust strip, accordion) |
| Product search: Supabase full-text `to_tsvector` on name + tags + description | Product card component (all badges, quick-add desktop hover) |
| **Deliverable:** Admin can create a product via API. Products render on storefront. | **Deliverable:** Homepage + category + PDP fully render from real API data. |

---

### Sprint 3 — Weeks 5–6: Cart, Checkout & Payments
**Goal:** End-to-end online purchase flow working in test mode.

| Dev A | Dev B |
|---|---|
| Cart session API (CRUD, merge, validate), Checkout reservation system with expiry | Cart page (items, quantity stepper, promo code, free shipping bar, cross-sell) |
| `POST /checkout/initiate` — creates order, calls Paystack API | Cart drawer (slide-in, persistent, works from all pages) |
| Paystack webhook handler (signature verify, idempotency via `webhook_events`, stock decrement) | Checkout (3-step: Contact/Delivery, Review, Payment with Paystack inline) |
| Resend setup: order confirmation email, transactional email templates | Order success page + account creation prompt |
| Cron: `release_expired_reservations` | Order tracking public page |
| **Deliverable:** Full test purchase completes. Webhook processes. Email arrives. | **Deliverable:** Customer can buy a product end-to-end in Paystack test mode. |

---

### Sprint 4 — Weeks 7–8: POS / Walk-in Channel
**Goal:** Cashier can log in and process a walk-in sale.

| Dev A | Dev B |
|---|---|
| POS product search API (by name + SKU/barcode), Walk-in order creation API, Void API | Dashboard app: login page (shared auth), role-routing middleware, pending screen |
| Rate limiting: all API routes configured with Upstash (see backend spec §Rate Limits) | POS portal: 2-panel layout (search left, cart right) |
| POS receipt email template (Resend) | Variant selector modal, cart panel, payment confirmation flow |
| RLS for POS-specific data access | Receipt print component (`@media print` CSS) |
| **Deliverable:** Cashier can log in, process a walk-in sale, void an order. Receipt prints. | **Deliverable:** Full POS flow operational on tablet browser. |

---

### Sprint 5 — Weeks 9–10: Inventory + Employee Portal
**Goal:** Employee can manage stock. Pending screen works live.

| Dev A | Dev B |
|---|---|
| Inventory adjust/restock API, Stock movement logging, Activity logging middleware | Inventory table + filter + status badges |
| Employee permissions API (admin creates, reads, updates perms) | Adjust stock slide-out panel, bulk restock page |
| RLS for `employee_permissions`, permission-gated routes | Stock movement history page |
| Supabase Realtime: `employee_permissions` subscription for pending screen live update | Pending screen with Realtime subscription |
| **Deliverable:** Admin grants employee inventory permission. Employee sees inventory, adjusts stock. Cron: low-stock alert generation. | **Deliverable:** Inventory module fully functional. Permissions change → screen updates live. |

---

### Sprint 6 — Weeks 11–12: Order Management & Admin Dashboard Core
**Goal:** Admin has full analytics, order management (including manual shipping/tracking entry), staff management.

| Dev A | Dev B |
|---|---|
| Analytics API (overview KPIs, sales chart, channel split, top products, customer count) | Admin layout (sidebar, header, breadcrumbs, notification bell) |
| Full order management API (list with filters, status updates incl. shipped + tracking fields, cancel, notes, CSV export) | Dashboard home: KPI cards with sparklines, revenue chart (recharts), recent orders, top products |
| Staff management API (invite, role change, permission update, block/unblock) | Order list + detail (status timeline, items, payment info, shipping/tracking section) |
| Admin notification routes (GET, mark-read) | Staff management UI (list, invite form, permission toggles, block actions) |
| **Deliverable:** Admin can see business health at a glance. Manage any order incl. marking shipped with courier info. Manage all staff. | **Deliverable:** Admin dashboard is fully operational for core daily use. |

---

### Sprint 7 — Weeks 13–14: Admin Full Feature Set
**Goal:** Admin has content management, promos, support inbox, email campaigns.

| Dev A | Dev B |
|---|---|
| Promo codes API (full CRUD, email-capture route, `promo_code_uses` atomicity) | Admin product editor (all 6 tabs including variants, images, SEO) |
| Content slots API, Email campaigns API + Resend bulk send integration | Admin categories CRUD, content slots manager |
| Support tickets full API (create, assign, reply, internal notes, status) | Admin deals/promos UI, admin support inbox + ticket detail |
| `email_campaigns` sending: batch processing, per-recipient logging | Admin email center (campaign list, compose flow, audience selector) |
| **Deliverable:** Admin runs promotions, manages content, replies to support tickets, sends email blasts. | **Deliverable:** All admin modules complete. |

---

### Sprint 8 — Weeks 15–16: Reviews, Wishlist, Customer Account
**Goal:** Customer experience complete. Reviews live. Wishlist works.

| Dev A | Dev B |
|---|---|
| Reviews API (create verified, admin approve, list by product, pending reviews) | PDP reviews section (display, rating breakdown, write review modal) |
| Wishlist API (add, remove, get by user), Customer profile API, Address CRUD | Account pages (orders, addresses, wishlist, profile, password change) |
| Size guides API, `size_guides` table populated | Size guide modal on PDP (rendered from DB, per category) |
| Admin customer list + profile API, Email marketing opt-out | Admin customers list + customer profile pages |
| **Deliverable:** Customer has a full account experience. Reviews go live after admin approval. | **Deliverable:** All customer-facing account functionality complete. |

---

### Sprint 9 — Weeks 17–18: Realtime, Notifications, Settings
**Goal:** Live updates across all portals. Settings configurable from admin.

| Dev A | Dev B |
|---|---|
| Admin notifications: Realtime broadcast, low-stock cron finalization, all notification triggers | Notification bell dropdown (live unread count, last 10 notifications, mark read) |
| Settings API (full CRUD for `settings` singleton), Delivery options (shipping tiers) CRUD | Admin settings page (store info, shipping tiers, thresholds, integration status) |
| Cron deployment: all cron jobs configured in Supabase + Vercel | `users.total_orders/total_spent` cache update hooks |
| Full RLS audit dry-run: Supabase Security Advisor first pass | Supabase Realtime subscriptions audit — all portals using correct filters |
| **Deliverable:** Admin sees real-time low-stock + new order alerts. Settings all configurable. | **Deliverable:** All Realtime features live. No polling anywhere. |

---

### Sprint 10 — Weeks 19–20: SEO + Performance + Security Hardening
**Goal:** Lighthouse ≥ 85 mobile. Full RLS audit. All SEO implemented.

| Dev A | Dev B |
|---|---|
| Full RLS audit: fix any exposed tables, verify no policy gaps | Full SEO spec implementation: metadata, JSON-LD for all pages, sitemap.xml, robots.txt, llms.txt |
| Penetration testing checklist: OWASP Top 10, SQL injection attempts, CORS boundary tests | Core Web Vitals: all images using `next/image`, fonts via `next/font`, CLS fixes |
| JWT security audit: token expiry, rotation, service role usage review | Lighthouse to ≥ 85 mobile on homepage, category page, PDP (the 3 highest-traffic pages) |
| Paystack live mode: switch env vars, verify webhook URL, test live transaction | Cross-browser testing (Chrome, Safari, Firefox), mobile device testing (Android, iOS) |
| **Deliverable:** Security audit report. Zero exposed tables. All rate limits tested. | **Deliverable:** SEO fully implemented. Lighthouse scores documented and ≥ 85. |

---

### Sprint 11 — Weeks 21–22: QA, Seed Data & Launch
**Goal:** Production-ready. First products live. Client handed over.

| Dev A | Dev B |
|---|---|
| Production environment: Vercel env vars, custom domains (gts.ng, dashboard.gts.ng), SSL | Final bug sweep: all reported issues from Sprint 10 testing |
| Supabase: production project (paid tier for prod), backups enabled, connection pooling | Seed first real products (with client): images uploaded, variants set, prices correct |
| Load testing: simulate 100 concurrent users on product pages + 10 concurrent checkouts | Accessibility audit: WCAG AA for storefront (screen readers, color contrast, keyboard nav) |
| Resend sending domain verification (`hello@gts.ng`), Paystack Go Live checklist | Admin user training: walkthrough of all admin functions with client, incl. how to mark orders shipped with courier tracking |
| **Deliverable:** GTS is live on production. First real transaction processed. Client onboarded. | **Deliverable:** All products live, client can manage store independently. |

---

## 10. Domains & Deployment

| App | Domain | Vercel Project |
|---|---|---|
| Storefront + API | `gts.ng` | `gts-web` |
| Staff dashboard | `dashboard.gts.ng` | `gts-dashboard` |

CORS: Only `gts.ng` and `dashboard.gts.ng` are allowed origins. All other origins receive 403 on CORS preflight.

Paystack webhook URL: `https://gts.ng/api/v1/webhooks/paystack`

---

## 11. Critical Open Questions (Resolve Before Sprint 1)

1. **Physical store location(s)** — Single location or multi-location inventory?
2. **Courier partner(s)** — Which third-party courier(s) will fulfill online orders (GIG, Kwik, DHL, other)? Do they provide a tracking URL format GTS can link to, or is tracking number entry manual/free-text only?
3. **Size system** — S/M/L/XL/XXL only? Numeric (38/40/42)? Per-category variation?
4. **Returns policy** — Window, condition, refund vs exchange method?
5. **Paystack merchant account** — Verified in Live mode? Business registration details?
6. **Business email** — `hello@gts.ng` ready for Resend domain verification?
7. **Initial product count** — How many products/variants for launch?
8. **Low stock threshold** — Default value (5 units?)?
9. **Free shipping threshold** — If offered, what value in ₦?
10. **WhatsApp Business** — Does GTS have a WhatsApp number for customer support link in storefront?
