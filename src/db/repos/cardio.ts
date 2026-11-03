import type { WorkoutDb } from '../schema';
import type { CardioLog } from '../types';

/** Logs a cardio session and finishes it, in one transaction. Returns the log id. */
export async function saveCardio(
  db: WorkoutDb,
  sessionId: string,
  input: { machine: string; durationMin: number; notes: string },
  now = new Date(),
): Promise<string> {
  const machine = input.machine.trim();
  if (!machine) throw new Error('Pick a machine');
  if (!(input.durationMin >= 1)) throw new Error('Duration must be at least 1 minute');

  const log: CardioLog = {
    id: crypto.randomUUID(),
    sessionId,
    machine,
    durationMin: input.durationMin,
    notes: input.notes.trim(),
  };
  await db.transaction('rw', db.cardio, db.sessions, db.activeSession, async () => {
    await db.cardio.add(log);
    await db.sessions.update(sessionId, { status: 'finished', finishedAt: now.toISOString() });
    await db.activeSession.delete('active');
  });
  return log.id;
}
