import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import {
  resetToSeed,
  SettingsError,
  updateSettings,
  type SettingsPatch,
} from '../../db/repos/settings';
import { db } from '../../db/schema';
import { lastBackupText } from '../../domain/backup';
import { Stepper } from '../../ui/Stepper';
import { ExportButton } from './backup/ExportButton';
import { ImportButton } from './backup/ImportButton';

const RESET_WORD = 'RESET';

/** Row that opens another screen: boxed with a chevron so it reads as tappable. */
function NavRow({ to, title, hint }: { to: string; title: string; hint: string }) {
  return (
    <Link to={to} className="nav-row">
      <span className="nav-row-text">
        <span className="nav-row-title">{title}</span>
        <span className="nav-row-hint" aria-hidden="true">
          {hint}
        </span>
      </span>
      <span className="nav-row-chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

function ResetSection() {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const inputId = useId();

  async function reset() {
    await resetToSeed(db);
    setConfirming(false);
    setTyped('');
    setMessage('Routine and settings reset. Your logs are untouched.');
  }

  return (
    <section className="stack settings-section" aria-label="Reset">
      <h2 className="tag-heading">Reset</h2>
      <p className="muted">
        Puts the routine, exercises and these settings back to the original values. Workouts, body
        weight and food logs are kept.
      </p>
      {confirming ? (
        <div role="alertdialog" aria-label="Reset routine?" className="stack">
          <div className="field">
            <label htmlFor={inputId}>Type {RESET_WORD} to confirm</label>
            <input
              id={inputId}
              value={typed}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="danger"
            disabled={typed !== RESET_WORD}
            onClick={() => void reset()}
          >
            Reset
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="danger" onClick={() => setConfirming(true)}>
          Reset routine to defaults
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export function SettingsScreen() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const routine = useLiveQuery(() => db.routine.get('routine'));
  const [error, setError] = useState<string | null>(null);
  const backupHeading = useId();
  const dateId = useId();
  if (!settings) return null;

  async function save(patch: SettingsPatch) {
    try {
      await updateSettings(db, patch);
      setError(null);
    } catch (e) {
      if (!(e instanceof SettingsError)) throw e;
      setError(e.message);
    }
  }

  /** Required numbers: a cleared field is ignored until a value is typed. */
  const saveNumber = (toPatch: (n: number) => SettingsPatch) => (value: number | null) => {
    if (value !== null) void save(toPatch(value));
  };
  const rest = settings.restSeconds;

  return (
    <div className="stack">
      <h1>Settings</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <section className="stack settings-section" aria-label="Routine">
        <h2 className="tag-heading">Routine</h2>
        <NavRow to="/settings/exercises" title="Exercises" hint="Units (kg/lb), steps, videos" />
        <NavRow to="/settings/schedule" title="Weekly schedule" hint="Which session on which day" />
        {Object.entries(routine?.sessions ?? {})
          .filter(([, template]) => 'exercises' in template)
          .map(([id, template]) => (
            <NavRow
              key={id}
              to={`/settings/sessions/${id}`}
              title={template.name}
              hint="Exercises, sets and reps"
            />
          ))}
      </section>

      <section className="stack settings-section" aria-label="Program">
        <h2 className="tag-heading">Program</h2>
        <div className="field">
          <label htmlFor={dateId}>Program start date</label>
          <input
            id={dateId}
            type="date"
            value={settings.programStartDate}
            onChange={(e) => {
              if (e.target.value) void save({ programStartDate: e.target.value });
            }}
          />
        </div>
        <Stepper
          label="Ramp-up weeks"
          unit="weeks"
          step={1}
          value={settings.rampUpWeeks}
          onChange={saveNumber((rampUpWeeks) => ({ rampUpWeeks }))}
        />
      </section>

      <section className="stack settings-section" aria-label="Rest times">
        <h2 className="tag-heading">Rest times</h2>
        <Stepper
          label="Compound rest"
          unit="s"
          step={15}
          min={15}
          value={rest.compound}
          onChange={saveNumber((compound) => ({ restSeconds: { ...rest, compound } }))}
        />
        <Stepper
          label="Isolation rest"
          unit="s"
          step={15}
          min={15}
          value={rest.isolation}
          onChange={saveNumber((isolation) => ({ restSeconds: { ...rest, isolation } }))}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.lockedAlarm ?? false}
            onChange={(e) => void save({ lockedAlarm: e.target.checked })}
          />
          Alarm with phone locked (experimental)
        </label>
      </section>

      <section className="stack settings-section" aria-label="Targets">
        <h2 className="tag-heading">Targets</h2>
        <Stepper
          label="Calorie max"
          unit="kcal"
          step={50}
          value={settings.calorieMax}
          onChange={saveNumber((calorieMax) => ({ calorieMax }))}
        />
        <Stepper
          label="Protein target"
          unit="g"
          step={5}
          value={settings.proteinTargetG}
          onChange={(proteinTargetG) => void save({ proteinTargetG })}
        />
        <p className="muted">Leave protein blank to hide protein tracking.</p>
        <Stepper
          label="Starting weight"
          unit="kg"
          step={0.5}
          value={settings.startingWeightKg}
          onChange={saveNumber((startingWeightKg) => ({ startingWeightKg }))}
        />
        <Stepper
          label="Goal weight"
          unit="kg"
          step={0.5}
          value={settings.goalWeightKg}
          onChange={saveNumber((goalWeightKg) => ({ goalWeightKg }))}
        />
      </section>

      <section aria-labelledby={backupHeading} className="stack settings-section">
        <h2 id={backupHeading} className="tag-heading">
          Backup
        </h2>
        <p className="muted">
          Everything lives only on this phone. Export a copy to Files or iCloud now and then.
        </p>
        <p>{lastBackupText(settings.lastExportAt, new Date())}</p>
        <ExportButton />
        <ImportButton />
      </section>

      <ResetSection />
    </div>
  );
}
