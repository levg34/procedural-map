# Agent / contributor guide

This repo is a small TypeScript + Three.js app (client Vite build + Express server).

## Before opening a PR or pushing CI-affecting changes

Run the same checks as CI (in order). The commands below are the canonical ones from `package.json`:

```bash
npm run typecheck
npm run format:check
npm run vite-build
npm run vitest
```

Or run the bundled checks:

```bash
npm test          # typecheck + vitest
npm run build     # typecheck + vite-build
```

CI parity (current): **typecheck**, **format:check**, **vite-build** (aka `vite build`), **vitest** (`vitest run`).

## Notes

- Use `npm run format:check`; if it fails, run Prettier on the listed files (see `format:check` in `package.json`) or configure your editor.
- `npm run vite-build` may emit a chunk-size warning (Three.js bundle); that is expected and not a failure.
- Prefer running these checks after editing (especially before finalizing changes) to avoid CI breakage.

## Document behavior (stay tidy, avoid regressions)

Prefer **unit tests** whenever behavior is observable in code under test (`test/*.test.ts`, Vitest). Add or update tests when you change:

- Road generation/validation rules, routing, paths, and invariants (see `test/road.test.ts`, related helpers).
- Data/logic modules with deterministic behavior (e.g. vehicle/traffic rules, utilities).

When a change is **hard to test directly** (purely visual/Three.js scene setup, asset loading glue, browser-only timing), at minimum leave **clear comments at the right place** explaining intent, constraints, and non-obvious invariants. For larger “not yet testable” ideas, prefer a short note in `docs/future-work.md` rather than leaving implied behavior undocumented.

Guidelines (inferred from repo history such as `refactor`, `cleaning up`, `add …`, `fix …` commits): keep changes small and consistent with nearby style; extract helpers/types when it clarifies behavior; avoid mixing unrelated refactors with behavior changes unless necessary; and when you touch generation or client/server contracts, update or add tests that lock the contract down.

## Common scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Typecheck watch + dev server + Vite dev server |
| `npm start` | Build then start server (`tsx src/server/index.ts`) |
| `npm run vitest` | Unit tests only |
