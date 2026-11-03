import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { RoutineError, updateExercise } from '../../../db/repos/routine';
import { db } from '../../../db/schema';
import type { ExerciseDef, ExerciseType, LoadBasis } from '../../../db/types';
import { loadBasisLabel } from '../../../domain/session';
import { loadBasisSchema } from '../../../seed/schemas';
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
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), type: useId(), basis: useId() };

  async function save() {
    try {
      await updateExercise(db, exercise.id, { name, type, loadBasis, increment: increment ?? 0 });
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
      <Stepper
        label="Increment"
        unit={loadBasisLabel(loadBasis)}
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
                {loadBasisLabel(e.loadBasis)}
              </span>
            </button>
            {editing === e.id && <ExerciseForm exercise={e} onDone={() => setEditing(null)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
