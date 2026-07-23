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
