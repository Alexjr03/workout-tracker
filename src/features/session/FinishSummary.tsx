import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { db } from '../../db/schema';
import { loadBasisLabel } from '../../domain/session';
import { sessionSummary } from '../../domain/summary';

async function load(sessionId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session?.finishedAt) return null;
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
    name: session.templateName,
    summary: sessionSummary({
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      exercises,
    }),
  };
}

export function FinishSummary() {
  const sessionId = useParams().sessionId ?? '';
  const navigate = useNavigate();
  const data = useLiveQuery(() => load(sessionId), [sessionId]);

  if (data === undefined) return null;
  if (data === null) return <p>Session not found.</p>;
  const { name, summary } = data;

  return (
    <div className="stack">
      <h1>{name} done</h1>
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
      <button type="button" className="primary" onClick={() => navigate('/')}>
        Done
      </button>
    </div>
  );
}
