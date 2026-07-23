# GTS Platform — Product Requirements Document (Summary)

**Version:** 1.0 · **Date:** July 2026 · **Owner:** Olareign
**Role of this document:** Executive summary for stakeholders and fast orientation for new contributors/agents. The seven specs in `docs/specs/` remain the authoritative source of truth — if this summary and a spec disagree, the spec wins.

---

## 1. Product Vision

GTS is a Nigerian men's wear brand. We are building its **unified retail operating system** — not a standard e-commerce store. It merges two mental models into one platform:

- **The online storefront** (think Jumia): customers browse, discover, and buy from any device.
- **The in-store POS** (think Justrite): cashiers serve walk-in customers through the same inventory and order system, via a different interface.

On top sit an **employee portal** (inventory and order operations) and a **full admin dashboard** (the owner's command centre). Order fulfillment/delivery is handled outside the platform (per Scope Amendment 001): admin tracks fulfillment status and optional courier tracking info; no in-house driver system is built.

**One backend. One inventory. Four user types. Two sales channels.** Every sale — online or in-store — touches the same products, the same stock, the same order pipeline.

## 2. Problem & Business Rationale

Retail brands running both a physical store and an online shop typically end up with two disconnected systems: stock oversells online because the shop floor sold the last unit, walk-in revenue is invisible to the analytics that drive buying decisions, and the owner reconciles channels manually. GTS eliminates that class of problem structurally: a single inventory table is the source of truth for both channels, and every naira of revenue lands in one analytics view.

## 3. Users & Portals

| User | Portal | Core experience |
|---|---|---|
| **Customer** (public) | `gts.ng` | Browse → cart → guest checkout (no account required) → Paystack → email confirmation → track by order number + email. Optional account post-checkout. |
| **Cashier** | `dashboard.gts.ng/pos` | Search by name/SKU → build cart → apply discounts → confirm cash/terminal payment → receipt. Same-day void allowed. |
| **General employee** | `dashboard.gts.ng` | Permission-gated modules (inventory, orders, products, tickets). No permissions yet → live-updating "Pending Access" screen. |
| **Admin** | `dashboard.gts.ng/admin` | Full analytics, order/delivery/product/staff management, promos, content slots, email campaigns, support inbox, settings. |

## 4. Core Capabilities (v1 scope)

1. **Product catalog** — categories, variants (size/color), Cloudinary imagery, full-text search, SEO-optimized ISR pages.
2. **Online purchase flow** — cart with 30-day persistence, stock reservation during checkout (20-min hold), promo codes, Paystack inline payment, webhook-only fulfillment, transactional emails (Resend).
3. **POS channel** — tablet-optimized two-panel sale screen, variant selection, promo + audited manual discounts, cash/terminal payment, printable receipts, same-day void with stock restoration.
4. **Inventory operations** — single stock source of truth, reserved-quantity accounting, adjustments with immutable audit trail (`stock_movements`), low-stock alerts, bulk restock.
5. **Order fulfillment tracking** — simplified admin-driven flow (`processing → out_for_delivery → delivered`) with optional courier tracking number/carrier/link, surfaced on the public tracking page and in customer emails. (Replaces the original in-house delivery system — Scope Amendment 001.)
6. **Customer experience** — accounts, order history, saved addresses, wishlist, verified-purchase reviews (admin-moderated), size guides, public order tracking.
7. **Admin command centre** — KPI dashboard with channel split, revenue charts, full order management with state-machine enforcement, staff invitations with granular permission flags, content slots (homepage managed without a developer), promo engine, email campaigns, support ticketing.
8. **Trust & conversion mechanics** — real scarcity signals only (no fake urgency), social proof, guest-first checkout, free-shipping progress bar, post-purchase account conversion. (Storefront spec Part 1 is binding.)

**Explicitly deferred:** barcode scanning, SEO content pages (Phase 2/3 — columns migrate now, features build later). **Explicitly removed:** the entire delivery/driver management system, GPS tracking, and Termii SMS (Scope Amendment 001).

## 5. Architecture Summary

- **Two Next.js 15 apps** (Turborepo, TypeScript strict, pnpm): `web` (storefront + ALL API Route Handlers at `/api/v1/*`) and `dashboard` (pure frontend, role-routed). Business logic lives only in Route Handlers.
- **Supabase**: Postgres 15, Auth (anonymous sessions for guests, magic links for staff, custom JWT role claims), Realtime, RLS on every table as the final defense layer.
- **Integrations:** Paystack (payments — webhook is the sole fulfillment trigger), Cloudinary (images, server-proxied), Resend + React Email (transactional + campaigns), Upstash Redis (rate limiting, caching), Vercel (hosting + cron), Sentry (errors).
- **Hard conventions:** money in kobo integers only; UUIDs internally, slugs and `GTS-YYYYMM-NNNNNN` order numbers publicly; TIMESTAMPTZ/UTC stored, WAT displayed; string status enums with DB CHECK constraints and a strict state machine.

## 6. Delivery Model

Test-driven, sprint-gated, AI-assisted. Claude Code implements; Olareign reviews and signs off every sprint. Eleven sprints (revised roadmap in `docs/03-scope-amendments.md` §7): foundation → catalog → checkout/payments → POS → inventory/employee → admin core → admin full → customer experience → realtime/settings → hardening/SEO → QA/launch. TDD is strict (test-first) for API, business logic, and RLS; tests-alongside for UI. Full CI gate (typecheck, lint, unit, RLS via pgTAP, build, E2E via Playwright) on every PR. Details: `docs/01-testing-strategy.md`, `docs/02-sprint-workflow.md`.

## 7. Success Criteria (launch)

- A real customer completes a live Paystack purchase end-to-end and receives all lifecycle emails.
- A cashier processes and voids walk-in sales; both channels' stock never diverges (verified by concurrent-sale tests).
- An order moves through the full fulfillment flow (paid → out_for_delivery → delivered) with tracking info, and the customer's public tracking page + emails reflect every stage.
- Zero tables without RLS; security contracts 1–10 (backend spec Part 9) pass audit.
- Lighthouse ≥ 85 mobile on homepage, category, PDP; LCP < 2.5s on 4G; WCAG AA on storefront.
- Admin (client) manages products, orders, staff, and content independently after training.

## 8. Constraints & Risks

- **Nigerian market realities:** Paystack-native payments (card/transfer/USSD), WAT timezone, ₦ pricing, mobile-heavy traffic, WhatsApp as a support channel.
- **Top risks:** (1) ~~Inventory location model~~ RESOLVED (single-location with future-proofed `location_id`). (2) Paystack live-mode merchant verification lead time — start early. (3) `gts.ng` email domain must verify with Resend before any email ships (Sprint 3). (4) Two-channel stock races — mitigated by `SELECT FOR UPDATE` + reservation protocol + dedicated concurrency tests.

## 9. Open Items

All unresolved decisions, recommended defaults, and known spec corrections live in `docs/00-open-questions.md`. Section A (business questions A1–A10) requires owner input; A1 blocks Sprint 1.