import { Dexie, type EntityTable } from 'dexie';
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

export function createDb(name = 'workout-tracker'): WorkoutDb {
  const db = new Dexie(name) as WorkoutDb;
  // Version 1. Later versions add .upgrade() migrations; never drop user data.
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
  return db;
}

export const db = createDb();
