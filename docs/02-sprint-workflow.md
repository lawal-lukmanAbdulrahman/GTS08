# Sprint Workflow

## Flow

1. **Kickoff** — Review sprint scope, read relevant spec sections.
2. **Implement** — TDD loop (failing test → implement → green → refactor).
3. **Gate** — Run full test suite: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:rls`
4. **Sign-off** — Reviewer (Olareign) approves. Recorded in `docs/sprints/sprint-NN.md`.

## Rules

- Nothing merges without reviewer's explicit sign-off.
- Each sprint has a log file in `docs/sprints/`.
- E2E tests (`pnpm test:e2e`) run before sprint sign-off at minimum.
