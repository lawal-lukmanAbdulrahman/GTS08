# GTS Platform

A unified retail operating system for a Nigerian men's wear brand — powering an online storefront (`gts.ng`), staff dashboard (`dashboard.gts.ng`) with POS and inventory management, and a full admin portal. One backend, one inventory, four user roles.

## Architecture

```
gts/
├── apps/
│   ├── web/             # Storefront + API routes (Next.js 15, port 3000)
│   └── dashboard/       # Staff portal — POS, inventory, admin (Next.js 15, port 3001)
├── packages/
│   ├── config/          # Shared ESLint, Tailwind, Vitest, TSConfig
│   ├── database/        # Supabase client, generated types
│   ├── types/           # Shared TypeScript types
│   ├── ui/              # Shared UI components
│   ├── utils/           # Money formatting, date helpers, shared utilities
│   └── test-utils/      # MSW handlers, test factories
├── e2e/                 # Playwright end-to-end tests
├── supabase/            # Migrations, seed data, RLS policies
└── docs/                # Specs, sprint logs, decision records
```

**Monorepo:** Turborepo + pnpm workspaces
**Backend:** All business logic lives in Next.js Route Handlers (`apps/web/app/api/v1/`). The dashboard is a pure frontend consumer.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript `strict` |
| Database | Supabase (Postgres 15, Auth, Realtime, RLS) |
| Payments | Paystack (webhook-driven fulfillment) |
| Images | Cloudinary (server-side proxy upload) |
| Email | Resend + React Email |
| Rate Limiting | Upstash Redis |
| Styling | Tailwind CSS (storefront: custom, dashboard: shadcn/ui) |
| Testing | Vitest, React Testing Library, Playwright, MSW |
| Monorepo | Turborepo, pnpm |

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 10.17
- **Docker** (for local Supabase)
- **Supabase CLI** ([install guide](https://supabase.com/docs/guides/cli))

## Getting Started

```bash
# 1. Clone and install
git clone <repo-url> && cd gts
pnpm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in the values — see Environment Variables section below

# 3. Start local Supabase
supabase start

# 4. Run migrations and seed
supabase db reset

# 5. Generate database types
supabase gen types typescript --local > packages/database/src/types.gen.ts

# 6. Start development servers
pnpm dev
```

The storefront runs at `http://localhost:3000`, the dashboard at `http://localhost:3001`.

## Environment Variables

Copy `.env.example` to `.env.local` and populate:

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key (never expose to client) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Server | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Server | Cloudinary API secret |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Public | Paystack public key |
| `PAYSTACK_SECRET_KEY` | Server | Paystack secret key |
| `RESEND_API_KEY` | Server | Resend email API key |
| `UPSTASH_REDIS_REST_URL` | Server | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Upstash Redis token |

## Scripts

```bash
pnpm dev                 # Start both apps in development mode
pnpm build               # Production build (all packages)
pnpm typecheck           # TypeScript type checking (no emit)
pnpm lint                # ESLint across all packages
pnpm test                # Vitest — unit and component tests
pnpm test:watch          # Vitest in watch mode
pnpm test:rls            # RLS policy tests against local Supabase
pnpm test:e2e            # Playwright end-to-end tests
```

**Supabase CLI:**

```bash
supabase start           # Start local Supabase stack
supabase db reset        # Re-run all migrations + seed
supabase db diff -f name # Generate a migration from local changes
```

## API Structure

All API routes live under `apps/web/app/api/v1/`:

| Endpoint | Description |
|---|---|
| `/auth/*` | Registration, login, logout, session |
| `/products/*` | Product catalog (CRUD) |
| `/categories/*` | Category management |
| `/cart` | Cart operations |
| `/checkout` | Checkout flow |
| `/orders/*` | Order management + tracking |
| `/pos/*` | Point-of-sale transactions |
| `/inventory/*` | Stock management + adjustments |
| `/webhooks/paystack` | Payment fulfillment (HMAC-verified) |
| `/upload` | Cloudinary image proxy |
| `/promos/*` | Promotional codes |
| `/users/*` | User management (admin) |
| `/analytics` | Dashboard analytics |
| `/cron/*` | Scheduled jobs (reservation cleanup, order expiry) |

## User Roles

| Role | Access |
|---|---|
| `customer` | Storefront: browse, purchase, track orders, reviews |
| `cashier` | Dashboard: POS terminal, in-store sales |
| `inventory_staff` | Dashboard: stock management, adjustments |
| `admin` | Dashboard: full access — orders, analytics, users, content, settings |

## Order Lifecycle

```
pending_payment → paid → processing → ready_for_pickup → completed
       ↓           ↓         ↓
    cancelled   cancelled  cancelled
```

No backward transitions. No skipped steps. Payment fulfillment is triggered exclusively by the Paystack webhook.

## Key Conventions

- **Money** is stored in **kobo** (integers only). Naira formatting is display-only.
- **IDs** are UUID v4. Public URLs use slugs. Orders use `GTS-YYYYMM-NNNNNN` format.
- **Timestamps** are stored as `TIMESTAMPTZ` (UTC), displayed in WAT.
- **RLS** is enabled on every public table. No exceptions.
- **`cost_price`** is never exposed in public API responses.

## Deployment (Vercel)

Deploy as **two separate Vercel projects**:

| App | Root Directory | Domain |
|---|---|---|
| Storefront | `apps/web` | `gts.ng` |
| Dashboard | `apps/dashboard` | `dashboard.gts.ng` |

Framework preset: **Next.js** (auto-detected). Set all environment variables from `.env.example` in each project's settings.

## Documentation

Detailed specs and decision records live in `docs/`:

| Document | Purpose |
|---|---|
| `CLAUDE.md` | Agent conventions and rules |
| `docs/specs/gts_02_backend.md` | Schema, RLS, API, business logic |
| `docs/specs/gts_03_storefront.md` | Storefront pages and UX |
| `docs/specs/gts_05_cashier.md` | POS portal spec |
| `docs/specs/gts_06_employee.md` | Employee portal spec |
| `docs/specs/gts_07_admin.md` | Admin dashboard spec |
| `docs/03-scope-amendments.md` | Active overrides to specs |
| `docs/01-testing-strategy.md` | TDD rules and test stack |
| `docs/00-open-questions.md` | Decision log and known corrections |

## License

Proprietary. All rights reserved.
