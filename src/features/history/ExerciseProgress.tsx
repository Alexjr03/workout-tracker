import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { exerciseProgress, loggedExercises } from '../../db/repos/history';
import { db } from '../../db/schema';
import { exerciseSeries, rampUpRanges } from '../../domain/exerciseSeries';
import { loadBasisLabel } from '../../domain/session';
import { LineChart } from '../../ui/LineChart';

type Measure = 'weight' | 'reps';

const toX = (date: string) => Date.parse(`${date}T00:00:00Z`);
const shortDate = (x: number) =>
  new Date(x).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function ExerciseProgress() {
  const [chosen, setChosen] = useState<string | null>(null);
  const [measure, setMeasure] = useState<Measure>('weight');
  const pickerId = useId();

  // One query, so the chart never flashes empty while the exercise list loads.
  const data = useLiveQuery(async () => {
    const exercises = await loggedExercises(db);
    const def = exercises.find((e) => e.id === chosen) ?? exercises[0];
    return { exercises, def, sessions: def ? await exerciseProgress(db, def.id) : [] };
  }, [chosen]);
  if (!data) return null;
  const { exercises, def, sessions } = data;

  const back = (
    <Link to="/history" className="back-link">
      ‹ History
    </Link>
  );
  if (!def) {
    return (
      <div className="stack">
        {back}
        <h1>Exercise progress</h1>
        <p className="muted">Log a set to see progress.</p>
      </div>
    );
  }

  const unit = loadBasisLabel(def.loadBasis, def.unit);
  const points = exerciseSeries(sessions, def.loadBasis);
  const weightAxis = def.loadBasis === 'assistance' ? `${unit} (lower is better)` : unit;
  const isWeight = measure === 'weight';

  return (
    <div className="stack">
      {back}
      <h1>Exercise progress</h1>
      <div className="field">
        <label htmlFor={pickerId}>Exercise</label>
        <select id={pickerId} value={def.id} onChange={(e) => setChosen(e.target.value)}>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div className="row" role="group" aria-label="Measure">
        <button type="button" aria-pressed={isWeight} onClick={() => setMeasure('weight')}>
          Top weight
        </button>
        <button type="button" aria-pressed={!isWeight} onClick={() => setMeasure('reps')}>
          Best reps
        </button>
      </div>
      <LineChart
        label={`${def.name}: ${isWeight ? 'top weight' : 'best reps at top weight'}`}
        yLabel={isWeight ? weightAxis : 'reps'}
        series={[
          {
            name: isWeight ? 'Top weight' : 'Best reps',
            tone: 'primary',
            points: points.map((p) => ({
              x: toX(p.date),
              y: isWeight ? p.topWeight : p.bestReps,
            })),
          },
        ]}
        shadedRanges={rampUpRanges(points).map((r) => ({
          from: toX(r.from),
          to: toX(r.to),
          label: 'Ramp-up',
        }))}
        formatX={shortDate}
        formatY={(y) => (isWeight ? `${y} ${unit}` : `${y} reps`)}
      />
    </div>
  );
}
