# Spec: Workout Tracker PWA

Status: **Approved 2026-11-03.** Open questions resolved with the stated defaults (see Open Questions).
Date: 2026-11-03

## Objective

A mobile-first, installable PWA for one person to run a fixed weekly gym routine, log lifts and cardio, follow a ramp-up and progression scheme, and track body weight and calories. It runs fully offline, has no account and no backend, and keeps all data on the device with JSON export/import for backups.

**User:** one lifter on an **iPhone (Safari, installed to Home Screen)**, using the app one-handed between sets.

**Success looks like:** the user opens the app at the gym, sees today's session, logs every set with a few taps, never loses a set if the app closes, and can see progress over weeks.

The routine itself (schedule, sessions, exercises, sets, rep ranges, rest times, targets) is **fixed input** given in Appendix A. The app ships it as editable seed data; this spec does not change it.

### Assumptions (correct any of these before approval)

1. **Program start date** is set on first launch (defaults to that day) and is editable in Settings. Ramp-up weeks count from it.
2. **Dates are local calendar days** (`YYYY-MM-DD` in the phone's time zone). "Today" uses the device clock.
3. **Weight is logged in the exercise's load basis.** Bench is logged as lb **per side** (seed: 10 lb/side), dumbbells as lb **per dumbbell**, and machines/cables as the **stack or total** number. The app never converts between bases and never adds bar weight.
4. **Only one session can be active at a time.** Starting another prompts you to finish or discard the active one.
5. **Units:** body weight is always kg. Lifts are weighed per exercise in lb or kg *(changed 2026-11-06 at the owner's request: gym dumbbells are kg, plates lb)*. Dumbbell exercises default to kg, the rest to lb; switching an exercise in Settings → Exercises converts its logged weights. Existing numbers were relabelled, not converted, when this was introduced.
6. **Rest timer alerts only fire while the app is open** (an iOS PWA limitation). The timer is based on timestamps, so it shows the correct remaining time after you switch apps and come back.
7. **Hosting:** the app must be served over HTTPS once so the iPhone can install it. GitHub Pages is assumed (see Open Questions).
8. **"Every prescribed set"** means the required sets shown in that session; an optional ramp-up set that was skipped doesn't count against progression.

## Capability Map

One spec file; each module below has its own section with acceptance criteria. Module ids are stable.

| Module id | Responsibility | Depends on |
|---|---|---|
| `app-shell` | Vite/React scaffold, PWA manifest + service worker, offline caching, bottom navigation, theme | — |
| `data-store` | IndexedDB schema (Dexie), seed loading, repositories, persistent-storage request | — |
| `routine` | Settings + routine editing; pure domain rules: schedule lookup, ramp-up, default weight, progression | `data-store` |
| `rest-timer` | Timestamp-based countdown, adjust/skip, end-of-rest alert, wake lock | `app-shell` |
| `workout-logging` | Today screen, session runner, set logging, swaps, cardio logging, resume after close | `routine`, `rest-timer`, `data-store` |
| `backup` | JSON export (Share Sheet) and validated import | `data-store` |
| `history` | Past sessions list/detail, per-exercise progress chart | `data-store`, `routine` |
| `body-weight` | Weekly kg weigh-ins, chart, start/goal lines | `data-store` |
| `nutrition` | Daily calories vs max, optional protein target | `data-store` |

Build order: `app-shell`, `data-store` → `routine` → `rest-timer` → `workout-logging` → `backup` → `history` → `body-weight`, `nutrition`

Backup comes right after logging so real data can be protected as soon as it exists.

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| UI | React 18+ with function components and hooks |
| Build | Vite |
| PWA | `vite-plugin-pwa` (Workbox, `generateSW`, precache all build assets, `registerType: 'prompt'`) |
| Storage | IndexedDB through `dexie` + `dexie-react-hooks` (`useLiveQuery`) |
| Validation | `zod` (import file + seed validation) |
| Routing | `react-router` (library mode, 5 routes) |
| Charts | In-house SVG line chart component. No chart library. |
| Unit/component tests | Vitest + React Testing Library + `fake-indexeddb` |
| E2E | Playwright, WebKit project with iPhone viewport (`devices['iPhone 13']`) |
| Lint/format | ESLint (typescript-eslint, react-hooks) + Prettier |

Versions: latest stable at scaffold time, locked by `package-lock.json`. Any dependency not listed here is **ask first**.

## Commands

```
Install:     npm install
Dev:         npm run dev            # vite, http://localhost:5173
Build:       npm run build          # tsc -b && vite build
Preview:     npm run preview        # serves dist/ with the service worker active
Typecheck:   npm run typecheck      # tsc --noEmit
Lint:        npm run lint           # eslint . --max-warnings 0
Format:      npm run format         # prettier --write .
Unit tests:  npm test               # vitest run
Coverage:    npm test -- --coverage
E2E:         npm run test:e2e       # playwright test (runs against npm run preview)
Fast checks: npm run check:fast     # types, lint, secrets, floor guard (after each edit)
All checks:  npm run check          # = check:task: fast + tests/coverage + changed-line coverage + build
Full checks: npm run check:full     # check:task + E2E (checkpoints, before deploy)
```

Quality gates, thresholds and where each runs are defined in [CONSTRAINTS.md](CONSTRAINTS.md), which takes precedence over this list.

## Project Structure

```
Workout Tracker/
  SPEC.md
  index.html
  vite.config.ts            → PWA plugin config, manifest
  public/icons/             → 180px apple-touch-icon, 192/512 maskable icons
  src/
    main.tsx                → bootstraps DB, registers SW, renders <App/>
    app/                    → App shell, routes, bottom nav, update prompt   [app-shell]
    db/
      schema.ts             → Dexie tables + versions                         [data-store]
      seed.ts               → loads seed on first run
      repos/                → one file per table group (sessions, sets, bodyWeight…)
    seed/
      routine.json          → Appendix A, verbatim
      exerciseDefaults.json → Appendix B (load basis + increments)
    domain/                 → PURE functions, no React, no Dexie                [routine]
      schedule.ts           → sessionForDate()
      rampUp.ts             → prescriptionFor()
      defaults.ts           → defaultWeight(), defaultReps()
      progression.ts        → progressionSuggestion()
      dates.ts              → local-date helpers
    features/
      today/                → Today screen                                     [workout-logging]
      session/              → session runner, set entry, swap sheet, cardio form
      timer/                → useRestTimer, RestTimerBar                       [rest-timer]
      history/              → list, detail, ExerciseChart                      [history]
      body/                 → body-weight screen                              [body-weight]
      food/                 → nutrition screen                                [nutrition]
      settings/             → settings, routine editor, backup                [routine, backup]
    ui/                     → Button, Stepper, Sheet, LineChart, etc.
  e2e/                      → Playwright specs
```

Unit tests sit next to the code they test (`progression.ts` → `progression.test.ts`).

## Data Model

All records live in IndexedDB. Logs **snapshot** the prescription they were logged against, so later routine edits never rewrite history.

```ts
type LocalDate = string;            // 'YYYY-MM-DD'
type LoadBasis = 'per-side' | 'per-dumbbell' | 'total' | 'assistance';

interface Settings {                // single row, id = 'settings'
  units: { liftWeight: 'lb'; bodyWeight: 'kg' };
  rampUpWeeks: number;              // 2
  restSeconds: { compound: number; isolation: number };   // 150 / 75
  calorieMax: number;               // 1500
  proteinTargetG: number | null;    // null by default
  goalWeightKg: number;             // 70
  startingWeightKg: number;         // 88
  programStartDate: LocalDate;      // set on first launch
  lastExportAt: string | null;      // ISO timestamp
}

interface ExerciseDef {             // catalog, keyed by id
  id: string; name: string; type: 'compound' | 'isolation';
  loadBasis: LoadBasis; increment: number;   // lb, in the load basis
  isCustom: boolean;                // true for swap-created exercises
}

interface Routine {                 // single row, id = 'routine'
  schedule: Record<Weekday, string>;          // session id or 'rest'
  sessions: Record<string, SessionTemplate>;  // Appendix A shape
  startingLoads: Record<string, { value: number; basis: string }>;
}

interface SessionLog {
  id: string; templateId: string; templateName: string;
  date: LocalDate; startedAt: string; finishedAt: string | null;
  status: 'active' | 'finished' | 'discarded';
  rampUp: boolean;                  // was this logged during ramp-up
  kind: 'lifting' | 'cardio';
}

interface SessionExerciseLog {       // one per exercise slot in a session
  id: string; sessionId: string; order: number;
  exerciseId: string;               // the exercise actually performed
  replacesExerciseId: string | null;  // set when swapped
  prescribedSets: number; repMin: number; repMax: number;
  optionalSets: number;             // ramp-up: last set may be skipped (0 or 1)
  optionalSkipped: boolean;         // the user tapped Skip last set
  rirTarget: '~3' | '1-2';
  suggestedWeight: number | null;   // progression suggestion shown, if any
}

interface SetLog {
  id: string; sessionExerciseId: string; sessionId: string; exerciseId: string;
  setIndex: number; weight: number; reps: number; completedAt: string;
}

interface CardioLog {
  id: string; sessionId: string; machine: string;
  durationMin: number; notes: string;
}

interface BodyWeightEntry { date: LocalDate; kg: number }          // one per day
interface FoodEntry { id: string; date: LocalDate; kcal: number; proteinG: number | null; createdAt: string; name?: string }
interface SavedFood { id: string; name: string; kcal: number; proteinG: number | null; uses: number }
```

Dexie indexes: `setLogs` on `[exerciseId+completedAt]` and `sessionId`; `sessions` on `date` and `status`; `foodEntries` on `date`.

## Module Specs

### `app-shell`

- Installs to the iPhone Home Screen. Manifest has `display: standalone`, theme color, name "Workout", and a 180px `apple-touch-icon`.
- After the first load, every screen works in airplane mode, including a cold start.
- Bottom navigation has 5 tabs: **Today · History · Body · Food · Settings**. Tab targets are ≥ 56 px tall and sit within thumb reach.
- Ink theme (manga style): paper-white background, black ink, one red for the main action. Big slanted black "cover" blocks head Today, Food and Body; screentone dots only mark something (rest days, calories left, the area under the weight line). Anything with a black box or a › can be tapped. Fonts (Anton, Zen Kaku Gothic New, latin only) are bundled for offline use. Body text is ≥ 17 px, with ≥ 7:1 contrast for primary text and ≥ 4.5:1 for secondary text.
- Respects the iOS safe-area insets (`env(safe-area-inset-*)`).
- When a new version is available, shows a small "Update ready" prompt. It never reloads during an active session.

### `data-store`

- On first run, seeds `Settings`, `Routine` and `ExerciseDef` from `seed/routine.json` + `seed/exerciseDefaults.json`, and sets `programStartDate` to today. Seeding never runs again unless the user chooses **Reset to seed** (with confirmation).
- Calls `navigator.storage.persist()` on first run.
- The seed files are validated with zod at build/test time. Invalid seed data fails the test suite.
- Every write that represents user progress (completed set, cardio, body weight, food) is awaited inside one Dexie transaction **before** the UI moves on.
- Schema versions use Dexie `version(n).upgrade()`. Migrations are never destructive.

### `routine`

Pure domain functions with full unit test coverage:

- **`sessionForDate(date, routine, pushBacks)`** returns the template id for that weekday or `'rest'`. *(Added 2026-11-06 at the owner's request:)* **Can't train today** on Today makes today a rest day and moves the rest of that week one day later, using up the next rest day after it. Allowed while a rest day is left after today (twice with the seed week), not on a rest day, not with a session in progress or after training today. Push-backs only apply to their own Mon–Sun week, so the schedule resets every Monday.
- **`prescriptionFor(template exercise, date, settings)`** returns:
  - Ramp-up applies while `date < programStartDate + rampUpWeeks × 7 days` (days 0–13 by default). During ramp-up, all sets are prescribed, but **the last set is optional** (`optionalSets = 1` when `sets > 1`, else 0), and `rirTarget = '~3'`. *(Changed 2026-11-03 at the owner's request; it was `sets − 1`.)*
  - Otherwise, `sets` is unchanged, `optionalSets = 0` and `rirTarget = '1-2'`.
  - Required sets = `sets − optionalSets`. The runner offers **Skip last set** on an optional set; a skipped set never counts as missing. Jumping back to that exercise from Overview makes the set available again.
  - Displayed as "3 sets × 8–10 reps · leave ~3 reps in reserve" / "leave 1–2 reps in reserve".
- **`defaultWeight(exerciseId)`** checks these sources in order:
  1. The weight of the previous set in the current session for that exercise.
  2. The progression suggestion, if one exists.
  3. The most recent logged set for that `exerciseId`.
  4. `startingLoads[exerciseId].value`.
  5. Empty (number pad opens).
- **`defaultReps`** checks these sources in order:
  1. The reps from the same set index last time.
  2. `repMax`.
- **`progressionSuggestion(exerciseId)`** looks at the most recent finished session that contains this exerciseId.
  - It suggests `base + increment` when **all** these are true:
    - Every required set was logged (an optional ramp-up set may be skipped).
    - Each logged prescribed set, including an optional one if done, had `reps ≥ repMax`.
  - `base` is the lowest weight used across those sets.
  - For `assistance` exercises, it suggests `base − increment`, and never below 0.
  - Otherwise, it returns `null`.
  - Bench (`per-side`, increment 2.5) suggests "+2.5 lb/side".
  - The suggestion pre-fills the weight and shows a badge, for example "↑ 12.5 lb/side (hit 10 reps on all sets)". The user can change it.
- **Settings screen** edits every field in `Settings`, including the program start date and protein target (blank = none).
- **Routine editor** edits:
  - The schedule (session per weekday).
  - Each template's exercises (add/remove/reorder, sets, repMin, repMax, type).
  - The exercise catalog (name, load basis, increment).
- Validation: `repMin ≤ repMax`, sets ≥ 1, and rest/increment > 0. Edits affect future sessions only.

### `rest-timer`

- Starts automatically when a set is completed. Duration is `restSeconds[exercise.type]` (150 s compound / 75 s isolation).
- Stores `endsAt` as an absolute timestamp, and shows remaining time from `endsAt − now`. It survives app switches, screen lock and reloads; an active timer is restored from storage.
- Controls: **−15 s**, **+15 s**, **Skip**. All are ≥ 56 px.
- At zero (if the app is visible), it plays a loud three-tone alarm as a media clip (lowering music where iOS allows) and flashes the timer bar. The next-set button is already in focus.
- Experimental Settings toggle "Alarm with phone locked": after Complete set, a clip that is silent until the rest ends and then sounds the alarm starts playing, so it can go off with the screen locked. ±15 s restarts it; Skip stops it. Not guaranteed by iOS.
- When it reaches zero while the app is hidden, it shows "Rest done" on return and does not play a late tone.
- During an active session, it requests a Screen Wake Lock where supported and fails silently where not.

### `workout-logging`

**Today screen**
- Shows today's weekday and scheduled session (name, exercise count, and target minutes if any), with a large **Start** button.
- On rest days, shows "Rest day" instead.
- **Start a different session** lists every template (Upper A, Legs, Upper B, Cardio, Shoulders and arms) so you can start any of them manually.
- If a session is active, Today shows **Resume [name]** first.
- If a ramp-up week is active, shows "Ramp-up week N of 2".

**Session runner (lifting)**
- **Above the fold on a 375×667 viewport (iPhone SE)**, without scrolling:
  - Current exercise name.
  - Set "2 of 3".
  - Rep target + RIR text.
  - Weight stepper.
  - Reps stepper.
  - **Complete set** button.
- The primary button sits in the bottom third of the screen.
- **Weight stepper:** − / + by the exercise increment. Tap the value to open a numeric keypad (`inputmode="decimal"`). Shows the basis label ("lb/side", "lb each", "lb", "lb assist").
- **Reps stepper:** − / + by 1, and tap to type.
- **Complete set** writes the `SetLog` immediately, then starts the rest timer and advances to the next set or exercise.
- **Undo last set** is available until the next set is completed. Any logged set can be edited from the session overview.
- A collapsible **session overview** lists all exercises with done/remaining sets. Tap an exercise to jump to it, so you can do exercises out of order.
- **Up next** shows the next exercise name under the main controls.
- **Finish session** is enabled any time. It confirms when sets are still missing. After you finish, it shows a summary (sets done, duration, progression earned).
- If the app is killed mid-session, reopening it restores the exact exercise, set index, entered values and rest timer.

**Exercise swap**
- Each exercise has a **Swap** action that opens a sheet. The sheet shows catalog exercises of the same type first and a "New exercise" name field.
- The swap applies to **this session only**. The template is unchanged.
- The substitute keeps the original's sets, rep range and rest type, and logs under its **own** `exerciseId`.
  - Its history, default weight and progression are separate from the original's.
  - The original's history and progression are untouched.
- New names create a catalog entry with `isCustom: true`. The id is a slug of the name, with a suffix if it already exists. Load basis defaults to `total`, increment to 5.

**Cardio session**
- Form fields:
  - **Machine:** large buttons for the seed options ("Incline treadmill", "StairMaster") + "Other…".
  - **Duration:** minutes stepper, default 30. It shows the 30–45 min target and the intensity cue "Pace where I can still talk".
  - **Notes:** optional, multiline.
- Save writes `CardioLog` and finishes the session.

### `backup`

- **Export:**
  - Builds `{ app: 'workout-tracker', schemaVersion, exportedAt, data: { settings, routine, exercises, sessions, sessionExercises, sets, cardio, bodyWeight, food, savedFoods } }`.
  - On iOS, the file goes through the Share Sheet (`navigator.share({ files })`). Where that isn't available, it falls back to a download link.
  - Filename: `workout-backup-YYYY-MM-DD.json`.
  - Updates `lastExportAt`.
- **Import:**
  - Picks a file and validates it with zod against the current `schemaVersion` (older versions are migrated).
  - Before changing anything, shows record counts, then asks: "Replace all data on this device?"
  - Replaces everything in a single transaction. On any validation or write error, nothing changes and the error is shown in plain language.
- **Reminder:** Settings shows "Last backup: N days ago". Today shows a dismissible nudge when the last backup was more than 7 days ago or never.
- Round trip: export → wipe → import produces identical data.

### `history`

- Lists past sessions newest first, with date, name, set count and duration (or machine + minutes for cardio). Swapped exercises are marked.
- **Session detail:** every exercise with its sets (weight × reps), the RIR target shown, and any swap ("Leg press → Hack squat").
- **Exercise progress:**
  - Pick any exercise, including custom swap exercises.
  - Line chart of the **top-set weight** per session over time. A second series toggles to **best reps at top weight**.
  - Ramp-up sessions are shaded.
  - For assistance exercises, the y-axis is labeled "assistance (lower is better)".
- Charts render offline, scale to the screen width, and give each point a tap target ≥ 44 px.

### `body-weight`

*(Changed 2026-11-06 at the owner's request: weekly weigh-ins replace the daily log and 7-day average.)*

- Log a weigh-in in kg with a large stepper (±0.1, starting from the last entry, or 88 for the first) and a **Save** button. Meant once a week; any day works. There is one entry per date; saving again overwrites it.
- **Chart:** weigh-ins as points joined by a line, with horizontal reference lines at start (88) and goal (70).
- Header shows the latest weigh-in and its date, the change since the previous weigh-in, the change from start, the remaining kg to goal, and the next weigh-in date (7 days after the latest), or "Weigh-in due today" once that date arrives.
- Past entries can be edited and deleted (with confirmation).

### `nutrition`

- The day view shows **kcal eaten / 1,500**, the remaining amount, and a progress bar that turns warning-colored when the total exceeds the max.
- Add entries with quick-add buttons (+100, +250, +500) plus a numeric field. Entries are listed and can be deleted (undo toast).
- **Protein target** is blank by default and edited in Settings. When it's blank, protein UI is hidden. When it's set, each entry gets an optional protein (g) field, and the day view shows protein eaten / target.
- Previous days can be browsed with ‹ › arrows.
- **My foods**: saved foods (name, kcal, optional protein), most used first. One tap logs a copy to the shown day (protein only when a target is set), so editing or deleting a food never changes logged entries. Deleting a food asks first.

## Code Style

- Domain rules are pure functions in `src/domain/`, take plain data, and never touch Dexie or React. Components call repos/hooks, and hooks call domain functions.
- Names use `camelCase` for functions/vars, `PascalCase` for components/types, and `kebab-case` for exercise ids and file names of non-component modules.
- No `any`, and no non-null `!` except in tests. Prefer discriminated unions over boolean flags.
- No magic numbers in UI. Values come from `Settings`/`Routine`.

```ts
// src/domain/rampUp.ts
import { addDays, type LocalDate } from './dates';
import type { Settings, TemplateExercise } from '../db/schema';

export interface Prescription {
  sets: number;
  optionalSets: number;
  repMin: number;
  repMax: number;
  rirTarget: '~3' | '1-2';
  rampUp: boolean;
}

export function prescriptionFor(
  exercise: TemplateExercise,
  date: LocalDate,
  settings: Pick<Settings, 'programStartDate' | 'rampUpWeeks'>,
): Prescription {
  const rampUpEnds = addDays(settings.programStartDate, settings.rampUpWeeks * 7);
  const rampUp = date < rampUpEnds;
  return {
    sets: exercise.sets,
    optionalSets: rampUp && exercise.sets > 1 ? 1 : 0,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    rirTarget: rampUp ? '~3' : '1-2',
    rampUp,
  };
}
```

## Testing Strategy

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | Everything in `src/domain/` at **100% branch coverage**: ramp-up boundaries (day 13 vs 14, last set optional, 1-set exercise has nothing optional), skipping the optional set still allows progression, progression (all-max, one short, missing set, mixed weights, assistance, bench +2.5), default-weight priority, schedule lookup |
| Integration | Vitest + `fake-indexeddb` | Repos, seeding runs once, set write durability, swap history separation, export→import round trip, invalid import leaves data untouched |
| Component | Vitest + RTL | Steppers, session runner advancing, timer adjust/skip with fake timers |
| E2E | Playwright (WebKit, iPhone 13 viewport) | Full Upper A session; reload mid-session restores state; offline cold start via `context.setOffline(true)`; cardio log; body weight + chart; calorie over-max state; backup round trip |
| Manual | Real iPhone | Install to Home Screen, airplane-mode launch, timer after lock/unlock, Share Sheet export, one-handed reach check |

Overall line coverage target: ≥ 80%. Tests are written before or alongside each domain function (TDD for `src/domain/`).

## Boundaries

- **Always:**
  - Run `npm run check` before calling a task done.
  - Persist a set before updating the UI.
  - Keep domain logic pure and tested.
  - Read every routine value from stored data, never hard-coded in UI.
  - Keep tap targets ≥ 44 px (primary actions ≥ 56 px).
- **Ask first:**
  - Adding any dependency not in the Tech Stack table.
  - Changing the data model or the export format/`schemaVersion`.
  - Changing anything in the seed routine (Appendix A).
  - Changing the progression or ramp-up rules.
  - Adding any network call.
- **Never:**
  - Add a backend, account, analytics, telemetry or third-party network request. *(One exception, owner request 2026-11-06: how-to videos are YouTube embeds via youtube-nocookie.com that load only when you tap ▶ How to.)*
  - Store data anywhere but on the device.
  - Delete or overwrite user data without an explicit confirmation.
  - Skip or delete failing tests to get green.
  - Write migrations that drop user data.

## Success Criteria

1. Installed on iPhone from the Home Screen, the app cold-starts and is fully usable in airplane mode.
2. On a Monday after the ramp-up window, Today shows **Upper A**. The Bench press card shows "3 sets × 8–10 · leave 1–2 reps in reserve" with a weight of 10 lb/side on first use.
3. On day 0–13 after the program start date, every exercise shows its full sets with the last one marked optional (Skip last set), and "~3 reps in reserve". On day 14, normal sets with nothing optional and "1–2" are shown.
4. Completing a set takes **≤ 2 taps** when the defaults are correct (Complete set → timer runs → Complete set …).
5. Force-quitting the app right after tapping **Complete set**, then reopening, shows that set saved and resumes at the next set.
6. A compound set starts a 2:30 timer and an isolation set starts a 1:15 timer. ±15 s and Skip work, and the timer is correct after locking the phone for 60 s.
7. After a session where bench hit 10 reps on all prescribed sets at 10 lb/side, the next Upper A suggests 12.5 lb/side. If any set is short, no suggestion appears.
8. Swapping Leg press for "Hack squat" logs under a new exercise. Leg press's history, default weight and progression are unchanged.
9. History shows every finished session and a working chart for each exercise ever logged.
10. Body weight shows the latest weekly weigh-in, change since the last one, the next weigh-in date, the chart, and the 88 → 70 reference lines.
11. Food shows kcal vs 1,500 with an over-max warning. Protein UI is hidden until a target is set.
12. Export → clear site data → import restores identical data. A malformed file is rejected with no changes.
13. Lighthouse (mobile) shows the PWA as installable, with Accessibility ≥ 95 and Performance ≥ 90. The production JS bundle is ≤ 250 KB gzipped.
14. `npm run check` and `npm run test:e2e` pass.

## Open Questions

Resolved with defaults at approval. Any of them can be revisited later.

1. **Hosting:** GitHub Pages. Creating the repo and pushing still need your OK at deploy time.
2. **Exercise increments:** Appendix B as written, editable in the app.
3. **Squat variants:** keep one shared `squat` history. Use Swap if you want a variant tracked separately.
4. **Missed sessions:** strict calendar. Each weekday shows its scheduled session; skipped sessions don't roll forward.

## Appendix A — Seed routine (verbatim, `src/seed/routine.json`)

```json
{
  "settings": {
    "units": { "liftWeight": "lb", "bodyWeight": "kg" },
    "rampUpWeeks": 2,
    "restSeconds": { "compound": 150, "isolation": 75 },
    "calorieMax": 1500,
    "goalWeightKg": 70,
    "startingWeightKg": 88
  },
  "startingLoads": {
    "bench-press": { "value": 10, "basis": "lb per side" }
  },
  "schedule": {
    "monday": "upper-a",
    "tuesday": "legs",
    "wednesday": "upper-b",
    "thursday": "cardio",
    "friday": "shoulders-arms",
    "saturday": "rest",
    "sunday": "rest"
  },
  "sessions": {
    "upper-a": {
      "name": "Upper A",
      "exercises": [
        { "id": "bench-press", "name": "Bench press", "type": "compound", "sets": 3, "repMin": 8, "repMax": 10 },
        { "id": "machine-row", "name": "Chest-supported or machine row", "type": "compound", "sets": 3, "repMin": 8, "repMax": 10 },
        { "id": "lat-pulldown", "name": "Lat pulldown", "type": "compound", "sets": 3, "repMin": 8, "repMax": 12 },
        { "id": "db-shoulder-press", "name": "Seated dumbbell shoulder press", "type": "compound", "sets": 3, "repMin": 8, "repMax": 10 },
        { "id": "lateral-raise", "name": "Lateral raise", "type": "isolation", "sets": 2, "repMin": 12, "repMax": 15 },
        { "id": "triceps-pushdown", "name": "Triceps pushdown", "type": "isolation", "sets": 2, "repMin": 10, "repMax": 12 }
      ]
    },
    "legs": {
      "name": "Legs",
      "exercises": [
        { "id": "squat", "name": "Back squat or Smith machine squat", "type": "compound", "sets": 3, "repMin": 6, "repMax": 8 },
        { "id": "romanian-deadlift", "name": "Romanian deadlift", "type": "compound", "sets": 3, "repMin": 8, "repMax": 10 },
        { "id": "leg-press", "name": "Leg press", "type": "compound", "sets": 3, "repMin": 10, "repMax": 12 },
        { "id": "seated-leg-curl", "name": "Seated leg curl", "type": "isolation", "sets": 3, "repMin": 10, "repMax": 12 },
        { "id": "leg-extension", "name": "Leg extension", "type": "isolation", "sets": 2, "repMin": 12, "repMax": 15 },
        { "id": "calf-raise", "name": "Calf raise", "type": "isolation", "sets": 3, "repMin": 10, "repMax": 15 }
      ]
    },
    "upper-b": {
      "name": "Upper B",
      "exercises": [
        { "id": "incline-db-press", "name": "Incline dumbbell press", "type": "compound", "sets": 3, "repMin": 8, "repMax": 10 },
        { "id": "assisted-pull-up", "name": "Assisted pull-up", "type": "compound", "sets": 3, "repMin": 8, "repMax": 10 },
        { "id": "seated-cable-row", "name": "Seated cable row", "type": "compound", "sets": 3, "repMin": 10, "repMax": 12 },
        { "id": "cable-fly", "name": "Cable fly", "type": "isolation", "sets": 2, "repMin": 12, "repMax": 15 },
        { "id": "lateral-raise", "name": "Lateral raise", "type": "isolation", "sets": 2, "repMin": 12, "repMax": 15 },
        { "id": "db-curl", "name": "Dumbbell curl", "type": "isolation", "sets": 3, "repMin": 10, "repMax": 12 }
      ]
    },
    "cardio": {
      "name": "Cardio",
      "cardio": {
        "machineOptions": ["Incline treadmill", "StairMaster"],
        "minMinutes": 30,
        "maxMinutes": 45,
        "intensity": "Pace where I can still talk"
      }
    },
    "shoulders-arms": {
      "name": "Shoulders and arms",
      "targetMinutes": "30-40",
      "exercises": [
        { "id": "machine-shoulder-press", "name": "Machine shoulder press", "type": "compound", "sets": 3, "repMin": 10, "repMax": 12 },
        { "id": "lateral-raise", "name": "Lateral raise", "type": "isolation", "sets": 3, "repMin": 12, "repMax": 15 },
        { "id": "face-pull", "name": "Face pull", "type": "isolation", "sets": 3, "repMin": 12, "repMax": 15 },
        { "id": "hammer-curl", "name": "Hammer curl", "type": "isolation", "sets": 3, "repMin": 10, "repMax": 12 },
        { "id": "overhead-triceps-extension", "name": "Overhead triceps extension", "type": "isolation", "sets": 3, "repMin": 10, "repMax": 12 }
      ]
    }
  }
}
```

## Appendix B — Exercise defaults (`src/seed/exerciseDefaults.json`, editable in app)

These add load basis and increment only. Name, type, sets and reps come from Appendix A.

| Exercise id | Load basis | Increment (lb) |
|---|---|---|
| bench-press | per-side | 2.5 |
| machine-row | total | 5 |
| lat-pulldown | total | 5 |
| db-shoulder-press | per-dumbbell | 5 |
| lateral-raise | per-dumbbell | 5 |
| triceps-pushdown | total | 5 |
| squat | per-side | 2.5 |
| romanian-deadlift | per-side | 2.5 |
| leg-press | per-side | 2.5 |
| seated-leg-curl | total | 5 |
| leg-extension | total | 5 |
| calf-raise | total | 5 |
| incline-db-press | per-dumbbell | 5 |
| assisted-pull-up | assistance | 5 (suggests **less** assistance) |
| seated-cable-row | total | 5 |
| cable-fly | total | 5 |
| db-curl | per-dumbbell | 5 |
| machine-shoulder-press | total | 5 |
| face-pull | total | 5 |
| hammer-curl | per-dumbbell | 5 |
| overhead-triceps-extension | total | 5 |
