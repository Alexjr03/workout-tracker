import { useState } from 'react';
import { updateSet } from '../../db/repos/sets';
import { db } from '../../db/schema';
import type { SetLog } from '../../db/types';
import { loadBasisLabel, targetSets } from '../../domain/session';
import { Stepper } from '../../ui/Stepper';
import type { RunnerData, RunnerSlot } from './useRunnerData';

function EditSet({ item, set, onDone }: { item: RunnerSlot; set: SetLog; onDone: () => void }) {
  const [weight, setWeight] = useState<number | null>(set.weight);
  const [reps, setReps] = useState<number | null>(set.reps);
  const label = `Edit ${item.def.name} set ${set.setIndex + 1}`;

  async function save() {
    if (weight === null || reps === null) return;
    await updateSet(db, set.id, { weight, reps });
    onDone();
  }

  return (
    <div role="group" aria-label={label} className="card stack">
      <Stepper
        label="Weight"
        unit={loadBasisLabel(item.def.loadBasis)}
        step={item.def.increment}
        value={weight}
        onChange={setWeight}
      />
      <Stepper label="Reps" step={1} min={1} value={reps} onChange={setReps} />
      <button
        type="button"
        className="primary"
        disabled={weight === null || reps === null || reps < 1}
        onClick={() => void save()}
      >
        Save
      </button>
      <button type="button" onClick={onDone}>
        Cancel
      </button>
    </div>
  );
}

interface SessionOverviewProps {
  data: RunnerData;
  onPick: (exerciseIndex: number) => void;
  onFinish: () => void;
}

/** Every exercise with its logged sets: jump to one, edit a set, or finish. */
export function SessionOverview({ data, onPick, onFinish }: SessionOverviewProps) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="stack">
      <ul className="overview" aria-label="Exercises">
        {data.slots.map((item, i) => (
          <li key={item.slot.id}>
            <button
              type="button"
              aria-current={i === data.exerciseIndex ? 'step' : undefined}
              onClick={() => onPick(i)}
            >
              {item.def.name}
              <span>
                {item.sets.length}/{targetSets(item.slot)}
              </span>
            </button>
            {item.sets.length > 0 && (
              <div className="overview-sets">
                {item.sets.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    aria-label={`Edit ${item.def.name} set ${set.setIndex + 1}: ${set.weight} × ${set.reps}`}
                    onClick={() => setEditing(set.id)}
                  >
                    {set.weight} × {set.reps}
                  </button>
                ))}
              </div>
            )}
            {item.sets.map(
              (set) =>
                editing === set.id && (
                  <EditSet key={set.id} item={item} set={set} onDone={() => setEditing(null)} />
                ),
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="danger" onClick={onFinish}>
        Finish session
      </button>
    </div>
  );
}
