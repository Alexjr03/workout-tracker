import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { discardSession, getActiveSession, startSession } from '../../db/repos/sessions';
import { db } from '../../db/schema';
import type { SessionTemplate } from '../../db/types';
import { daysBetween, formatDayLabel, toLocalDate } from '../../domain/dates';
import { prescriptionFor } from '../../domain/rampUp';
import { sessionForDate } from '../../domain/schedule';
import { BackupNudge } from './BackupNudge';

function summary(template: SessionTemplate): string {
  if ('cardio' in template) {
    const c = template.cardio;
    return `${c.minMinutes}–${c.maxMinutes} min · ${c.intensity}`;
  }
  const count = `${template.exercises.length} exercises`;
  return template.targetMinutes ? `${count} · ${template.targetMinutes} min` : count;
}

export function TodayScreen({ now = new Date() }: { now?: Date }) {
  const navigate = useNavigate();
  const today = toLocalDate(now);
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null);
  const scheduledHeading = useId();
  const othersHeading = useId();

  const data = useLiveQuery(async () => {
    const [settings, routine, active] = await Promise.all([
      db.settings.get('settings'),
      db.routine.get('routine'),
      getActiveSession(db),
    ]);
    return { settings, routine, active };
  });
  if (!data?.settings || !data.routine) return null;
  const { settings, routine, active } = data;

  const scheduledId = sessionForDate(today, routine);
  const scheduled = scheduledId === 'rest' ? undefined : routine.sessions[scheduledId];
  const others = Object.entries(routine.sessions).filter(([id]) => id !== scheduledId);
  const { rampUp } = prescriptionFor({ sets: 1, repMin: 1, repMax: 1 }, today, settings);
  const rampUpWeek = Math.min(
    settings.rampUpWeeks,
    Math.max(1, Math.floor(daysBetween(settings.programStartDate, today) / 7) + 1),
  );

  async function start(id: string, name: string) {
    if (active) {
      setPending({ id, name });
      return;
    }
    await startSession(db, id, now);
    navigate('/session');
  }

  async function replaceAndStart() {
    if (!pending || !active) return;
    await discardSession(db, active.id);
    await startSession(db, pending.id, now);
    navigate('/session');
  }

  return (
    <div className="stack">
      <header>
        <h1>Today</h1>
        <p className="muted">{formatDayLabel(today)}</p>
        {rampUp && (
          <p className="banner">
            Ramp-up week {rampUpWeek} of {settings.rampUpWeeks}
          </p>
        )}
      </header>

      {active && (
        <button type="button" className="primary" onClick={() => navigate('/session')}>
          Resume {active.templateName}
        </button>
      )}

      {pending && active && (
        <div role="alertdialog" aria-label="Session in progress" className="card stack">
          <p>{active.templateName} is still in progress.</p>
          <button type="button" className="danger" onClick={() => void replaceAndStart()}>
            Discard {active.templateName} and start {pending.name}
          </button>
          <button type="button" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      )}

      {scheduled ? (
        <section aria-labelledby={scheduledHeading} className="card stack">
          <h2 id={scheduledHeading}>{scheduled.name}</h2>
          <p className="muted">{summary(scheduled)}</p>
          <button
            type="button"
            className="primary"
            onClick={() => void start(scheduledId, scheduled.name)}
          >
            Start {scheduled.name}
          </button>
        </section>
      ) : (
        <section className="card">
          <h2>Rest day</h2>
        </section>
      )}

      <section aria-labelledby={othersHeading} className="stack">
        <h2 id={othersHeading}>Start a different session</h2>
        {others.map(([id, template]) => (
          <button key={id} type="button" onClick={() => void start(id, template.name)}>
            {template.name}
          </button>
        ))}
      </section>

      <BackupNudge now={now} />
    </div>
  );
}
