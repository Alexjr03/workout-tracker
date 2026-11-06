# Tasks: Workout Tracker PWA

Spec: [SPEC.md](../SPEC.md) · Plan: [plan.md](plan.md)

**Definition of done for every task:**
- `npm run check` passes (= `check:task` in [CONSTRAINTS.md](../CONSTRAINTS.md)). Checkpoints also need `npm run check:full`.
- New logic has tests.
- No hard-coded routine values in UI.
- The SPEC boundaries are respected.

---

## Phase 1: Foundation

### - [x] T1: Scaffold project and tooling
**Module:** `app-shell`
**Description:** Set up a Vite + React + strict TypeScript project in this folder, with ESLint, Prettier, Vitest (+ RTL, jsdom, `fake-indexeddb`) and Playwright (WebKit, `iPhone 13` device). Add every npm script from SPEC › Commands, plus `check:fast`/`check:task`/`check:full` exactly as in CONSTRAINTS.md. Configure Vitest coverage per CONSTRAINTS.md (v8, lcov, thresholds: 80% lines, 100% branches in `src/domain/**`). Run `git init -b main` with a `.gitignore` (node_modules, dist, coverage, playwright-report, test-results).

**Acceptance criteria:**
- [ ] All SPEC commands exist, and `npm run check:full` passes on a placeholder `<App/>` with one smoke test.
- [ ] Production JS gzipped size is recorded in CONSTRAINTS.md › Measured.
- [ ] `npm run test:e2e` runs one WebKit test against `npm run preview` and passes.
- [ ] `tsconfig` has `strict: true`, and ESLint fails on `any` and on warnings.

