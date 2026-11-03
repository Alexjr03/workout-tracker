import { toLocalDate } from '../../domain/dates';
import { progressionSuggestion, type ExerciseHistoryEntry } from '../../domain/progression';
import { prescriptionFor } from '../../domain/rampUp';
import type { WorkoutDb } from '../schema';
import type { ExerciseDef, SessionExerciseLog, SessionLog } from '../types';

export class ActiveSessionExistsError extends Error {
  constructor(readonly active: SessionLog) {
    super(`${active.templateName} is still in progress`);
    this.name = 'ActiveSessionExistsError';
  }
}

/** Finished sessions' records of one exercise id, for progression. */
export async function exerciseHistory(
  db: WorkoutDb,
  exerciseId: string,
): Promise<ExerciseHistoryEntry[]> {
  const slots = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
  const entries: ExerciseHistoryEntry[] = [];
  for (const slot of slots) {
    const session = await db.sessions.get(slot.sessionId);
    if (session?.status !== 'finished' || !session.finishedAt) continue;
    const sets = await db.sets.where('sessionExerciseId').equals(slot.id).toArray();
    entries.push({
      finishedAt: session.finishedAt,
      prescribedSets: slot.prescribedSets,
      optionalSets: slot.optionalSets,
      repMax: slot.repMax,
      sets,
    });
  }
  return entries;
}

export function getActiveSession(db: WorkoutDb): Promise<SessionLog | undefined> {
  return db.sessions.where('status').equals('active').first();
}

/**
 * Creates the session and one slot per exercise, snapshotting today's prescription and
 * progression suggestion so later routine edits never change this session.
 */
export async function startSession(db: WorkoutDb, templateId: string, now = new Date()) {
  return db.transaction(
    'rw',
    [
      db.settings,
      db.routine,
      db.exercises,
      db.sessions,
      db.sessionExercises,
      db.sets,
      db.activeSession,
    ],
    async () => {
      const active = await getActiveSession(db);
      if (active) throw new ActiveSessionExistsError(active);

      const [settings, routine] = await Promise.all([
        db.settings.get('settings'),
        db.routine.get('routine'),
      ]);
      if (!settings || !routine) throw new Error('App data is not seeded');
      const template = routine.sessions[templateId];
      if (!template) throw new Error(`Unknown session ${templateId}`);

      const date = toLocalDate(now);
      const exercises = 'exercises' in template ? template.exercises : [];
      const { rampUp } = prescriptionFor({ sets: 1, repMin: 1, repMax: 1 }, date, settings);
      const session: SessionLog = {
        id: crypto.randomUUID(),
        templateId,
        templateName: template.name,
        date,
        startedAt: now.toISOString(),
        finishedAt: null,
        status: 'active',
        rampUp,
        kind: 'exercises' in template ? 'lifting' : 'cardio',
      };

      const slots: SessionExerciseLog[] = [];
      for (const [order, exercise] of exercises.entries()) {
        const def: ExerciseDef | undefined = await db.exercises.get(exercise.id);
        if (!def) throw new Error(`Exercise ${exercise.id} is missing from the catalog`);
        const p = prescriptionFor(exercise, date, settings);
        slots.push({
          id: crypto.randomUUID(),
          sessionId: session.id,
          order,
          exerciseId: exercise.id,
          replacesExerciseId: null,
          prescribedSets: p.sets,
          optionalSets: p.optionalSets,
          optionalSkipped: false,
          repMin: p.repMin,
          repMax: p.repMax,
          rirTarget: p.rirTarget,
          suggestedWeight: progressionSuggestion(await exerciseHistory(db, exercise.id), def),
        });
      }

      await db.sessions.add(session);
      await db.sessionExercises.bulkAdd(slots);
      await db.activeSession.put({
        id: 'active',
        sessionId: session.id,
        exerciseIndex: 0,
        setIndex: 0,
        draftWeight: null,
        draftReps: null,
        restEndsAt: null,
      });
      return session.id;
    },
  );
}

export async function finishSession(db: WorkoutDb, sessionId: string, now = new Date()) {
  await db.transaction('rw', db.sessions, db.activeSession, async () => {
    await db.sessions.update(sessionId, { status: 'finished', finishedAt: now.toISOString() });
    await db.activeSession.delete('active');
  });
}

export async function discardSession(db: WorkoutDb, sessionId: string) {
  await db.transaction('rw', db.sessions, db.activeSession, async () => {
    await db.sessions.update(sessionId, { status: 'discarded' });
    await db.activeSession.delete('active');
  });
}
