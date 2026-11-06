import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { deleteBodyWeight, saveBodyWeight } from '../../db/repos/bodyWeight';
import { db } from '../../db/schema';
import { sevenDayAverage } from '../../domain/averages';
import { formatDayLabel, toLocalDate, type LocalDate } from '../../domain/dates';
import { LineChart } from '../../ui/LineChart';
import { Stepper } from '../../ui/Stepper';

const RECENT = 30;
const toX = (date: string) => Date.parse(`${date}T00:00:00Z`);
const shortDate = (x: number) =>
  new Date(x).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`;

/** Weight input for one date; re-keyed per date so it starts from that date's value. */
function WeightForm({
  date,
  initial,
  editing,
  onDone,
}: {
  date: LocalDate;
  initial: number;
  editing: boolean;
  onDone: () => void;
}) {
  const [kg, setKg] = useState<number | null>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section className="card stack" aria-label="Log weight">
      {editing && <p className="muted">Editing {formatDayLabel(date)}</p>}
      <Stepper label="Weight" unit="kg" step={0.1} value={kg} onChange={setKg} />
      <button
        type="button"
        className="primary"
        disabled={kg === null || kg <= 0}
        onClick={() => {
          if (kg !== null) void saveBodyWeight(db, date, kg).then(onDone);
        }}
      >
        Save
      </button>
      {editing && (
        <div className="row">
          <button type="button" onClick={onDone}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        </div>
      )}
      {confirmDelete && (
        <div role="alertdialog" aria-label="Delete entry?" className="stack">
          <p>Delete the entry for {formatDayLabel(date)}?</p>
          <button
            type="button"
            className="danger"
            onClick={() => void deleteBodyWeight(db, date).then(onDone)}
          >
            Delete entry
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
        </div>
      )}
    </section>
  );
}

export function BodyScreen({ now = new Date() }: { now?: Date }) {
  const today = toLocalDate(now);
  const [editing, setEditing] = useState<LocalDate | null>(null);
  const data = useLiveQuery(async () => {
    const [settings, entries] = await Promise.all([
      db.settings.get('settings'),
      db.bodyWeight.orderBy('date').toArray(),
    ]);
    return { settings, entries };
  });
  if (!data?.settings) return null;
  const { settings, entries } = data;

  const latest = entries.at(-1);
  const current = sevenDayAverage(entries, today) ?? latest?.kg ?? null;
  const date = editing ?? today;
  const initial =
    entries.find((e) => e.date === date)?.kg ?? latest?.kg ?? settings.startingWeightKg;

  return (
    <div className="stack">
      <h1>Body</h1>

      <section className="card stack" aria-label="Summary">
        {current === null ? (
          <p className="muted">Log your weight to see your 7-day average.</p>
        ) : (
          <>
            <p className="muted">7-day average</p>
            <p className="stat">{current} kg</p>
            <p>{signed(current - settings.startingWeightKg)} kg since start</p>
            <p>{Math.max(0, current - settings.goalWeightKg).toFixed(1)} kg to goal</p>
          </>
        )}
      </section>

      <WeightForm
        key={date}
        date={date}
        initial={initial}
        editing={editing !== null}
        onDone={() => setEditing(null)}
      />

      <LineChart
        label="Body weight"
        yLabel="kg"
        series={[
          {
            name: 'Daily',
            tone: 'primary',
            points: entries.map((e) => ({ x: toX(e.date), y: e.kg })),
          },
          {
            name: '7-day average',
            tone: 'secondary',
            showPoints: false,
            points: entries.map((e) => ({
              x: toX(e.date),
              y: sevenDayAverage(entries, e.date) ?? e.kg,
            })),
          },
        ]}
        referenceLines={[
          { y: settings.startingWeightKg, label: `Start ${settings.startingWeightKg}` },
          { y: settings.goalWeightKg, label: `Goal ${settings.goalWeightKg}` },
        ]}
        formatX={shortDate}
        formatY={(y) => `${y} kg`}
      />

      <section className="stack" aria-label="Entries">
        <h2>Entries</h2>
        {entries.length === 0 ? (
          <p className="muted">No entries yet.</p>
        ) : (
          <ul className="overview">
            {entries
              .slice(-RECENT)
              .reverse()
              .map((e) => (
                <li key={e.date}>
                  <button
                    type="button"
                    aria-label={`Edit ${formatDayLabel(e.date)}: ${e.kg} kg`}
                    onClick={() => setEditing(e.date)}
                  >
                    {formatDayLabel(e.date)}
                    <span>{e.kg} kg</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