**Verification:** `npm run check` · `npm run test:e2e`
**Dependencies:** None
**Files:** `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `playwright.config.ts`, `src/main.tsx`, `src/app/App.tsx`, `src/app/App.test.tsx`, `e2e/smoke.spec.ts`
**Scope:** M

### - [x] T2: PWA shell, offline caching, navigation, theme
**Module:** `app-shell`
**Description:** Configure `vite-plugin-pwa`:
- Manifest: standalone, name "Workout", icons including the 180px apple-touch-icon.
- Precache all build assets.
- `registerType: 'prompt'`.

Add `react-router` with 5 placeholder routes and a bottom tab bar. Add the high-contrast dark theme (CSS custom properties), safe-area insets, and an "Update ready" prompt.

**Acceptance criteria:**
- [ ] E2E: load once, `context.setOffline(true)`, reload → app and all 5 tabs render.
- [ ] Tabs are ≥ 56 px tall. Primary text contrast is ≥ 7:1 (token values documented in CSS).
- [ ] Update prompt component exists and has a prop/guard to suppress it during an active session (wired in T9).

**Verification:** `npm run check` · `npm run test:e2e` (offline spec) · Lighthouse "installable" in Chrome devtools against `npm run preview`
**Dependencies:** T1
**Files:** `vite.config.ts`, `public/icons/*`, `index.html`, `src/app/{App,routes,BottomNav,UpdatePrompt}.tsx`, `src/app/theme.css`, `e2e/offline.spec.ts`
**Scope:** M

### - [x] T3: Deploy to GitHub Pages and install on iPhone
**Module:** `app-shell`
**Description:** Add a GitHub Actions workflow that builds and publishes `dist/` to Pages, and set the Vite `base` for the repo path. **Ask the user before creating the repo or pushing.**

Deployed 2026-11-03 (live, verified loading + SW + seed). Owner confirmed iPhone install and offline launch on 2026-11-03. Decided: **public** repo `workout-tracker` on GitHub account **Alexjr03** (the active `gh` account). URL: `https://alexjr03.github.io/workout-tracker/`, Vite `base: '/workout-tracker/'`.

**Acceptance criteria:**
- [x] App is served over HTTPS at the Pages URL.
- [x] On the user's iPhone: Share → Add to Home Screen. It opens standalone (no Safari chrome) with the right icon.
- [x] It launches from the Home Screen in airplane mode.

**Verification:** Manual on iPhone (user confirms)
**Dependencies:** T2
**Files:** `.github/workflows/deploy.yml`, `vite.config.ts`
**Scope:** S

### - [x] T4: Date helpers, Dexie schema, seed-once loading
**Module:** `data-store`
**Description:**
- Add `src/domain/dates.ts`: local `YYYY-MM-DD`, `addDays`, weekday name, days between.
- Define the Dexie schema for every table in SPEC › Data Model, plus an `activeSession` key-value row.
- Add `seed/routine.json` (SPEC Appendix A verbatim) and `seed/exerciseDefaults.json` (Appendix B).
- Add zod schemas for both seed files.
- `ensureSeeded()` runs once on boot: writes Settings (with `programStartDate = today`, `proteinTargetG = null`, `lastExportAt = null`), Routine and ExerciseDefs, then calls `navigator.storage.persist()`.

**Acceptance criteria:**
- [ ] Integration test: the first `ensureSeeded()` writes the seed; a second call changes nothing.
- [ ] Test: both seed JSON files pass zod. `routine.json` is byte-identical to Appendix A (snapshot), and every exercise id in the routine has an exerciseDefaults entry.
- [ ] Date helpers handle DST changes and local midnight correctly (tests with a fixed TZ).

**Verification:** `npm test` · `npm run check`
**Dependencies:** T1
**Files:** `src/domain/dates.ts`(+test), `src/db/schema.ts`, `src/db/seed.ts`(+test), `src/seed/routine.json`, `src/seed/exerciseDefaults.json`, `src/seed/schemas.ts`
**Scope:** M

### Checkpoint A: Foundation
- [x] `npm run check` and `npm run test:e2e` pass
- [x] Installed on iPhone and opens offline
- [x] Seed data visible in IndexedDB (E2E `seed.spec.ts` + live site check)

---

## Phase 2: Domain rules (TDD — write the tests first)

### - [x] T5: `sessionForDate` and `prescriptionFor`
**Module:** `routine`
**Description:** Pure functions as specified in SPEC › `routine` (ramp-up based on `programStartDate` and `rampUpWeeks`).

**Acceptance criteria:**
- [ ] Every weekday maps to the seed schedule. Saturday and Sunday return `'rest'`.
- [ ] Day 13 after start → `sets − 1`, `'~3'`, `rampUp: true`. Day 14 → full sets, `'1-2'`. A 1-set exercise stays at 1 during ramp-up.
- [ ] `rampUpWeeks: 0` → never in ramp-up. A date before the start → ramp-up.

**Verification:** `npm test -- src/domain --coverage` (100% branches for these files)
**Dependencies:** T4
**Files:** `src/domain/schedule.ts`(+test), `src/domain/rampUp.ts`(+test)
**Scope:** S

### - [x] T6: `defaultWeight`, `defaultReps`, `progressionSuggestion`
**Module:** `routine`
**Description:** Pure functions that take plain arrays of past logs (no Dexie). They implement the priority chains and progression rule from SPEC › `routine`.

**Acceptance criteria:**
- [ ] Progression:
  - Bench with 10/10/10 at 10 lb/side and repMax 10 → suggests 12.5.
  - One set at 9 → `null`.
  - A missing set → `null`.
  - Mixed weights → based on the lowest weight.
  - Assistance → `base − increment`, never below 0.
  - Ramp-up session with 2 prescribed sets, both at max → suggests.
- [ ] Default weight priority: previous set in this session > suggestion > last logged > `startingLoads` > `null`. Swapped (substitute) logs only count for the substitute id.
- [ ] Default reps: the same set index last time, else `repMax`.

**Verification:** `npm test -- src/domain --coverage` (100% branches)
**Dependencies:** T4
**Files:** `src/domain/defaults.ts`(+test), `src/domain/progression.ts`(+test)
**Scope:** S

### Checkpoint B: Domain
- [x] `src/domain/**` at 100% branch coverage
- [ ] Rules reviewed against SPEC (human skim of the test names)

---

## Phase 3: Workout logging

### - [x] T7: Today screen and starting a session
**Module:** `workout-logging`
**Description:**
- The Today screen shows today's scheduled session (name, exercise count, target minutes), "Rest day" on rest days, and a ramp-up banner during ramp-up weeks.
- **Start a different session** lists all templates.
- Starting a session creates a `SessionLog` (`active`) and one `SessionExerciseLog` per exercise with a snapshot of the prescription and the suggestion, then routes to the runner.
- If a session is already active, the Today screen shows **Resume** and asks to finish or discard it before starting another.

**Acceptance criteria:**
- [ ] Component test with a mocked date: Monday → Upper A; Saturday → Rest day + start list.
- [ ] Integration: starting Upper A on day 3 stores 6 slots with ramp-adjusted sets and `rirTarget '~3'`.
- [ ] Only one `active` session can exist.

**Verification:** `npm test` · manual in `npm run dev`
**Dependencies:** T5, T6
**Files:** `src/features/today/TodayScreen.tsx`(+test), `src/db/repos/sessions.ts`(+test), `src/app/routes.tsx`
**Scope:** M

### - [x] T8: Session runner and durable set logging
**Module:** `workout-logging`
**Description:**
- **Runner view:** exercise name, "Set N of M", rep target + RIR text, weight `Stepper` (± increment, tap to type, basis label), reps `Stepper`, **Complete set** button, **Up next**, and a collapsible overview with jump-to-exercise.
- **Complete set** awaits the `SetLog` write in one transaction, then advances.

**Acceptance criteria:**
- [ ] On a 375×667 viewport, all the main controls are visible without scrolling, and **Complete set** is in the bottom third (Playwright bounding-box assertion).
- [ ] The first Bench set defaults to 10 lb/side and 10 reps. Later sets default to the previous set's weight.
- [ ] Integration: after the Complete-set handler resolves, the `SetLog` exists in IndexedDB before the next-set state renders.

**Verification:** `npm test` · `npm run test:e2e` (runner layout spec)
**Dependencies:** T7
**Files:** `src/features/session/SessionRunner.tsx`(+test), `src/ui/Stepper.tsx`(+test), `src/db/repos/sets.ts`(+test), `e2e/session.spec.ts`
**Scope:** M

### - [x] T9: Resume after close, undo/edit, finish summary
**Module:** `workout-logging`
**Description:**
- Persist active-session UI state (current slot, set index, entered values) to `activeSession` whenever it changes, and restore it on boot.
- **Undo last set** stays available until the next set is completed. Any set can be edited from the overview.
- **Finish** confirms when sets are missing, sets the session to `finished`, and shows a summary (sets, duration, progressions earned).
- The update prompt is suppressed while a session is active.

**Acceptance criteria:**
- [ ] E2E: complete 2 sets, `page.reload()` → the same exercise opens at set 3 with the same entered values.
- [ ] Undo removes the `SetLog` and returns to that set.
- [ ] A finished session no longer appears as Resume on the Today screen.

**Verification:** `npm run test:e2e` · `npm test`
**Dependencies:** T8
**Files:** `src/features/session/{useActiveSession,FinishSummary,SessionOverview}.tsx`(+tests), `src/db/repos/activeSession.ts`, `src/app/UpdatePrompt.tsx`
**Scope:** M

### - [x] T10: Rest timer
**Module:** `rest-timer`
**Description:** `useRestTimer` stores `endsAt` in `activeSession` and computes the remaining time from the clock. `RestTimerBar` has −15 s / +15 s / Skip buttons. At zero while the app is visible, it plays a tone (Web Audio) and flashes the bar; when the app was hidden, it shows "Rest done" on return. Wake Lock is requested during an active session. The timer starts automatically after Complete set, using `restSeconds[type]`.

**Acceptance criteria:**
- [ ] Fake-timer tests: a compound set → 150 s and an isolation set → 75 s. ±15 s and Skip work; the timer never goes negative.
- [ ] Remaining time is correct after the clock jumps 60 s (simulated background), and the timer is restored after reload.
- [ ] A missing Wake Lock API is handled with no error.

**Verification:** `npm test` · manual on iPhone (lock for 60 s, unlock)
**Dependencies:** T9
**Files:** `src/features/timer/{useRestTimer,RestTimerBar}.tsx`(+tests), `src/features/session/SessionRunner.tsx`
**Scope:** M

### - [x] T11: Exercise swap
**Module:** `workout-logging`
**Description:** A **Swap** action opens a sheet listing catalog exercises of the same type plus a "New exercise" name field. Swapping sets this slot's `exerciseId` to the substitute and `replacesExerciseId` to the original. New names create an `ExerciseDef` with `isCustom: true`, a slug id (with a suffix on collision), `total`, and increment 5.

**Acceptance criteria:**
- [ ] Integration: swap Leg press → "Hack squat" and log sets. The Leg press last weight/suggestion is unchanged, and Hack squat has its own history.
- [ ] Session template is unchanged after the swap.
- [ ] Slug collision → `hack-squat-2`.

**Verification:** `npm test`
**Dependencies:** T8
**Files:** `src/features/session/SwapSheet.tsx`(+test), `src/db/repos/exercises.ts`(+test), `src/ui/Sheet.tsx`
**Scope:** M

### - [x] T12: Cardio session
**Module:** `workout-logging`
**Description:** Starting the Cardio template opens the cardio form:
- Machine buttons from seed options + "Other…".
- Minutes stepper (default 30) with the 30–45 target and the intensity cue.
- Optional notes.

Save writes `CardioLog` and finishes the session.

**Acceptance criteria:**
- [ ] Machine options and cues come from the routine data, not literals.
- [ ] Save without notes works. The session is `finished` with `kind: 'cardio'`.
- [ ] "Other…" accepts a typed machine name.

**Verification:** `npm test`
**Dependencies:** T7
**Files:** `src/features/session/CardioForm.tsx`(+test), `src/db/repos/cardio.ts`
**Scope:** S

### Checkpoint C: Logging
- [x] E2E: complete a full Upper A session, including the auto rest timer and finish (`e2e/workout.spec.ts`)
- [ ] Redeploy; the user does **one real gym session** on iPhone and reports friction
- [ ] Human review before continuing

---

## Phase 4: Backup

### - [x] T13: JSON export via Share Sheet
**Module:** `backup`
**Description:** `exportAll()` builds the SPEC export envelope from every table. Export uses `navigator.share({ files })` when `canShare` allows it, with a download link as fallback. Filename: `workout-backup-YYYY-MM-DD.json`. Sets `lastExportAt`.

**Acceptance criteria:**
- [ ] Integration: the export contains every table and `schemaVersion`.
- [ ] The fallback path runs when `navigator.share` is undefined.
- [ ] `lastExportAt` is updated only after the share/download succeeds (not when the user cancels).

**Verification:** `npm test` · manual Share Sheet on iPhone → Save to Files
**Dependencies:** T4 (meaningful after T9)
**Files:** `src/features/settings/backup/{exportData,ExportButton}.ts(x)`(+tests)
**Scope:** S

### - [x] T14: Validated import and backup reminder
**Module:** `backup`
**Description:** File picker → zod-validate against `schemaVersion` (migration hook for older versions) → preview record counts → confirm "Replace all data on this device?" → clear and write in one transaction. Errors are shown in plain language. The Today screen shows a dismissible nudge if `lastExportAt` is null or older than 7 days. Settings shows "Last backup: N days ago".

**Acceptance criteria:**
- [ ] Round trip: seed + logs → export → clear DB → import → deep-equal data.
- [ ] A malformed or wrong-app file → error shown, DB unchanged.
- [ ] Nudge appears at 8 days and disappears after an export.

**Verification:** `npm test` · `npm run test:e2e` (backup round-trip spec)
**Dependencies:** T13
**Files:** `src/features/settings/backup/{importData,ImportButton,schemas}.ts(x)`(+tests), `src/features/today/BackupNudge.tsx`, `e2e/backup.spec.ts`
**Scope:** M

### Checkpoint D: Backup
- [x] Round-trip E2E green (`e2e/backup.spec.ts`)
- [ ] Manual export/import on iPhone through Files

---

## Phase 5: Settings and routine editing

### - [x] T15: Settings screen
**Module:** `routine`
**Description:** Edit every `Settings` field:
- Rest seconds, ramp-up weeks, calorie max, protein target (blank = null), goal/start weight, program start date.
- Backup buttons (T13/T14).
- **Reset to seed**, with a typed confirmation.

**Acceptance criteria:**
- [ ] Validation rejects ≤ 0 rest/calorie values. Clearing the protein field stores `null`.
- [ ] Changing the program start date changes the ramp-up banner on the Today screen immediately.
- [ ] Reset to seed restores Settings/Routine/Exercises but **keeps logs**.

**Verification:** `npm test`
**Dependencies:** T4
**Files:** `src/features/settings/SettingsScreen.tsx`(+test), `src/db/repos/settings.ts`(+test)
**Scope:** M

### - [x] T16: Routine editor — schedule and exercise catalog
**Module:** `routine`
**Description:**
- Schedule editor: a session picker or "rest" for each weekday.
- Catalog editor: name, type, load basis, increment for each exercise.

**Acceptance criteria:**
- [ ] Changing Thursday to `upper-a` changes the Today screen for Thursdays.
- [ ] Increment must be > 0. Load basis options match `LoadBasis`.
- [ ] Past logs keep the values they were logged with.

**Verification:** `npm test`
**Dependencies:** T15
**Files:** `src/features/settings/routine/{ScheduleEditor,CatalogEditor}.tsx`(+tests), `src/db/repos/routine.ts`
**Scope:** M

### - [x] T17: Routine editor — session templates
**Module:** `routine`
**Description:** For each template: add from catalog, remove, reorder (up/down buttons, no drag), and edit sets/repMin/repMax.

**Acceptance criteria:**
- [ ] `repMin ≤ repMax` and sets ≥ 1 are enforced.
- [ ] Changing the Bench sets to 4 affects the next new session, not an active or past one.
- [ ] Removing an exercise doesn't delete its history.

**Verification:** `npm test`
**Dependencies:** T16
**Files:** `src/features/settings/routine/TemplateEditor.tsx`(+test), `src/db/repos/routine.ts`
**Scope:** M

---

## Phase 6: History

### - [x] T18: SVG LineChart component
**Module:** `history` (shared UI)
**Description:** A responsive SVG line chart with these props:
- 1–2 series.
- Optional horizontal reference lines.
- Optional shaded x-ranges.
- Points tappable (≥ 44 px hit area) with a value label.
- y-axis label.

**Acceptance criteria:**
- [ ] Renders correctly for 0, 1 and many points (tests on the SVG output).
- [ ] Scales to its container width with no horizontal scroll at 320 px.
- [ ] Tapping a point shows its value.

**Verification:** `npm test`
**Dependencies:** T1
**Files:** `src/ui/LineChart.tsx`(+test)
**Scope:** S

### - [x] T19: History list and session detail
**Module:** `history`
**Description:**
- The list shows finished sessions newest first: date, name, sets, duration (cardio shows machine + minutes). Swapped exercises are marked.
- The detail view shows each exercise's sets (weight × reps), the RIR target, and swap labels ("Leg press → Hack squat").

**Acceptance criteria:**
- [ ] Discarded and active sessions are excluded.
- [ ] Detail shows the snapshot prescription even after the routine was edited.
- [ ] The list stays smooth with 300 sessions (lazy rendering or pagination).

**Verification:** `npm test`
**Dependencies:** T9, T12
**Files:** `src/features/history/{HistoryList,SessionDetail}.tsx`(+tests), `src/db/repos/history.ts`(+test)
**Scope:** M

### - [x] T20: Exercise progress chart
**Module:** `history`
**Description:** An exercise picker (every exercise with logs, including custom ones) opens a chart of the top-set weight per session. A toggle switches to "best reps at top weight". Ramp-up sessions are shaded. Assistance exercises are labeled "lower is better".

**Acceptance criteria:**
- [ ] Top-set and best-reps series are computed by a pure function with tests.
- [ ] A custom swap exercise appears in the picker.
- [ ] Ramp-up shading matches the sessions where `rampUp` is true.

**Verification:** `npm test`
**Dependencies:** T18, T19
**Files:** `src/features/history/ExerciseProgress.tsx`(+test), `src/domain/exerciseSeries.ts`(+test)
**Scope:** S

---

## Phase 7: Body weight and nutrition

### - [x] T21: Body weight log, chart, 7-day average
**Module:** `body-weight`
**Description:**
- Add `sevenDayAverage()` in the domain layer: the trailing 7 calendar days including that day, skipping days with no entry.
- **Screen:** kg stepper (±0.1, defaults to the last entry or 88), Save (overwrites the same date), and a header with the 7-day average, change from start, and remaining kg to goal.
- **Chart:** daily points + average line + 88/70 reference lines.
- Entries can be edited and deleted.

**Acceptance criteria:**
- [ ] Average tests: gaps, a single entry, and exactly 7 vs 8 days back.
- [ ] Saving twice on the same date leaves one entry.
- [ ] The reference lines use `startingWeightKg`/`goalWeightKg` from Settings.

**Verification:** `npm test`
**Dependencies:** T18
**Files:** `src/domain/averages.ts`(+test), `src/features/body/BodyScreen.tsx`(+test), `src/db/repos/bodyWeight.ts`
**Scope:** M

### - [ ] T22: Nutrition log and protein target
**Module:** `nutrition`
**Description:**
- **Day view:** kcal eaten / `calorieMax`, remaining kcal, and a progress bar that turns warning-colored above the max.
- **Adding entries:** quick-add +100/+250/+500 and a numeric field. Delete an entry with an undo toast. ‹ › moves between days.
- **Protein:** when `proteinTargetG` is set, show a protein field on each entry and "protein eaten / target". When it isn't, hide all protein UI.

**Acceptance criteria:**
- [ ] 1,600 kcal shows the over-max warning and "−100 remaining".
- [ ] Protein UI is absent while the target is `null` and appears once it is set.
- [ ] Undo restores a deleted entry.

**Verification:** `npm test`
**Dependencies:** T15
**Files:** `src/features/food/FoodScreen.tsx`(+test), `src/db/repos/food.ts`(+test)
**Scope:** M

### Checkpoint E: Feature complete
- [ ] `npm run check` and `npm run test:e2e` pass
- [ ] E2E specs exist for: cardio, body weight, and calorie over-max
- [ ] Human review

---

## Phase 8: Release

### - [ ] T23: Accessibility, performance and bundle audit
**Description:** Run Lighthouse (mobile) against `npm run preview`. Check tap targets and contrast, and fix the findings.

**Acceptance criteria:**
- [ ] Lighthouse: installable, Accessibility ≥ 95, Performance ≥ 90.
- [ ] Production JS ≤ 250 KB gzipped (recorded in the PR/commit).
- [ ] No tap target under 44 px on any screen (audit list).

**Verification:** Lighthouse report · `npm run build` size output
**Dependencies:** Checkpoint E
**Files:** whatever the findings touch
**Scope:** S–M

### - [ ] T24: Production deploy and iPhone acceptance run
**Description:** Deploy, then walk through SPEC Success Criteria 1–14 on the iPhone. Record the results in `tasks/acceptance.md`. **Ask before pushing.**

**Acceptance criteria:**
- [ ] All 14 success criteria pass or have an agreed follow-up.
- [ ] A backup was exported from the phone after the run.

**Verification:** Manual on iPhone with the user
**Dependencies:** T23
**Files:** `tasks/acceptance.md`
**Scope:** S

### Checkpoint F: Done
- [ ] Every SPEC success criterion checked
- [ ] Spec updated with any decisions that changed during the build

---

## Phase 9: Owner feedback after 3 sessions (added 2026-11-06)

Build in this order, a few tasks per session. Each task updates SPEC.md where it changes a rule.

### - [ ] T25: "Workout complete" on Today
**Description:** When today's scheduled session is already finished, Today replaces the big Start card with an encouraging "Workout complete" card (session name, sets, minutes, link to its History entry). Other sessions can still be started from the list.

**Acceptance criteria:**
- [ ] Finished today's session → no Start button for it; "Workout complete" card shows instead.
- [ ] A discarded session doesn't count as done; an active one still shows Resume.
- [ ] Rest days and other days are unchanged.

**Verification:** `npm run check`
**Dependencies:** T19
**Files:** `src/features/today/TodayScreen.tsx`(+test)
**Scope:** S

### - [ ] T26: Last-time weights on every set
**Description:** The runner shows what you did last time for the current exercise, e.g. "Last time: 10 × 10 · 10 × 10 · 10 × 9". The existing progression keeps pre-filling the next weight step when every set hit repMax, with the "↑" badge, so both last time and the increase are visible.

**Acceptance criteria:**
- [ ] "Last time" line shows the previous finished session's sets for that exercise (not the current session).
- [ ] Hidden when there is no history; swapped-in exercises show their own history.
- [ ] Runner still fits on 375×667 (E2E).

**Verification:** `npm run check:full`
**Dependencies:** T8
**Files:** `src/features/session/SessionRunner.tsx`(+test), `e2e/session.spec.ts`
**Scope:** S

### - [ ] T27: Push back a day
**Description:** "Can't train today" on Today makes today a rest day and moves the rest of the week's sessions one day later, using up a weekend rest day. Allowed up to 2 times per week (one per rest day available after today). Resets every Monday to the normal schedule.

**Acceptance criteria:**
- [ ] Pure function: schedule + push-back dates for the week → session for any date; tested for 0/1/2 push-backs and the Monday reset.
- [ ] Refused when no rest day is left after today, or today's session is already finished/active.
- [ ] Today, the ramp-up badge and History stay consistent with the shifted week.

**Verification:** `npm run check` (100% branches in the new domain function)
**Dependencies:** T7
**Files:** `src/domain/schedule.ts`(+test), `src/db/types.ts`, `src/db/repos/settings.ts`, `src/features/today/TodayScreen.tsx`(+test)
**Scope:** M

### - [ ] T28: Swap suggestions by muscle group
**Description:** Each exercise gets a main muscle group (seeded for all 21, editable in Settings → Exercises; asked for when creating a new exercise in Swap). The Swap sheet shows a "Same muscle group" section first, then the rest.

**Acceptance criteria:**
- [ ] Seed has a muscle group for every exercise; schema migration fills existing data.
- [ ] Swapping Leg press lists other quad/leg exercises first.
- [ ] Custom exercises without a group still appear under "Other exercises".

**Verification:** `npm run check`
**Dependencies:** T11, T16
**Files:** `src/seed/exerciseDefaults.json`, `src/db/schema.ts`, `src/db/repos/exercises.ts`(+test), `src/features/session/SwapSheet.tsx`, `src/features/settings/routine/CatalogEditor.tsx`
**Scope:** M

### - [ ] T29: kg or lb per exercise
**Description:** Each exercise has its own lift unit (gym dumbbells are kg, plates lb). Dumbbell exercises default to kg, everything else to lb; editable in Settings → Exercises. Labels everywhere use the exercise's unit. Past logged numbers are kept as typed (owner unsure what was entered) and only relabelled; changing an exercise's unit later converts its history and increment. The stashed global-switch WIP (`units.ts` conversion) can be reused.

**Acceptance criteria:**
- [ ] Runner, Overview, Summary, History and charts show "kg each" / "lb/side" per exercise.
- [ ] Migration relabels existing per-dumbbell exercises to kg without changing numbers.
- [ ] Unit change in the editor converts that exercise's sets, suggestions and increment (asks first).

**Verification:** `npm run check:full`
**Dependencies:** T16
**Files:** `src/domain/units.ts`(+test), `src/domain/session.ts`, `src/db/schema.ts`, `src/db/repos/routine.ts`, feature components showing units
**Scope:** M–L (split if it grows)

### - [ ] T30: How-to videos (embedded YouTube)
**Description:** A "▶ How to" button next to the exercise name (runner and Settings → Exercises) opens a bottom sheet with an embedded YouTube video (youtube-nocookie, plays inline, not full screen). Close with a big ✕ or by tapping outside; closing stops playback. Offline shows "Needs internet". One curated video per seed exercise; each replaceable by pasting a YouTube link. Embedding only, no downloaded copies (copyright).

**Acceptance criteria:**
- [ ] All 21 seed exercises have a checked video; custom exercises fall back to a YouTube search link.
- [ ] Open and close in one tap each; sets stay visible under the sheet.
- [ ] Pasted links are validated as YouTube video URLs.

**Verification:** `npm run check:full` · manual on iPhone
**Dependencies:** T16
**Files:** `src/seed/exerciseDefaults.json`, `src/features/session/VideoSheet.tsx`(+test), `src/features/settings/routine/CatalogEditor.tsx`
**Scope:** M (video search is its own sub-step)

### - [ ] T31: Louder rest alarm
**Description:** Play the end-of-rest alarm loudly over music: Audio Session API set so it ducks other audio and ignores the silent switch where iOS supports it, with a longer, louder tone. Then an experiment for a locked phone (background audio workaround), shipped behind a Settings toggle and tested at the gym. A locked-phone alarm can't be promised: iOS freezes web apps when locked, and push notifications would need a server.

**Acceptance criteria:**
- [ ] Alarm plays with the ringer switch on silent and over music (owner confirms at the gym).
- [ ] Locked-phone experiment result recorded here; kept only if it works.
- [ ] Existing timer tests still pass.

**Verification:** `npm run check` · manual at the gym
**Dependencies:** T10
**Files:** `src/features/timer/alerts.ts`(+test), `src/features/settings/SettingsScreen.tsx`
**Scope:** M (includes on-device testing)

### Checkpoint G: Feedback round
- [ ] T25–T31 done or explicitly dropped
- [ ] Owner tried each at the gym
