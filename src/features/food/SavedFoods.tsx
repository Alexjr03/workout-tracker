import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { deleteSavedFood, listSavedFoods, logSavedFood, saveFood } from '../../db/repos/food';
import { db } from '../../db/schema';
import type { SavedFood } from '../../db/types';
import type { LocalDate } from '../../domain/dates';

const parsePositive = (text: string) => {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

function FoodForm({ food, onDone }: { food: SavedFood | null; onDone: () => void }) {
  const [name, setName] = useState(food?.name ?? '');
  const [kcalText, setKcalText] = useState(food ? String(food.kcal) : '');
  const [proteinText, setProteinText] = useState(food?.proteinG?.toString() ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = { name: useId(), kcal: useId(), protein: useId() };
  const kcal = parsePositive(kcalText);
  const canSave = name.trim() !== '' && kcal !== null;

  async function save() {
    if (kcal === null) return;
    await saveFood(db, { name, kcal, proteinG: parsePositive(proteinText) }, food?.id);
    onDone();
  }

  async function remove() {
    if (food) await deleteSavedFood(db, food.id);
    onDone();
  }

  return (
    <div className="stack" role="group" aria-label={food ? `Edit ${food.name}` : 'New food'}>
      <div className="field">
        <label htmlFor={ids.name}>Name</label>
        <input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={ids.kcal}>Food calories</label>
        <input
          id={ids.kcal}
          inputMode="numeric"
          value={kcalText}
          onChange={(e) => setKcalText(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={ids.protein}>Food protein (g, optional)</label>
        <input
          id={ids.protein}
          inputMode="decimal"
          value={proteinText}
          onChange={(e) => setProteinText(e.target.value)}
        />
      </div>
      <div className="row">
        <button type="button" className="primary" disabled={!canSave} onClick={() => void save()}>
          Save food
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
      {food &&
        (confirmDelete ? (
          <div role="alertdialog" aria-label={`Delete ${food.name}?`} className="row">
            <span>Delete {food.name}? Logged entries stay.</span>
            <button type="button" className="danger" onClick={() => void remove()}>
              Delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
            Delete food
          </button>
        ))}
    </div>
  );
}

/** "My foods": one tap logs a saved food to the shown day (T32). */
export function SavedFoods({ day, withProtein }: { day: LocalDate; withProtein: boolean }) {
  const foods = useLiveQuery(() => listSavedFoods(db));
  // null: no form; 'new': creating; a food: editing it.
  const [editing, setEditing] = useState<SavedFood | 'new' | null>(null);
  if (!foods) return null;

  return (
    <section className="card stack" aria-label="My foods">
      <div className="row">
        <h2>My foods</h2>
        {editing === null && (
          <button type="button" onClick={() => setEditing('new')}>
            New food
          </button>
        )}
      </div>
      {editing !== null && (
        <FoodForm
          key={editing === 'new' ? 'new' : editing.id}
          food={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {foods.length === 0 && editing === null && (
        <p className="muted">Save foods you eat often to add them with one tap.</p>
      )}
      <ul className="overview">
        {foods.map((f) => (
          <li key={f.id}>
            <div className="food-row">
              <button
                type="button"
                aria-label={`Log ${f.name}`}
                onClick={() => void logSavedFood(db, f.id, day, { withProtein })}
              >
                {f.name} · {f.kcal.toLocaleString('en-US')} kcal
              </button>
              <button type="button" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}>
                Edit
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
