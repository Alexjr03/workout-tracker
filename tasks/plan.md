# Implementation Plan: Workout Tracker PWA

Source of truth: [SPEC.md](../SPEC.md) (approved 2026-11-03). Task details, acceptance criteria and verification live in [todo.md](todo.md).

## Overview

An offline-first React + TypeScript PWA for one iPhone user. Data lives in IndexedDB (Dexie), and the fixed routine ships as editable seed data. The work is ordered so the riskiest parts come first:
- installing on iOS and working offline,
- making sure sets survive the app closing,
- getting the progression rules right.

After that, each module is built as a vertical slice (data + logic + UI + tests) in the capability-map order.

## Architecture Decisions

- **Pure domain layer** (`src/domain/`). Ramp-up, progression, default weights, schedule and averages are plain functions built test-first. UI and Dexie never contain these rules, so every rule from the spec can be unit-tested without a browser.
- **Logs snapshot their prescription.** `SessionExerciseLog` stores the sets, rep range and RIR target that were shown, so editing the routine never changes past history or past progression checks.
- **Write first, then update the UI.** Each completed set is written in one Dexie transaction before the screen moves on. Active-session state (current exercise, set index, timer `endsAt`) is stored too, so a force-quit can resume exactly where it left off.
- **The timer is based on timestamps, not ticks.** iOS pauses JS when the app is in the background. Working out the remaining time from `endsAt − now` keeps it correct after the phone is locked.
- **No chart library.** One small SVG `LineChart` covers all three charts and keeps the bundle under the 250 KB budget.
- **Deploy early.** GitHub Pages goes up during the foundation phase, so installing on a real iPhone is tested before any feature work starts.
- **Swaps are new exercise ids.** A swap creates or reuses a catalog entry and sets `replacesExerciseId` on that session's slot. History stays separate without any special-case queries.

## Dependency Graph

```
T1 scaffold ─ T2 PWA shell ─ T3 deploy (iPhone install check)
     │
     └─ T4 dates+schema+seed ─┬─ T5 schedule/ramp-up ─┐
                              ├─ T6 defaults/progression ┤
                              │                         ▼
                              │            T7 Today ─ T8 set logging ─ T9 resume/undo/finish
                              │                              │
                              │                    T10 rest timer, T11 swap, T12 cardio
                              │
                              ├─ T13 export ─ T14 import + reminder
                              ├─ T15 settings ─ T16 routine: schedule+catalog ─ T17 routine: templates
                              ├─ T18 LineChart ─ T19 history list/detail ─ T20 exercise chart
                              ├─ T21 body weight (needs T18)
                              └─ T22 nutrition (needs T15 for protein target)
                                                     T23 audit ─ T24 release
```

## Task List (index — details in todo.md)

### Phase 1: Foundation
- [x] T1: Scaffold project and tooling
- [x] T2: PWA shell, offline caching, navigation, theme
- [x] T3: Deploy to GitHub Pages and install on iPhone
- [x] T4: Date helpers, Dexie schema, seed-once loading

**Checkpoint A:** `npm run check` green · installs on iPhone · cold start works in airplane mode · seed visible in IndexedDB

### Phase 2: Domain rules (TDD)
- [x] T5: `sessionForDate` + `prescriptionFor` (ramp-up)
- [x] T6: `defaultWeight`, `defaultReps`, `progressionSuggestion`

**Checkpoint B:** `src/domain/` at 100% branch coverage

### Phase 3: Workout logging
- [x] T7: Today screen and starting a session
- [x] T8: Session runner and durable set logging
- [x] T9: Resume after close, undo/edit, finish summary
- [x] T10: Rest timer
- [x] T11: Exercise swap
- [x] T12: Cardio session

**Checkpoint C:** E2E full Upper A session + reload mid-session · **real gym session on iPhone** · human review

### Phase 4: Backup
- [x] T13: JSON export via Share Sheet
- [x] T14: Validated import and backup reminder

**Checkpoint D:** export → wipe → import round trip identical (E2E)

### Phase 5: Settings and routine editing
- [x] T15: Settings screen
- [x] T16: Routine editor: schedule and exercise catalog
- [x] T17: Routine editor: session templates

### Phase 6: History
- [x] T18: SVG LineChart component
- [x] T19: History list and session detail
- [x] T20: Exercise progress chart

### Phase 7: Body weight and nutrition
- [x] T21: Body weight log, chart, 7-day average
- [x] T22: Nutrition log and protein target

**Checkpoint E:** all modules done · `npm run check` + `npm run test:e2e` green · human review

### Phase 8: Release
- [x] T23: Accessibility, performance and bundle audit
- [ ] T24: Production deploy and iPhone acceptance run (Success Criteria 1–14)

**Checkpoint F:** every SPEC success criterion checked off

### Phase 9: Owner feedback (added 2026-11-06)
- [x] T25: "Workout complete" on Today
- [x] T26: Last-time weights on every set
- [x] T27: Push back a day
- [x] T28: Swap suggestions by muscle group
- [x] T29: kg or lb per exercise
- [x] T30: How-to videos (embedded YouTube)
- [ ] T31: Louder rest alarm

**Checkpoint G:** owner tried each at the gym

### Phase 10: More owner requests
- [ ] T32: Saved foods with custom calories

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| iOS evicts or loses IndexedDB data | High | Request `storage.persist()`; installed Home Screen apps are exempt from the 7-day cap; backup reminder after 7 days; Share Sheet export tested early (T13 right after logging) |
| iOS PWA quirks (install, SW updates, wake lock) | High | Deploy and install in T3 before features; update prompt never reloads mid-session; wake lock fails silently |
| Data lost when the app is killed mid-set | High | Write the set before the UI advances; persist active-session state; E2E reload test in T9 |
| Progression edge cases (assistance, mixed weights, ramp-up set counts) | Med | Pure functions, TDD, 100% branch coverage in T6 |
| Timer drift / missed alert when backgrounded | Med | `endsAt` timestamp; show "Rest done" on return; documented limitation (no background alerts) |
| Routine edits corrupting history | Med | Prescription snapshot on every session slot; editor affects future sessions only |
| Bundle bloat | Low | No chart lib; budget check in T23 |

## Parallelization

Each slice after Checkpoint B only depends on `data-store` + `domain`:
- Backup (T13–14), Settings (T15–17), History (T18–20) and Body/Food (T21–22) could each run in their own session.
- They all touch the shared `src/app/routes.tsx` and `src/db/schema.ts`, so schema additions should land first if work is parallelized.

Phase 3 must stay sequential.

## Open Questions

None blocking. T3 and T24 need your OK to create the GitHub repo and push.
