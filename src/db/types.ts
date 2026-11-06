// Stored record shapes (SPEC › Data Model). Logs snapshot the prescription they were
// logged against, so routine edits never rewrite history.
import type { LocalDate } from '../domain/dates';
import type {
  ExerciseType,
  LoadBasis,
  RoutineSeed,
  Schedule,
  SessionTemplate,
} from '../seed/schemas';

export type { ExerciseType, LoadBasis, Schedule, SessionTemplate };
export type { TemplateExercise } from '../seed/schemas';

export interface Settings {
  id: 'settings';
  units: RoutineSeed['settings']['units'];
  rampUpWeeks: number;
  restSeconds: { compound: number; isolation: number };
  calorieMax: number;
  proteinTargetG: number | null;
  goalWeightKg: number;
  startingWeightKg: number;
  programStartDate: LocalDate;
  lastExportAt: string | null;
  /** Days this week that were pushed back ("can't train today"); only the current week counts. */
  pushBacks?: LocalDate[];
}

export interface Routine {
  id: 'routine';
  schedule: Schedule;
  sessions: Record<string, SessionTemplate>;
  startingLoads: RoutineSeed['startingLoads'];
}

export interface ExerciseDef {
  id: string;
  name: string;
  type: ExerciseType;
  loadBasis: LoadBasis;
  increment: number;
  isCustom: boolean;
}

export type RirTarget = '~3' | '1-2';

export interface SessionLog {
  id: string;
  templateId: string;
  templateName: string;
  date: LocalDate;
  startedAt: string;
  finishedAt: string | null;
  status: 'active' | 'finished' | 'discarded';
  rampUp: boolean;
  kind: 'lifting' | 'cardio';
}

export interface SessionExerciseLog {
  id: string;
  sessionId: string;
  order: number;
  exerciseId: string;
  replacesExerciseId: string | null;
  prescribedSets: number;
  /** Trailing sets that may be skipped (ramp-up: 1, else 0). */
  optionalSets: number;
  /** The user chose Skip last set. */
  optionalSkipped: boolean;
  repMin: number;
  repMax: number;
  rirTarget: RirTarget;
  suggestedWeight: number | null;
}

export interface SetLog {
  id: string;
  sessionExerciseId: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  completedAt: string;
}

export interface CardioLog {
  id: string;
  sessionId: string;
  machine: string;
  durationMin: number;
  notes: string;
}

export interface BodyWeightEntry {
  date: LocalDate;
  kg: number;
}

export interface FoodEntry {
  id: string;
  date: LocalDate;
  kcal: number;
  proteinG: number | null;
  createdAt: string;
}

/** UI state of the session in progress, so a killed app resumes exactly (T9, T10). */
export interface ActiveSessionState {
  id: 'active';
  sessionId: string;
  exerciseIndex: number;
  setIndex: number;
  draftWeight: number | null;
  draftReps: number | null;
  restEndsAt: string | null;
}
