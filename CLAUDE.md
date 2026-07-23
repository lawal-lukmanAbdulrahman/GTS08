# CLAUDE.md — GTS Platform

> This file is loaded by every Claude Code session. It is the single source of truth for
> conventions, commands, and rules. Specs live in `docs/specs/`. If this file and a spec
> conflict, STOP and ask the reviewer (Olareign) — do not guess.

## What this project is

GTS is a unified retail operating system for a Nigerian men's wear brand: online storefront
(`gts.ng`), staff dashboard (`dashboard.gts.ng`) covering POS, inventory, and a full
admin portal. One Supabase backend, one inventory, four user types (customer, cashier,
inventory_staff, admin). The delivery/driver system was REMOVED — see `docs/03-scope-amendments.md`.

**Delivery model:** Test-driven, sprint-by-sprint. Nothing merges without the reviewer's
explicit sign-off. See `docs/02-sprint-workflow.md`.

## Spec index (read the relevant spec before implementing any feature)

| File | Contents |
|---|---|
| `docs/specs/gts_01_overview.md` | Vision, architecture, sprint plan, conventions |
| `docs/specs/gts_02_backend.md` | Schema, RLS, API routes, business logic, cron, security contracts — AUTHORITATIVE for all backend work |
| `docs/specs/gts_03_storefront.md` | All storefront pages, UX rules, performance budgets |
| `docs/specs/gts_04_delivery.md` | DEPRECATED — delivery removed. Do not implement. See `docs/03-scope-amendments.md` |
| `docs/specs/gts_05_cashier.md` | POS portal |
| `docs/specs/gts_06_employee.md` | Employee portal + shared nav |
| `docs/specs/gts_07_admin.md` | Admin dashboard |
| `docs/00-open-questions.md` | Decision log + known spec corrections. CHECK THIS before touching affected areas. |
| `docs/03-scope-amendments.md` | ACTIVE scope amendments that OVERRIDE the specs (delivery removal, revised state machine, schema deltas, 11-sprint plan). Read alongside any spec. |
| `docs/01-testing-strategy.md` | TDD rules, test stack, what must be tested per layer |

**Agent rule from the backend spec (binding):** Do not invent anything not in the spec.
`[Phase 2]`/`[Phase 3]` columns go in migrations now; their API routes and UI do NOT get built
until the spec/sprint says so.

## Stack (locked)

- **Apps:** Next.js 15, App Router, TypeScript `strict: true`. Turborepo monorepo per overview §5.
- **Data:** Supabase (Postgres 15, Auth, Realtime, RLS on every table), migrations in `supabase/migrations/` (numbered).
- **Payments:** Paystack (webhook is the ONLY fulfillment trigger).
- **Images:** Cloudinary via `/api/v1/upload` proxy only. `public_id` in DB, URL built at display time.
- **Email:** Resend + React Email (`apps/web/emails/`). **Rate limiting:** Upstash Redis, edge middleware.
- **Styling:** Tailwind. Storefront components are custom; dashboard may use shadcn/ui. (Confirm in open-questions if unset.)
- **Testing:** Vitest + React Testing Library (unit/component), Playwright (E2E), SQL-based RLS tests, MSW for API mocking in component tests. See `docs/01-testing-strategy.md`.

## Non-negotiable data conventions

- **Money:** integers, **kobo only**, everywhere in DB and backend. `₦` formatting is display-only via `packages/utils/money.ts` → `PriceDisplay`. Any float or Naira arithmetic in backend code is a bug.
- **IDs:** UUID v4. Slugs in public URLs (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). `order_number` (`GTS-YYYYMM-NNNNNN`) for tracking — never UUIDs in tracking URLs.
- **Timestamps:** TIMESTAMPTZ (UTC) in DB; display in WAT via `packages/utils/date.ts`.
- **Statuses:** string enums with DB `CHECK` constraints. Never integers. Transitions only per the state machine in `docs/03-scope-amendments.md` §3 (which supersedes backend spec §6.3) — no backward moves, no skipped steps.
- **Env vars:** `NEXT_PUBLIC_` only for genuinely public values. Secrets are server-only. Full list in backend spec Part 10.

