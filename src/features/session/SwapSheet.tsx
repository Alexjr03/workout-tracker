import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { swapExercise, swapOptions, type SwapTarget } from '../../db/repos/exercises';
import { db } from '../../db/schema';
import { Sheet } from '../../ui/Sheet';
import type { RunnerSlot } from './useRunnerData';

/** Replace the current exercise for this session only (machine taken, etc.). */
export function SwapSheet({ current, onClose }: { current: RunnerSlot; onClose: () => void }) {
  const options = useLiveQuery(() => swapOptions(db, current.slot.id), [current.slot.id]) ?? [];
  const [newName, setNewName] = useState('');
  const inputId = useId();
  const originalId = current.slot.replacesExerciseId;

  async function swap(target: SwapTarget) {
    await swapExercise(db, current.slot.id, target);
    onClose();
  }

  return (
    <Sheet label={`Swap ${current.def.name}`} onClose={onClose}>
      <h2>Swap {current.def.name}</h2>
      <p className="muted">For this session only. Each exercise keeps its own history.</p>
      {originalId && current.replacesName && (
        <button type="button" onClick={() => void swap({ exerciseId: originalId })}>
          Back to {current.replacesName}
        </button>
      )}
      <form
        className="swap-new"
        onSubmit={(e) => {
          e.preventDefault();
          void swap({ newName });
        }}
      >
        <label htmlFor={inputId}>New exercise</label>
        <input
          id={inputId}
          value={newName}
          autoComplete="off"
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="primary" disabled={newName.trim() === ''}>
          Add and swap
        </button>
      </form>
      <ul className="swap-options" aria-label="Exercises">
        {options
          .filter((o) => o.id !== originalId)
          .map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => void swap({ exerciseId: o.id })}>
                {o.name}
              </button>
            </li>
          ))}
      </ul>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
