import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { addFood, deleteFood, restoreFood } from '../../db/repos/food';
import { db } from '../../db/schema';
import type { FoodEntry } from '../../db/types';
import { addDays, formatDayLabel, toLocalDate } from '../../domain/dates';

const QUICK_ADD = [100, 250, 500];
const fmt = (n: number) => n.toLocaleString('en-US');
const parsePositive = (text: string) => {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

export function FoodScreen({ now = new Date() }: { now?: Date }) {
  const today = toLocalDate(now);
  const [day, setDay] = useState(today);
  const [kcalText, setKcalText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [deleted, setDeleted] = useState<FoodEntry | null>(null);
  const ids = { kcal: useId(), protein: useId() };

  const data = useLiveQuery(async () => {
    const [settings, entries] = await Promise.all([
      db.settings.get('settings'),
      db.food.where('date').equals(day).sortBy('createdAt'),
    ]);
    return { settings, entries };
  }, [day]);
  if (!data?.settings) return null;
  const { settings, entries } = data;

  const max = settings.calorieMax;
  const target = settings.proteinTargetG;
  const eaten = entries.reduce((n, e) => n + e.kcal, 0);
  const protein = entries.reduce((n, e) => n + (e.proteinG ?? 0), 0);
  const remaining = max - eaten;
  const over = remaining < 0;
  const kcal = parsePositive(kcalText);

  async function add(amount: number, proteinG: number | null) {
    await addFood(db, { date: day, kcal: amount, proteinG });
    setDeleted(null);
  }

  return (
    <div className="stack">
      <h1>Food</h1>
      <div className="day-nav">
        <button type="button" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          ‹
        </button>
        <span>{formatDayLabel(day)}</span>
        <button
          type="button"
          aria-label="Next day"
          disabled={day >= today}
          onClick={() => setDay(addDays(day, 1))}
        >
          ›
        </button>
      </div>

      <section className="card stack" aria-label="Day total">
        <p className="stat">
          {fmt(eaten)} / {fmt(max)} kcal
        </p>
        <div
          role="progressbar"
          aria-label="Calories"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={eaten}
          className={over ? 'progress over' : 'progress'}
        >
          <div style={{ width: `${Math.min(100, (eaten / max) * 100)}%` }} />
        </div>
        <p>
          {over ? '−' : ''}
          {fmt(Math.abs(remaining))} remaining
        </p>
        {over && <p className="error">Over your maximum</p>}
        {target !== null && (
          <p>
            Protein {fmt(protein)} / {fmt(target)} g
          </p>
        )}
      </section>

      <section className="card stack" aria-label="Add food">
        <div className="row">
          {QUICK_ADD.map((n) => (
            <button key={n} type="button" onClick={() => void add(n, null)}>
              +{n}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor={ids.kcal}>Calories</label>
          <input
            id={ids.kcal}
            inputMode="numeric"
            value={kcalText}
            onChange={(e) => setKcalText(e.target.value)}
          />
        </div>
        {target !== null && (
          <div className="field">
            <label htmlFor={ids.protein}>Protein (g)</label>
            <input
              id={ids.protein}
              inputMode="decimal"
              value={proteinText}
              onChange={(e) => setProteinText(e.target.value)}
            />
          </div>
        )}
        <button
          type="button"
          className="primary"
          disabled={kcal === null}
          onClick={() => {
            if (kcal === null) return;
            void add(kcal, target === null ? null : parsePositive(proteinText));
            setKcalText('');
            setProteinText('');
          }}
        >
          Add
        </button>
      </section>

      {deleted && (
        <div role="status" className="card row">
          <span>Entry deleted</span>
          <button
            type="button"
            onClick={() => {
              void restoreFood(db, deleted);
              setDeleted(null);
            }}
          >
            Undo
          </button>
        </div>
      )}

      <ul className="overview" aria-label="Entries">
        {entries.map((e) => {
          const label =
            target !== null && e.proteinG !== null
              ? `${fmt(e.kcal)} kcal · ${e.proteinG} g protein`
              : `${fmt(e.kcal)} kcal`;
          return (
            <li key={e.id}>
              <div className="food-row">
                <span>{label}</span>
                <button
                  type="button"
                  aria-label={`Delete ${fmt(e.kcal)} kcal`}
                  onClick={() => void deleteFood(db, e.id).then((d) => setDeleted(d ?? null))}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
