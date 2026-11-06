import { z } from 'zod';

const positive = z.number().positive();
const positiveInt = z.number().int().positive();

export const exerciseTypeSchema = z.enum(['compound', 'isolation']);
export const loadBasisSchema = z.enum(['per-side', 'per-dumbbell', 'total', 'assistance']);
/** Main muscle group, used to suggest swaps that train the same thing. */
export const muscleSchema = z.enum([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
]);

export const templateExerciseSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id'),
    name: z.string().min(1),
    type: exerciseTypeSchema,
    sets: positiveInt,
    repMin: positiveInt,
    repMax: positiveInt,
  })
  .refine((e) => e.repMin <= e.repMax, { message: 'repMin must not exceed repMax' });

const liftingTemplateSchema = z.strictObject({
  name: z.string().min(1),
  targetMinutes: z.string().optional(),
  exercises: z.array(templateExerciseSchema).min(1),
});

const cardioTemplateSchema = z.strictObject({
  name: z.string().min(1),
  cardio: z
    .strictObject({
      machineOptions: z.array(z.string().min(1)).min(1),
      minMinutes: positiveInt,
      maxMinutes: positiveInt,
      intensity: z.string(),
    })
    .refine((c) => c.minMinutes <= c.maxMinutes, {
      message: 'minMinutes must not exceed maxMinutes',
    }),
});

export const sessionTemplateSchema = z.union([liftingTemplateSchema, cardioTemplateSchema]);

const scheduleEntry = z.string().min(1);
export const scheduleSchema = z.strictObject({
  monday: scheduleEntry,
  tuesday: scheduleEntry,
  wednesday: scheduleEntry,
  thursday: scheduleEntry,
  friday: scheduleEntry,
  saturday: scheduleEntry,
  sunday: scheduleEntry,
});

export const routineSeedSchema = z
  .strictObject({
    settings: z.strictObject({
      units: z.strictObject({ liftWeight: z.literal('lb'), bodyWeight: z.literal('kg') }),
      rampUpWeeks: z.number().int().min(0),
      restSeconds: z.strictObject({ compound: positiveInt, isolation: positiveInt }),
      calorieMax: positiveInt,
      goalWeightKg: positive,
      startingWeightKg: positive,
    }),
    startingLoads: z.record(
      z.string(),
      z.strictObject({ value: z.number().min(0), basis: z.string() }),
    ),
    schedule: scheduleSchema,
    sessions: z.record(z.string(), sessionTemplateSchema),
  })
  .superRefine((routine, ctx) => {
    for (const [day, sessionId] of Object.entries(routine.schedule)) {
      if (sessionId !== 'rest' && !(sessionId in routine.sessions)) {
        ctx.addIssue({
          code: 'custom',
          path: ['schedule', day],
          message: `unknown session ${sessionId}`,
        });
      }
    }
    // The same exercise id is one exercise: its name and type must agree everywhere.
    const seen = new Map<string, { name: string; type: string }>();
    for (const [sessionId, session] of Object.entries(routine.sessions)) {
      if (!('exercises' in session)) continue;
      for (const e of session.exercises) {
        const prior = seen.get(e.id);
        if (prior && (prior.name !== e.name || prior.type !== e.type)) {
          ctx.addIssue({
            code: 'custom',
            path: ['sessions', sessionId, e.id],
            message: `exercise ${e.id} differs from its other uses`,
          });
        }
        seen.set(e.id, { name: e.name, type: e.type });
      }
    }
  });

export const exerciseDefaultsSchema = z.record(
  z.string(),
  z.strictObject({ loadBasis: loadBasisSchema, increment: positive, muscle: muscleSchema }),
);

export type RoutineSeed = z.infer<typeof routineSeedSchema>;
export type SessionTemplate = z.infer<typeof sessionTemplateSchema>;
export type TemplateExercise = z.infer<typeof templateExerciseSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;
export type LoadBasis = z.infer<typeof loadBasisSchema>;
export type Muscle = z.infer<typeof muscleSchema>;
