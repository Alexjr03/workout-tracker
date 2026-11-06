import { Dexie, type EntityTable } from 'dexie';
import exerciseDefaultsJson from '../seed/exerciseDefaults.json';
import { exerciseDefaultsSchema } from '../seed/schemas';
import type {
  ActiveSessionState,
  BodyWeightEntry,
  CardioLog,
  ExerciseDef,
  FoodEntry,
  Routine,
  SessionExerciseLog,
  SessionLog,
  SetLog,
  Settings,
} from './types';

export type WorkoutDb = Dexie & {
  settings: EntityTable<Settings, 'id'>;
  routine: EntityTable<Routine, 'id'>;
  exercises: EntityTable<ExerciseDef, 'id'>;
  sessions: EntityTable<SessionLog, 'id'>;
  sessionExercises: EntityTable<SessionExerciseLog, 'id'>;
  sets: EntityTable<SetLog, 'id'>;
  cardio: EntityTable<CardioLog, 'id'>;
  bodyWeight: EntityTable<BodyWeightEntry, 'date'>;
  food: EntityTable<FoodEntry, 'id'>;
  activeSession: EntityTable<ActiveSessionState, 'id'>;
};

const exerciseDefaults = exerciseDefaultsSchema.parse(exerciseDefaultsJson);

export function createDb(name = 'workout-tracker'): WorkoutDb {
  const db = new Dexie(name) as WorkoutDb;
  // Every version keeps the data of the one before; upgrades only add or fill fields.
  db.version(1).stores({
    settings: 'id',
    routine: 'id',
    exercises: 'id, isCustom',
    sessions: 'id, date, status',
    sessionExercises: 'id, sessionId, exerciseId',
    sets: 'id, sessionId, sessionExerciseId, [exerciseId+completedAt]',
    cardio: 'id, sessionId',
    bodyWeight: 'date',
    food: 'id, date',
    activeSession: 'id',
  });
  // v2: ramp-up keeps every set with the last one optional. Older slots had nothing optional.
  db.version(2).upgrade((tx) =>
    tx
      .table('sessionExercises')
      .toCollection()
      .modify((slot: Partial<SessionExerciseLog>) => {
        slot.optionalSets ??= 0;
        slot.optionalSkipped ??= false;
      }),
  );
  // v3: muscle groups for swap suggestions; seed exercises get theirs, custom ones none.
  db.version(3).upgrade((tx) =>
    tx
      .table('exercises')
      .toCollection()
      .modify((e: Partial<ExerciseDef>) => {
        e.muscle ??= exerciseDefaults[e.id as keyof typeof exerciseDefaults]?.muscle ?? null;
      }),
  );
  // v4: unit per exercise. Dumbbells (kg at the owner's gym) become kg; logged numbers are
  // kept as typed. A dumbbell step still at the old 5 lb default becomes 2 kg.
  db.version(4).upgrade((tx) =>
    tx
      .table('exercises')
      .toCollection()
      .modify((e: Partial<ExerciseDef>) => {
        if (e.unit) return;
        e.unit = e.loadBasis === 'per-dumbbell' ? 'kg' : 'lb';
        if (e.unit === 'kg' && e.increment === 5) e.increment = 2;
      }),
  );
  return db;
}

export const db = createDb();
