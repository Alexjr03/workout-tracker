import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { db } from '../../db/schema';
import { loadBasisLabel } from '../../domain/session';
import { sessionSummary, type SessionSummary } from '../../domain/summary';

type Loaded =
  | { kind: 'lifting'; name: string; summary: SessionSummary }
  | { kind: 'cardio'; name: string; machine: string; minutes: number };

async function load(sessionId: string): Promise<Loaded | null> {
  const session = await db.sessions.get(sessionId);
  if (!session?.finishedAt) return null;

  if (session.kind === 'cardio') {
    const log = await db.cardio.where('sessionId').equals(sessionId).first();
    if (!log) return null;
    return {
      kind: 'cardio',
      name: session.templateName,
      machine: log.machine,
      minutes: log.durationMin,
    };
  }

  const [slots, sets] = await Promise.all([
    db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order'),
    db.sets.where('sessionId').equals(sessionId).toArray(),
  ]);
  const defs = await db.exercises.bulkGet(slots.map((s) => s.exerciseId));
  const exercises = slots.flatMap((slot, i) => {
    const def = defs[i];
    if (!def) return [];
    return [
      {
        def,
        prescribedSets: slot.prescribedSets,
        repMax: slot.repMax,
        sets: sets.filter((s) => s.sessionExerciseId === slot.id),
      },
    ];
  });
  return {
    kind: 'lifting',
    name: session.templateName,
    summary: sessionSummary({
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      exercises,
    }),
  };
}

function LiftingSummary({ summary }: { summary: SessionSummary }) {
  return (
    <>
      <p className="muted">
        {summary.setsDone} of {summary.setsPrescribed} sets · {summary.minutes} min
      </p>
      <section className="card stack" aria-label="Next time">
        {summary.progressions.length === 0 ? (
          <p>No weight increases this time.</p>
        ) : (
          summary.progressions.map((p) => (
            <p key={p.name}>
              {p.name}: {p.next} {loadBasisLabel(p.loadBasis)} next time
            </p>
          ))
        )}
      </section>
    </>
  );
}

export function FinishSummary() {
  const sessionId = useParams().sessionId ?? '';
  const navigate = useNavigate();
  const data = useLiveQuery(() => load(sessionId), [sessionId]);

  if (data === undefined) return null;
  if (data === null) return <p>Session not found.</p>;

  return (
    <div className="stack">
      <h1>{data.name} done</h1>
      {data.kind === 'cardio' ? (
        <p className="muted">
          {data.machine} · {data.minutes} min
        </p>
      ) : (
        <LiftingSummary summary={data.summary} />
      )}
      <button type="button" className="primary" onClick={() => navigate('/')}>
        Done
      </button>
    </div>
  );
}
