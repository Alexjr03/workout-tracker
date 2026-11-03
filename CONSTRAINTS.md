# Constraints

Last reviewed: 2026-11-03 · Applies to: Workout Tracker PWA ([SPEC.md](SPEC.md))

Every failing check **blocks**: a task is not done until all checks for its stage pass. The project starts with no code, so there are no inherited failures to wait out.

## Floor (always enforced)

Checked by `node scripts/floor-guard.mjs` against the diff since `main` (or everything, before the first commit).

- No new suppression comments: `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `eslint-disable`, `istanbul`/`v8`/`c8 ignore`, `gitleaks:allow`. Each one switches off a check this file relies on.
- No unfinished work: `throw new Error('Not implemented')`, empty `catch {}`, `TODO`/`FIXME` in code. A silent catch could hide a failed IndexedDB write, which is exactly the data loss the spec forbids.
- No skipped, focused or deleted tests (`.skip`, `.only`, `.todo`, `xit`, `.fixme`), and no test file ending a change with fewer `expect`/`assert` lines than it started with. Rewriting an assertion is fine; stripping one is not.
- No network calls in `src/` (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`). SPEC › Boundaries: offline-only, no backend, no telemetry.
- No secrets in source. Checked by gitleaks.
- This file is never weakened to make a change pass. Lowering a number, deleting a floor rule, or adding an exception is flagged by the guard and needs the owner's OK in chat first.

## Enforced with numbers

| Dimension | Rule | Why this number | Checked by | Runs at |
|---|---|---|---|---|
| Types | Zero errors, `strict: true` | Types are the cheapest check there is; strict catches undefined reads around optional IndexedDB rows | `tsc --noEmit` | fast |
| Lint | Zero errors **and** zero warnings | Warnings nobody acts on become noise; `no-explicit-any` and `react-hooks` rules are errors | `eslint . --max-warnings 0` | fast |
| Secrets | Zero findings, output redacted | External ruleset; the repo will be public on GitHub Pages | `gitleaks dir . --redact --no-banner` | fast |
| Floor | Zero findings | See Floor | `node scripts/floor-guard.mjs` | fast |
| Tests | All pass | Suite is the spec's executable form | `vitest run --coverage` | task |
| Coverage: domain | 100% branches in `src/domain/**` | Ramp-up and progression are the app's core logic; every branch is a rule from the spec (SPEC › Testing Strategy) | Vitest `coverage.thresholds['src/domain/**'].branches = 100` | task |
| Coverage: project | ≥ 80% lines | SPEC › Testing Strategy target; forces a test for each slice while allowing glue code | Vitest `coverage.thresholds.lines = 80` | task |
| Coverage: changed lines | ≥ 80% of changed executable lines in `src/` | Scoped to the diff so each task carries its own tests; reads the lcov from the run above, no second run | `node scripts/changed-coverage.mjs --min 80` | task |
| Build | Production build succeeds | Catches PWA plugin and import errors that tests running under jsdom don't | `vite build` | task |
| E2E | All Playwright specs pass (WebKit, iPhone 13) | Durability, offline and layout criteria can only be proven in a browser | `playwright test` | full |

### Stages

| Stage | Script | When | Budget |
|---|---|---|---|
| fast | `npm run check:fast` | After each edit | ≤ 10 s |
| task | `npm run check:task` (= `npm run check`) | Before calling any task done | ≤ 90 s |
| full | `npm run check:full` | At every Checkpoint in [tasks/todo.md](tasks/todo.md), and before deploy | minutes |

Script definitions, added to `package.json` in T1. This file is canonical; if the scripts drift, the file wins.

```json
{
  "check:fast": "tsc --noEmit && eslint . --max-warnings 0 && gitleaks dir . --redact --no-banner && node scripts/floor-guard.mjs",
  "check:task": "npm run check:fast && vitest run --coverage && node scripts/changed-coverage.mjs --min 80 && vite build",
  "check:full": "npm run check:task && playwright test",
  "check": "npm run check:task"
}
```

Vitest must write `lcov` (`coverage.reporter: ['text', 'lcov']`, provider `v8`), include `src/**`, and exclude only tests, `*.d.ts`, `src/main.tsx` (bootstrap) and `src/test/**` (test setup). Changed-line coverage measures exactly the files in that report, so adding an exclusion counts as weakening this file.

If `check:task` goes over 90 s, move the slowest step to `full` here (in a reviewed change), rather than skipping it.

## Not constraints (spec acceptance only)

You chose not to enforce performance, accessibility, or security scanning continuously. Their spec targets are still checked once, at **T23**:

- Lighthouse Performance ≥ 90 and Accessibility ≥ 95 (SPEC Success Criterion 13).
- JS ≤ 250 KB gzipped.

None of these block a task. Promote any of them to the table above, with a tool, if they start slipping.

## Measured, not yet enforced

| Metric | Today | Direction |
|---|---|---|
| Production JS (gzipped) | 138.7 KB at T4 (React, router, Dexie, zod, workbox); 66.3 KB at T1 | must stay ≤ 250 KB (checked at T23) |

## Exceptions

None.

| ID | Rule | Path | Reason | Owner | Expires |
|---|---|---|---|---|---|
