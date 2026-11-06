import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import {
  RoutineError,
  setExerciseUnit,
  setExerciseVideo,
  updateExercise,
} from '../../../db/repos/routine';
import { db } from '../../../db/schema';
import type { ExerciseDef, ExerciseType, LoadBasis, Muscle } from '../../../db/types';
import { loadBasisLabel } from '../../../domain/session';
import { loadBasisSchema, muscleSchema } from '../../../seed/schemas';
import { muscleLabel } from '../../session/SwapSheet';
import { VideoSheet } from '../../session/VideoSheet';
import { Stepper } from '../../../ui/Stepper';

const BASIS_NAMES: Record<LoadBasis, string> = {
  'per-side': 'Per side (barbell plates)',
  'per-dumbbell': 'Per dumbbell',
  total: 'Total (machine or cable stack)',
  assistance: 'Assistance (less is harder)',
};

function ExerciseForm({ exercise, onDone }: { exercise: ExerciseDef; onDone: () => void }) {
  const [name, setName] = useState(exercise.name);
  const [type, setType] = useState<ExerciseType>(exercise.type);
  const [loadBasis, setLoadBasis] = useState<LoadBasis>(exercise.loadBasis);
  const [increment, setIncrement] = useState<number | null>(exercise.increment);
  const [muscle, setMuscle] = useState<Muscle | null>(exercise.muscle);
  const [confirmUnit, setConfirmUnit] = useState(false);
  const [link, setLink] = useState('');
  const [watching, setWatching] = useState(false);
  const otherUnit = exercise.unit === 'kg' ? 'lb' : 'kg';
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), type: useId(), basis: useId(), muscle: useId(), link: useId() };

  async function saveLink(value: string | null) {
    try {
      await setExerciseVideo(db, exercise.id, value);
      setLink('');
      setError(null);
    } catch (e) {
      if (!(e instanceof RoutineError)) throw e;
      setError(e.message);
    }
  }

  async function save() {
    try {
      await updateExercise(db, exercise.id, {
        name,
        type,
        loadBasis,
        increment: increment ?? 0,
        muscle,
      });
      onDone();
    } catch (e) {
      if (!(e instanceof RoutineError)) throw e;
      setError(e.message);
    }
  }

  return (
    <div role="group" aria-label={`Edit ${exercise.name}`} className="card stack">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor={ids.name}>Name</label>
        <input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={ids.type}>Type</label>
        <select
          id={ids.type}
          value={type}
          onChange={(e) => setType(e.target.value as ExerciseType)}
        >
          <option value="compound">Compound</option>
          <option value="isolation">Isolation</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={ids.muscle}>Muscle group</label>
        <select
          id={ids.muscle}
          value={muscle ?? ''}
          onChange={(e) => setMuscle(e.target.value === '' ? null : (e.target.value as Muscle))}
        >
          <option value="">Not set</option>
          {muscleSchema.options.map((m) => (
            <option key={m} value={m}>
              {muscleLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={ids.basis}>Weight is logged as</label>
        <select
          id={ids.basis}
          value={loadBasis}
          onChange={(e) => setLoadBasis(e.target.value as LoadBasis)}
        >
          {loadBasisSchema.options.map((b) => (
            <option key={b} value={b}>
              {BASIS_NAMES[b]}
            </option>
          ))}
        </select>
      </div>
      <div className="stack">
        <p>Weighed in {exercise.unit}</p>
        {confirmUnit ? (
          <div role="alertdialog" aria-label={`Switch to ${otherUnit}?`} className="stack">
            <p>
              Switch {exercise.name} to {otherUnit}? Its logged weights, suggestion and step are
              converted from {exercise.unit}.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => void setExerciseUnit(db, exercise.id, otherUnit).then(onDone)}
            >
              Convert to {otherUnit}
            </button>
            <button type="button" onClick={() => setConfirmUnit(false)}>
              Keep {exercise.unit}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmUnit(true)}>
            Switch to {otherUnit}
          </button>
        )}
      </div>
      <div className="stack">
        <button type="button" onClick={() => setWatching(true)}>
          ▶ How to
        </button>
        {watching && <VideoSheet exercise={exercise} onClose={() => setWatching(false)} />}
        <div className="field">
          <label htmlFor={ids.link}>YouTube link</label>
          <input
            id={ids.link}
            value={link}
            inputMode="url"
            autoComplete="off"
            placeholder={
              exercise.videoId ? 'Your video is set' : 'Paste a link to use your own video'
            }
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
        <div className="row">
          <button type="button" disabled={link.trim() === ''} onClick={() => void saveLink(link)}>
            Save link
          </button>
          {exercise.videoId && (
            <button type="button" onClick={() => void saveLink(null)}>
              Use default video
            </button>
          )}
        </div>
      </div>
      <Stepper
        label="Increment"
        unit={loadBasisLabel(loadBasis, exercise.unit)}
        step={2.5}
        value={increment}
        onChange={setIncrement}
      />
      <button type="button" className="primary" onClick={() => void save()}>
        Save
      </button>
      <button type="button" onClick={onDone}>
        Cancel
      </button>
    </div>
  );
}

export function CatalogEditor() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('id').toArray());
  const [editing, setEditing] = useState<string | null>(null);
  if (!exercises) return null;
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="stack">
      <Link to="/settings" className="back-link">
        ‹ Settings
      </Link>
      <h1>Exercises</h1>
      <p className="muted">
        Type sets the rest time. Increment is the weight step for −/+ and progression.
      </p>
      <ul className="overview" aria-label="Exercises">
        {sorted.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => setEditing(e.id)}>
              {e.name}
              <span className="muted">
                {e.type === 'compound' ? 'Compound' : 'Isolation'} · {e.increment}{' '}
                {loadBasisLabel(e.loadBasis, e.unit)}
              </span>
            </button>
            {editing === e.id && <ExerciseForm exercise={e} onDone={() => setEditing(null)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
