import type { LocalDate } from '../../domain/dates';
import { loadBasisLabel } from '../../domain/session';
import type { WorkoutDb } from '../schema';
import type { RirTarget, SessionLog } from '../types';

export interface HistoryItem {
  id: string;
  date: LocalDate;
  name: string;
  kind: SessionLog['kind'];
  sets: number;
  minutes: number;
  cardio: { machine: string; durationMin: number } | null;
  swapped: boolean;
}

const minutesOf = (s: SessionLog) =>
  s.finishedAt ? Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60_000) : 0;

/** Finished sessions, newest first, one page at a time. */
export async function listHistory(
  db: WorkoutDb,
  { limit = 30, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<HistoryItem[]> {
  const finished = await db.sessions.where('status').equals('finished').toArray();
  finished.sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));
  const page = finished.slice(offset, offset + limit);

  return Promise.all(
    page.map(async (s) => {
      const [sets, slots, cardio] = await Promise.all([
        db.sets.where('sessionId').equals(s.id).count(),
        db.sessionExercises.where('sessionId').equals(s.id).toArray(),
        db.cardio.where('sessionId').equals(s.id).first(),
      ]);
      return {
        id: s.id,
        date: s.date,
        name: s.templateName,
        kind: s.kind,
        sets,
        minutes: minutesOf(s),
        cardio: cardio ? { machine: cardio.machine, durationMin: cardio.durationMin } : null,
        swapped: slots.some((slot) => slot.replacesExerciseId !== null),
      };
    }),
  );
}

export interface SessionDetail {
  id: string;
  date: LocalDate;
  name: string;
  minutes: number;
  rampUp: boolean;
  exercises: {
    name: string;
    replacesName: string | null;
    prescribedSets: number;
    optionalSets: number;
    repMin: number;
    repMax: number;
    rirTarget: RirTarget;
    unit: string;
    sets: { weight: number; reps: number }[];
  }[];
  cardio: { machine: string; durationMin: number; notes: string } | null;
}

/** One session as it was logged: the prescription snapshot and every set. */
export async function sessionDetail(db: WorkoutDb, id: string): Promise<SessionDetail | null> {
  const session = await db.sessions.get(id);
  if (!session) return null;
  const [slots, sets, cardio] = await Promise.all([
    db.sessionExercises.where('sessionId').equals(id).sortBy('order'),
    db.sets.where('sessionId').equals(id).sortBy('setIndex'),
    db.cardio.where('sessionId').equals(id).first(),
  ]);
  const [defs, originals] = await Promise.all([
    db.exercises.bulkGet(slots.map((s) => s.exerciseId)),
    db.exercises.bulkGet(slots.map((s) => s.replacesExerciseId ?? '')),
  ]);

  return {
    id,
    date: session.date,
    name: session.templateName,
    minutes: minutesOf(session),
    rampUp: session.rampUp,
    exercises: slots.map((slot, i) => {
      const def = defs[i];
      return {
        name: def?.name ?? slot.exerciseId,
        replacesName: originals[i]?.name ?? null,
        prescribedSets: slot.prescribedSets,
        optionalSets: slot.optionalSets,
        repMin: slot.repMin,
        repMax: slot.repMax,
        rirTarget: slot.rirTarget,
        unit: def ? loadBasisLabel(def.loadBasis) : 'lb',
        sets: sets
          .filter((s) => s.sessionExerciseId === slot.id)
          .map((s) => ({ weight: s.weight, reps: s.reps })),
      };
    }),
    cardio: cardio
      ? { machine: cardio.machine, durationMin: cardio.durationMin, notes: cardio.notes }
      : null,
  };
}

async function finishedIds(db: WorkoutDb): Promise<Set<string>> {
  return new Set(await db.sessions.where('status').equals('finished').primaryKeys());
}

/** Exercises with at least one set in a finished session, by name (swap-created ones too). */
export async function loggedExercises(db: WorkoutDb) {
  const finished = await finishedIds(db);
  const sets = await db.sets.toArray();
  const ids = [...new Set(sets.filter((s) => finished.has(s.sessionId)).map((s) => s.exerciseId))];
  const defs = await db.exercises.bulkGet(ids);
  return defs.filter((d) => d !== undefined).sort((a, b) => a.name.localeCompare(b.name));
}

/** Per finished session: date, ramp-up flag and the sets logged for one exercise. */
export async function exerciseProgress(db: WorkoutDb, exerciseId: string) {
  const finished = await finishedIds(db);
  const slots = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
  const result = [];
  for (const slot of slots) {
    if (!finished.has(slot.sessionId)) continue;
    const [session, sets] = await Promise.all([
      db.sessions.get(slot.sessionId),
      db.sets.where('sessionExerciseId').equals(slot.id).sortBy('setIndex'),
    ]);
    if (!session) continue;
    result.push({
      date: session.date,
      rampUp: session.rampUp,
      sets: sets.map((s) => ({ weight: s.weight, reps: s.reps })),
    });
  }
  return result;
}
