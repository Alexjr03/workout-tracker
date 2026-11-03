import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import { saveCardio } from './cardio';
import { startSession } from './sessions';

const THU = new Date(2026, 10, 26, 7);
const DONE = new Date(2026, 10, 26, 7, 40);
let sessionId: string;

beforeEach(async () => {
  await resetDb();
  sessionId = await startSession(db, 'cardio', THU);
});

describe('saveCardio', () => {
  it('logs the cardio and finishes the session', async () => {
    const id = await saveCardio(
      db,
      sessionId,
      { machine: 'StairMaster', durationMin: 35, notes: 'Level 6' },
      DONE,
    );
    expect(await db.cardio.get(id)).toEqual({
      id,
      sessionId,
      machine: 'StairMaster',
      durationMin: 35,
      notes: 'Level 6',
    });
    expect(await db.sessions.get(sessionId)).toMatchObject({
      kind: 'cardio',
      status: 'finished',
      finishedAt: DONE.toISOString(),
    });
    expect(await db.activeSession.get('active')).toBeUndefined();
  });

  it('trims the machine name and notes', async () => {
    const id = await saveCardio(
      db,
      sessionId,
      { machine: '  Rower ', durationMin: 30, notes: '  ' },
      DONE,
    );
    expect(await db.cardio.get(id)).toMatchObject({ machine: 'Rower', notes: '' });
  });

  it('rejects a missing machine or a duration under a minute', async () => {
    await expect(
      saveCardio(db, sessionId, { machine: ' ', durationMin: 30, notes: '' }, DONE),
    ).rejects.toThrow('Pick a machine');
    await expect(
      saveCardio(db, sessionId, { machine: 'StairMaster', durationMin: 0, notes: '' }, DONE),
    ).rejects.toThrow('Duration must be at least 1 minute');
    expect(await db.cardio.count()).toBe(0);
    expect((await db.sessions.get(sessionId))?.status).toBe('active');
  });
});
