# Testing Strategy

> TDD rules, test stack, and what must be tested per layer.

## Test Stack

- **Unit / Component:** Vitest + React Testing Library
- **API mocking:** MSW (component tests)
- **RLS:** SQL-based pgTAP tests against local Supabase
- **E2E:** Playwright

## TDD Rules

1. Write failing tests FIRST for business logic, Route Handlers, and RLS policies.
2. Implement until green. Refactor.
3. Component/UI tests may be written alongside implementation.
4. Run the full gate before declaring done:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm test:rls
   ```
5. Playwright E2E runs at minimum before sprint sign-off.
6. Never weaken, skip, or delete a failing test to make it pass.

## Per-Layer Requirements

| Layer | What to test |
|---|---|
| Database (RLS) | Every policy: owner access, cross-user denial, role escalation denial |
| Route Handlers | Input validation, auth checks, business logic, error shapes |
| Business logic | Pure functions, state transitions, money math (kobo) |
| Components | Render states, user interactions, loading/error states |
| E2E | Critical user flows end-to-end |

## The gates as they run today

| Gate | Command | Runs |
|---|---|---|
| Typecheck (both apps) | `pnpm typecheck` | every push / PR |
| Lint ratchet | `pnpm lint:ratchet` | every push / PR. Fails only on **new** errors; legacy ones live in `.lint-baseline.json` and can only shrink (`node scripts/lint-ratchet.cjs --update` after fixing some) |
| Unit + route + component tests (web and dashboard) | `pnpm test` | every push / PR |
| Route access policy | `apps/web/__tests__/authz_policies.test.ts` | part of `pnpm test`: every API route must be listed in `route-policies.ts` and its code must enforce the declared policy |
| Secret scan | gitleaks | every push / PR |
| RLS (pgTAP) | `pnpm test:rls` (`supabase test db`) | every push / PR, against a throwaway local Supabase |
| Performance benchmarks | `pnpm test:perf` | nightly / manual, on a quiet runner (absolute timings are machine-sensitive) |
| API end-to-end | `pnpm qa:api` | nightly / manual, against **staging** (`scripts/qa/api-e2e.cjs`) |
| Browser flows | `pnpm test:e2e` | nightly / manual, against staging (Playwright: walk-in sale, WhatsApp order, staff onboarding, revoking access) |
| Lighthouse | `lighthouserc.json` | nightly / manual: performance ≥ 85, accessibility ≥ 90, LCP < 2.5 s, CLS < 0.1, touch targets, page titles, skip link |
| Online purchase check | `node scripts/qa/paystack-sandbox.cjs` | manual, with a Paystack **test** key: order, signed webhook, stock, replay, wrong amount |
| Real printers | `docs/testing/printer-checklist.md` | manual, once per printer model |

Rules that came out of QA:
- Anything that talks to a real database or payment provider runs against staging, never production.
- A new API route must declare its access policy or the unit tests fail.
- Tests that need a signed-in browser create their own throwaway accounts and delete them afterwards.