## Security contracts (from backend spec Part 9 — every PR must pass)

1. RLS enabled on every `public` table (event trigger enforces; test verifies).
2. `SUPABASE_SERVICE_ROLE_KEY` never in client bundles or client components.
3. Paystack webhook: HMAC-SHA512 verification is the FIRST operation in the handler.
4. Webhook idempotency via `webhook_events` before any fulfillment action.
5. Parameterized queries only. No SQL string templates from user input.
6. Admin routes double-gated: middleware JWT claim + Route Handler `supabase.auth.getUser()` re-verification.
7. `cost_price` never appears in any public API response (explicit column selection in public routes).
8. Public order tracking requires order_number AND email.
9. No client → Cloudinary direct uploads.
10. `is_blocked` check cached in Upstash (60s TTL).

## Architecture rules

- **All business logic lives in Route Handlers** (`apps/web/app/api/v1/`). The dashboard app is a pure frontend. No business logic in components, no Supabase writes from the browser except where the spec explicitly says so (Realtime subscriptions are read-only listeners).
- API responses use the standard shapes from backend spec Part 1 (error: `{ error, code, details }`; list: `{ data, meta }`; single: `{ data }`).
- Paystack success callback on the client is cosmetic only. It NEVER marks anything paid.
- Stock math is atomic (`SELECT FOR UPDATE` for POS; reservation protocol per backend spec §3.11 for online).

## TDD loop (mandatory for every feature)

1. Read the spec section for the feature. Check `docs/00-open-questions.md` for blockers.
2. Write failing tests FIRST for: business logic, Route Handlers, and RLS policies.
3. Implement until green. Refactor. Component/UI tests may be written alongside implementation (not after the sprint).
4. Run the full gate before declaring done:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm test:rls
   ```
   Playwright E2E (`pnpm test:e2e`) runs at minimum before sprint sign-off.
5. Never weaken, skip, or delete a failing test to make it pass. If a test seems wrong, flag it to the reviewer.

## Commands (canonical — keep updated as scripts land)

```bash
pnpm dev                 # turbo run dev (both apps)
pnpm build               # turbo run build
pnpm typecheck           # tsc --noEmit across workspace
pnpm lint                # eslint across workspace
pnpm test                # vitest run (unit + component)
pnpm test:watch          # vitest watch
pnpm test:rls            # RLS policy tests against local Supabase
pnpm test:e2e            # playwright test
supabase start           # local Supabase stack (Docker)
supabase db reset        # re-run all migrations + seed locally
supabase db diff -f name # generate a new migration from local changes
supabase gen types typescript --local > packages/database/src/types.gen.ts
```

## Definition of done (per feature)

- [ ] Spec section implemented exactly (including psychology/UX notes in storefront spec)
- [ ] Tests written per `docs/01-testing-strategy.md`, all green
- [ ] Typecheck + lint clean
- [ ] Security contracts checklist reviewed for touched areas
- [ ] No `[Phase 2]`/`[Phase 3]` scope built early
- [ ] Reviewer sign-off recorded in the sprint log (`docs/sprints/sprint-NN.md`)

## Never do

- Never do arithmetic in Naira. Never store floats for money.
- Never mark an order paid from anywhere except the Paystack webhook handler.
- Never return `cost_price` or Paystack secrets in a public route.
- Never build UI for a route/permission without the corresponding server-side gate.
- Never add a table without RLS policies AND an RLS test.
- Never invent schema, routes, or statuses not in `docs/specs/gts_02_backend.md` (as amended by `docs/03-scope-amendments.md`).
- Never build any delivery/driver feature (roles, tables, routes, portal, UI) — removed by Scope Amendment 001.
- Never commit `.env*` files or secrets.
- Never mark a sprint complete without the reviewer's explicit approval.