import { z } from 'zod';
import { isLocalDate } from '../../../domain/dates';
import {
  exerciseTypeSchema,
  liftUnitSchema,
  loadBasisSchema,
  muscleSchema,
  routineSeedSchema,
  scheduleSchema,
  sessionTemplateSchema,
} from '../../../seed/schemas';

const localDate = z.string().refine(isLocalDate, 'expected a YYYY-MM-DD date');
const nonNegative = z.number().min(0);
const positive = z.number().positive();

const settings = z.object({
  id: z.literal('settings'),
  units: routineSeedSchema.shape.settings.shape.units,
  rampUpWeeks: z.number().int().min(0),
  restSeconds: z.object({ compound: positive, isolation: positive }),
  calorieMax: positive,
  proteinTargetG: positive.nullable(),
  goalWeightKg: positive,
  startingWeightKg: positive,
  programStartDate: localDate,
  lastExportAt: z.string().nullable(),
  pushBacks: z.array(localDate).optional(),
});

const routine = z.object({
  id: z.literal('routine'),
  schedule: scheduleSchema,
  sessions: z.record(z.string(), sessionTemplateSchema),
  startingLoads: routineSeedSchema.shape.startingLoads,
});

const exercise = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: exerciseTypeSchema,
  loadBasis: loadBasisSchema,
  increment: positive,
  isCustom: z.boolean(),
  muscle: muscleSchema.nullable(),
  unit: liftUnitSchema,
  videoId: z
    .string()
    .regex(/^[\w-]{11}$/)
    .optional(),
});

const session = z.object({
  id: z.string().min(1),
  templateId: z.string(),
  templateName: z.string(),
  date: localDate,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: z.enum(['active', 'finished', 'discarded']),
  rampUp: z.boolean(),
  kind: z.enum(['lifting', 'cardio']),
});

const sessionExercise = z.object({
  id: z.string().min(1),
  sessionId: z.string(),
  order: z.number().int().min(0),
  exerciseId: z.string(),
  replacesExerciseId: z.string().nullable(),
  prescribedSets: z.number().int().min(1),
  optionalSets: z.number().int().min(0),
  optionalSkipped: z.boolean(),
  repMin: z.number().int().min(1),
  repMax: z.number().int().min(1),
  rirTarget: z.enum(['~3', '1-2']),
  suggestedWeight: nonNegative.nullable(),
});

const set = z.object({
  id: z.string().min(1),
  sessionExerciseId: z.string(),
  sessionId: z.string(),
  exerciseId: z.string(),
  setIndex: z.number().int().min(0),
  weight: nonNegative,
  reps: z.number().int().min(0),
  completedAt: z.string(),
});

const cardio = z.object({
  id: z.string().min(1),
  sessionId: z.string(),
  machine: z.string().min(1),
  durationMin: positive,
  notes: z.string(),
});

const bodyWeight = z.object({ date: localDate, kg: positive });

const food = z.object({
  id: z.string().min(1),
  date: localDate,
  kcal: nonNegative,
  proteinG: nonNegative.nullable(),
  createdAt: z.string(),
});

const activeSession = z.object({
  id: z.literal('active'),
  sessionId: z.string(),
  exerciseIndex: z.number().int().min(0),
  setIndex: z.number().int().min(0),
  draftWeight: nonNegative.nullable(),
  draftReps: nonNegative.nullable(),
  restEndsAt: z.string().nullable(),
});

/** Current export shape (schemaVersion 4). */
export const backupSchema = z.object({
  app: z.literal('workout-tracker'),
  schemaVersion: z.literal(4),
  exportedAt: z.string(),
  data: z.object({
    settings: z.array(settings),
    routine: z.array(routine),
    exercises: z.array(exercise),
    sessions: z.array(session),
    sessionExercises: z.array(sessionExercise),
    sets: z.array(set),
    cardio: z.array(cardio),
    bodyWeight: z.array(bodyWeight),
    food: z.array(food),
    activeSession: z.array(activeSession),
  }),
});

export type ValidBackup = z.infer<typeof backupSchema>;
