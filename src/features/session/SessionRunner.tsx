import { useState } from 'react';
import { Link } from 'react-router';
import { completeSet, jumpToExercise } from '../../db/repos/sets';
import { db } from '../../db/schema';
import { defaultReps, defaultWeight } from '../../domain/defaults';
import { rirText } from '../../domain/rampUp';
import { loadBasisLabel } from '../../domain/session';
import { Stepper } from '../../ui/Stepper';
import { useRunnerData, type RunnerData, type RunnerSlot } from './useRunnerData';

interface SetEntryProps {
  current: RunnerSlot;
  history: NonNullable<RunnerData['current']>;
  upNext: string | null;
}

/** One set's inputs. Re-keyed per set, so its state starts from that set's defaults. */
function SetEntry({ current, history, upNext }: SetEntryProps) {
  const { slot, def, sets } = current;
  const setIndex = sets.length;
  const [weight, setWeight] = useState<number | null>(() =>
    defaultWeight({
      previousSetWeight: sets.at(-1)?.weight ?? null,
      suggestion: slot.suggestedWeight,
      lastLoggedWeight: history.lastLoggedWeight,
      startingLoad: history.startingLoad,
    }),
  );
  const [reps, setReps] = useState<number | null>(() =>
    defaultReps({ setIndex, lastTimeSets: history.lastTimeSets, repMax: slot.repMax }),
  );
  const [saving, setSaving] = useState(false);
  const unit = loadBasisLabel(def.loadBasis);
  const canComplete = weight !== null && reps !== null && reps >= 1 && !saving;

  async function complete() {
    if (weight === null || reps === null) return;
    setSaving(true);
    // Awaited: the set is in IndexedDB before the next set renders.
    await completeSet(db, { slot, weight, reps });
  }

  return (
    <>
      <div className="runner-target">
        <h1>{def.name}</h1>
        <p className="runner-set">
          Set {setIndex + 1} of {slot.prescribedSets}
        </p>
        <p className="muted">
          {slot.repMin}–{slot.repMax} reps · {rirText(slot.rirTarget)}
        </p>
        {setIndex === 0 && slot.suggestedWeight !== null && (
          <p className="banner">
            {def.loadBasis === 'assistance' ? '↓' : '↑'} {slot.suggestedWeight} {unit}: you hit{' '}
            {slot.repMax} reps on every set
          </p>
        )}
      </div>

      <Stepper
        label="Weight"
        unit={unit}
        step={def.increment}
        value={weight}
        onChange={setWeight}
      />
      <Stepper label="Reps" step={1} min={1} value={reps} onChange={setReps} />

      <div className="runner-action">
        {upNext && <p className="muted">Up next: {upNext}</p>}
        <button
          type="button"
          className="primary"
          disabled={!canComplete}
          onClick={() => void complete()}
        >
          Complete set
        </button>
      </div>
    </>
  );
}

function Overview({ data, onPick }: { data: RunnerData; onPick: (i: number) => void }) {
  return (
    <ul className="overview" aria-label="Exercises">
      {data.slots.map(({ slot, def, sets }, i) => (
        <li key={slot.id}>
          <button
            type="button"
            aria-current={i === data.exerciseIndex ? 'step' : undefined}
            onClick={() => onPick(i)}
          >
            {def.name}
            <span>
              {sets.length}/{slot.prescribedSets}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SessionRunner() {
  const data = useRunnerData();
  const [showOverview, setShowOverview] = useState(false);

  if (data === undefined) return null;
  if (data === null) {
    return (
      <div className="stack">
        <p>No session in progress.</p>
        <Link to="/">Go to Today</Link>
      </div>
    );
  }

  const current = data.slots[data.exerciseIndex];
  const upNext = data.slots.find(
    (s, i) => i > data.exerciseIndex && s.sets.length < s.slot.prescribedSets,
  );

  async function pick(i: number) {
    setShowOverview(false);
    if (data) await jumpToExercise(db, data.sessionId, i);
  }

  return (
    <div className="runner">
      <header className="runner-header">
        <Link to="/">‹ Today</Link>
        <span className="muted">{data.sessionName}</span>
        <button
          type="button"
          aria-expanded={showOverview}
          onClick={() => setShowOverview((v) => !v)}
        >
          Overview
        </button>
      </header>

      {showOverview && <Overview data={data} onPick={(i) => void pick(i)} />}

      {current && data.current ? (
        <SetEntry
          key={`${current.slot.id}:${current.sets.length}`}
          current={current}
          history={data.current}
          upNext={upNext?.def.name ?? null}
        />
      ) : (
        <p className="runner-target">All sets done.</p>
      )}
    </div>
  );
}
