import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { saveDraft } from '../../db/repos/activeSession';
import { finishSession } from '../../db/repos/sessions';
import { completeSet, jumpToExercise, setRestEndsAt, undoLastSet } from '../../db/repos/sets';
import { db } from '../../db/schema';
import { defaultReps, defaultWeight } from '../../domain/defaults';
import { rirText } from '../../domain/rampUp';
import { loadBasisLabel } from '../../domain/session';
import { Stepper } from '../../ui/Stepper';
import { primeAudio, useWakeLock } from '../timer/alerts';
import { RestTimerBar } from '../timer/RestTimerBar';
import { SessionOverview } from './SessionOverview';
import { SwapSheet } from './SwapSheet';
import { useRunnerData, type RunnerData, type RunnerSlot } from './useRunnerData';

interface SetEntryProps {
  current: RunnerSlot;
  history: NonNullable<RunnerData['current']>;
  draft: RunnerData['draft'];
  upNext: string | null;
  canUndo: boolean;
  onUndo: () => void;
  restEndsAt: string | null;
}

/** One set's inputs. Re-keyed per set, so its state starts from that set's draft or defaults. */
function SetEntry({ current, history, draft, upNext, canUndo, onUndo, restEndsAt }: SetEntryProps) {
  const { slot, def, sets } = current;
  const setIndex = sets.length;
  const [weight, setWeight] = useState<number | null>(
    () =>
      draft.weight ??
      defaultWeight({
        previousSetWeight: sets.at(-1)?.weight ?? null,
        suggestion: slot.suggestedWeight,
        lastLoggedWeight: history.lastLoggedWeight,
        startingLoad: history.startingLoad,
      }),
  );
  const [reps, setReps] = useState<number | null>(
    () =>
      draft.reps ??
      defaultReps({ setIndex, lastTimeSets: history.lastTimeSets, repMax: slot.repMax }),
  );
  const [saving, setSaving] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const unit = loadBasisLabel(def.loadBasis);
  const canComplete = weight !== null && reps !== null && reps >= 1 && !saving;

  function change(next: { weight: number | null; reps: number | null }) {
    setWeight(next.weight);
    setReps(next.reps);
    void saveDraft(db, next);
  }

  async function complete() {
    if (weight === null || reps === null) return;
    primeAudio(); // inside the tap, so iOS lets the timer beep later
    setSaving(true);
    // Awaited: the set is in IndexedDB before the next set renders.
    await completeSet(db, { slot, weight, reps });
  }

  return (
    <>
      <div className="runner-target">
        <div className="runner-title">
          <h1>{def.name}</h1>
          {/* Swapping is only allowed before the exercise's first set. */}
          {setIndex === 0 && (
            <button type="button" onClick={() => setSwapping(true)}>
              Swap
            </button>
          )}
        </div>
        {current.replacesName && <p className="muted">Swapped for {current.replacesName}</p>}
        {swapping && <SwapSheet current={current} onClose={() => setSwapping(false)} />}
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
        onChange={(w) => change({ weight: w, reps })}
      />
      <Stepper
        label="Reps"
        step={1}
        min={1}
        value={reps}
        onChange={(r) => change({ weight, reps: r })}
      />
      {canUndo && (
        <button type="button" className="runner-undo" onClick={onUndo}>
          Undo last set
        </button>
      )}

      <div className="runner-action">
        {restEndsAt && (
          <RestTimerBar
            key={restEndsAt}
            endsAt={restEndsAt}
            onChange={(endsAt) => void setRestEndsAt(db, endsAt)}
          />
        )}
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

export function SessionRunner() {
  const data = useRunnerData();
  const navigate = useNavigate();
  const [showOverview, setShowOverview] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  useWakeLock(Boolean(data));

  if (data === undefined) return null;
  if (data === null) {
    return (
      <div className="stack">
        <p>No session in progress.</p>
        <Link to="/">Go to Today</Link>
      </div>
    );
  }

  const { sessionId } = data;
  const current = data.slots[data.exerciseIndex];
  const upNext = data.slots.find(
    (s, i) => i > data.exerciseIndex && s.sets.length < s.slot.prescribedSets,
  );
  const setsMissing = data.slots.reduce(
    (n, s) => n + Math.max(0, s.slot.prescribedSets - s.sets.length),
    0,
  );
  const canUndo = data.slots.some((s) => s.sets.length > 0);

  async function pick(i: number) {
    setShowOverview(false);
    await jumpToExercise(db, sessionId, i);
  }

  async function finish() {
    await finishSession(db, sessionId);
    navigate(`/summary/${sessionId}`);
  }

  function requestFinish() {
    if (setsMissing > 0) setConfirmFinish(true);
    else void finish();
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

      {confirmFinish && (
        <div role="alertdialog" aria-label="Finish session?" className="card stack">
          <p>{setsMissing} sets not done. Finish anyway?</p>
          <button type="button" className="danger" onClick={() => void finish()}>
            Finish anyway
          </button>
          <button type="button" onClick={() => setConfirmFinish(false)}>
            Keep going
          </button>
        </div>
      )}

      {showOverview && (
        <SessionOverview data={data} onPick={(i) => void pick(i)} onFinish={requestFinish} />
      )}

      {current && data.current ? (
        <SetEntry
          key={`${current.slot.id}:${current.slot.exerciseId}:${current.sets.length}`}
          current={current}
          history={data.current}
          draft={data.draft}
          upNext={upNext?.def.name ?? null}
          canUndo={canUndo}
          onUndo={() => void undoLastSet(db, sessionId)}
          restEndsAt={data.restEndsAt}
        />
      ) : (
        <>
          <p className="runner-target">All sets done.</p>
          <div className="runner-action">
            <button type="button" className="primary" onClick={requestFinish}>
              Finish session
            </button>
          </div>
        </>
      )}
    </div>
  );
}
