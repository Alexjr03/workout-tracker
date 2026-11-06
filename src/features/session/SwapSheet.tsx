import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { swapExercise, swapOptions, type SwapTarget } from '../../db/repos/exercises';
import { db } from '../../db/schema';
import type { ExerciseDef, Muscle } from '../../db/types';
import { muscleSchema } from '../../seed/schemas';
import { Sheet } from '../../ui/Sheet';
import type { RunnerSlot } from './useRunnerData';

export const muscleLabel = (m: Muscle) => m[0]?.toUpperCase() + m.slice(1);

function OptionList({
  label,
  options,
  onPick,
}: {
  label: string;
  options: ExerciseDef[];
  onPick: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <>
      <h3 className="muted">{label}</h3>
      <ul className="swap-options" aria-label={label}>
        {options.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => onPick(o.id)}>
              {o.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Replace the current exercise for this session only (machine taken, etc.). */
export function SwapSheet({ current, onClose }: { current: RunnerSlot; onClose: () => void }) {
  const originalId = current.slot.replacesExerciseId;
  const data = useLiveQuery(async () => {
    const [options, original] = await Promise.all([
      swapOptions(db, current.slot.id),
      db.exercises.get(originalId ?? current.slot.exerciseId),
    ]);
    return { ...options, muscle: original?.muscle ?? null };
  }, [current.slot.id, originalId]);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<Muscle | '' | null>(null);
  const ids = { name: useId(), muscle: useId() };

  async function swap(target: SwapTarget) {
    await swapExercise(db, current.slot.id, target);
    onClose();
  }
  const notOriginal = (e: ExerciseDef) => e.id !== originalId;
  // Until changed, a new exercise gets the muscle group of the one it replaces.
  const muscleChoice = newMuscle ?? data?.muscle ?? '';

  return (
    <Sheet label={`Swap ${current.def.name}`} onClose={onClose}>
      <h2>Swap {current.def.name}</h2>
      <p className="muted">For this session only. Each exercise keeps its own history.</p>
      {originalId && current.replacesName && (
        <button type="button" onClick={() => void swap({ exerciseId: originalId })}>
          Back to {current.replacesName}
        </button>
      )}
      {data && (
        <>
          <OptionList
            label={
              data.muscle ? `Same muscle group (${muscleLabel(data.muscle)})` : 'Same muscle group'
            }
            options={data.recommended.filter(notOriginal)}
            onPick={(id) => void swap({ exerciseId: id })}
          />
          <OptionList
            label="Other exercises"
            options={data.others.filter(notOriginal)}
            onPick={(id) => void swap({ exerciseId: id })}
          />
        </>
      )}
      <form
        className="swap-new"
        onSubmit={(e) => {
          e.preventDefault();
          void swap({ newName, muscle: muscleChoice === '' ? null : muscleChoice });
        }}
      >
        <label htmlFor={ids.name}>New exercise</label>
        <input
          id={ids.name}
          value={newName}
          autoComplete="off"
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="primary" disabled={newName.trim() === ''}>
          Add and swap
        </button>
        <label htmlFor={ids.muscle}>Muscle group</label>
        <select
          id={ids.muscle}
          value={muscleChoice}
          onChange={(e) => setNewMuscle(e.target.value as Muscle | '')}
        >
          <option value="">Not set</option>
          {muscleSchema.options.map((m) => (
            <option key={m} value={m}>
              {muscleLabel(m)}
            </option>
          ))}
        </select>
      </form>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
