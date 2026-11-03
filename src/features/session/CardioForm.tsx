import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { saveCardio } from '../../db/repos/cardio';
import { db } from '../../db/schema';
import { Stepper } from '../../ui/Stepper';

export interface CardioTemplate {
  machineOptions: string[];
  minMinutes: number;
  maxMinutes: number;
  intensity: string;
}

const OTHER = 'Other…';

export function CardioForm({
  sessionId,
  name,
  template,
}: {
  sessionId: string;
  name: string;
  template: CardioTemplate;
}) {
  const navigate = useNavigate();
  const [machine, setMachine] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('');
  const [minutes, setMinutes] = useState<number | null>(template.minMinutes);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const otherId = useId();
  const notesId = useId();

  const machineName = machine === OTHER ? otherName.trim() : (machine ?? '');
  const canSave = machineName !== '' && minutes !== null && minutes >= 1 && !saving;

  async function save() {
    if (!canSave || minutes === null) return;
    setSaving(true);
    await saveCardio(db, sessionId, { machine: machineName, durationMin: minutes, notes });
    navigate(`/summary/${sessionId}`);
  }

  return (
    <div className="stack">
      <div>
        <h1>{name}</h1>
        <p className="muted">
          Target {template.minMinutes}–{template.maxMinutes} min · {template.intensity}
        </p>
      </div>

      <div role="group" aria-label="Machine" className="stack">
        {[...template.machineOptions, OTHER].map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={machine === option}
            onClick={() => setMachine(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {machine === OTHER && (
        <div className="field">
          <label htmlFor={otherId}>Machine name</label>
          <input
            id={otherId}
            value={otherName}
            autoComplete="off"
            onChange={(e) => setOtherName(e.target.value)}
          />
        </div>
      )}

      <Stepper label="Minutes" step={5} min={1} value={minutes} onChange={setMinutes} />

      <div className="field">
        <label htmlFor={notesId}>Notes</label>
        <textarea id={notesId} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button type="button" className="primary" disabled={!canSave} onClick={() => void save()}>
        Save cardio
      </button>
    </div>
  );
}
