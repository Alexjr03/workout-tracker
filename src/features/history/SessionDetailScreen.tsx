import { useLiveQuery } from 'dexie-react-hooks';
import { useId } from 'react';
import { Link, useParams } from 'react-router';
import { sessionDetail, type SessionDetail } from '../../db/repos/history';
import { db } from '../../db/schema';
import { formatDayLabel } from '../../domain/dates';
import { rirText } from '../../domain/rampUp';

function ExerciseBlock({ exercise }: { exercise: SessionDetail['exercises'][number] }) {
  const headingId = useId();
  const optional = exercise.optionalSets > 0 ? ' (last optional)' : '';
  return (
    <section aria-labelledby={headingId} className="card stack">
      <h2 id={headingId}>{exercise.name}</h2>
      {exercise.replacesName && (
        <p className="muted">
          {exercise.replacesName} → {exercise.name}
        </p>
      )}
      <p className="muted">
        {exercise.prescribedSets} × {exercise.repMin}–{exercise.repMax}
        {optional} · {rirText(exercise.rirTarget)}
      </p>
      {exercise.sets.length === 0 ? (
        <p className="muted">Not done</p>
      ) : (
        <div className="overview-sets">
          {exercise.sets.map((s, i) => (
            <span key={i} className="tag">
              {s.weight} × {s.reps}
            </span>
          ))}
          <span className="muted">{exercise.unit}</span>
        </div>
      )}
    </section>
  );
}

/** One past session exactly as it was logged. */
export function SessionDetailScreen() {
  const sessionId = useParams().sessionId ?? '';
  const detail = useLiveQuery(() => sessionDetail(db, sessionId), [sessionId]);
  const back = (
    <Link to="/history" className="back-link">
      ‹ History
    </Link>
  );
  if (detail === undefined) return null;
  if (detail === null) {
    return (
      <div className="stack">
        {back}
        <p>Session not found.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      {back}
      <h1>{detail.name}</h1>
      <p className="muted">
        {formatDayLabel(detail.date)} · {detail.minutes} min
      </p>
      {detail.cardio ? (
        <section className="card stack" aria-label="Cardio">
          <p>
            {detail.cardio.machine} · {detail.cardio.durationMin} min
          </p>
          {detail.cardio.notes && <p className="muted">{detail.cardio.notes}</p>}
        </section>
      ) : (
        detail.exercises.map((e, i) => <ExerciseBlock key={i} exercise={e} />)
      )}
    </div>
  );
}
