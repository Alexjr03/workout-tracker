import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  addTemplateExercise,
  moveTemplateExercise,
  removeTemplateExercise,
  RoutineError,
  updateTemplateExercise,
} from '../../../db/repos/routine';
import { db } from '../../../db/schema';
import { Stepper } from '../../../ui/Stepper';

/** Edit one session's exercises: sets, rep range, order, add and remove. Future sessions only. */
export function TemplateEditor() {
  const templateId = useParams().templateId ?? '';
  const data = useLiveQuery(async () => {
    const [routine, exercises] = await Promise.all([
      db.routine.get('routine'),
      db.exercises.toArray(),
    ]);
    return { template: routine?.sessions[templateId] ?? null, exercises };
  }, [templateId]);
  const [editing, setEditing] = useState<string | null>(null);
  const [toAdd, setToAdd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const addId = useId();

  if (!data) return null;
  const back = (
    <Link to="/settings" className="back-link">
      ‹ Settings
    </Link>
  );
  if (!data.template)
    return (
      <div className="stack">
        {back}
        <p>Session not found.</p>
      </div>
    );
  if (!('exercises' in data.template)) {
    return (
      <div className="stack">
        {back}
        <p>Cardio sessions have no exercises to edit.</p>
      </div>
    );
  }
  const { name, exercises } = data.template;
  const available = data.exercises
    .filter((e) => !exercises.some((t) => t.id === e.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function run(action: () => Promise<void>) {
    try {
      await action();
      setError(null);
    } catch (e) {
      if (!(e instanceof RoutineError)) throw e;
      setError(e.message);
    }
  }

  const update = (index: number, field: 'sets' | 'repMin' | 'repMax') => (value: number | null) => {
    if (value !== null)
      void run(() => updateTemplateExercise(db, templateId, index, { [field]: value }));
  };

  return (
    <div className="stack">
      {back}
      <h1>{name}</h1>
      <p className="muted">Changes apply from the next session you start.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <ul className="overview" aria-label="Exercises">
        {exercises.map((e, i) => (
          <li key={e.id}>
            <div className="template-row">
              <span className="template-row-name">{e.name}</span>
              <span className="muted">
                {e.sets} × {e.repMin}–{e.repMax}
              </span>
              <button
                type="button"
                aria-label={`Move ${e.name} up`}
                disabled={i === 0}
                onClick={() => void run(() => moveTemplateExercise(db, templateId, i, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${e.name} down`}
                disabled={i === exercises.length - 1}
                onClick={() => void run(() => moveTemplateExercise(db, templateId, i, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Edit ${e.name}`}
                aria-expanded={editing === e.id}
                onClick={() => setEditing(editing === e.id ? null : e.id)}
              >
                Edit
              </button>
            </div>
            {editing === e.id && (
              <div role="group" aria-label={e.name} className="card stack">
                <Stepper
                  label="Sets"
                  step={1}
                  min={1}
                  value={e.sets}
                  onChange={update(i, 'sets')}
                  commitOnBlur
                />
                <Stepper
                  label="Rep min"
                  step={1}
                  min={1}
                  value={e.repMin}
                  onChange={update(i, 'repMin')}
                  commitOnBlur
                />
                <Stepper
                  label="Rep max"
                  step={1}
                  min={1}
                  value={e.repMax}
                  onChange={update(i, 'repMax')}
                  commitOnBlur
                />
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    void run(async () => {
                      await removeTemplateExercise(db, templateId, i);
                      setEditing(null);
                    })
                  }
                >
                  Remove from {name}
                </button>
                <p className="muted">Removing keeps this exercise's history.</p>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="field">
        <label htmlFor={addId}>Add exercise</label>
        <select id={addId} value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
          <option value="">Choose…</option>
          {available.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={toAdd === ''}
        onClick={() =>
          void run(async () => {
            await addTemplateExercise(db, templateId, toAdd);
            setToAdd('');
          })
        }
      >
        Add
      </button>
    </div>
  );
}
