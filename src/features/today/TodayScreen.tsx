import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { listHistory } from '../../db/repos/history';
import { pushBackToday } from '../../db/repos/settings';
import { discardSession, getActiveSession, startSession } from '../../db/repos/sessions';
import { db } from '../../db/schema';
import type { SessionTemplate } from '../../db/types';
import { daysBetween, formatDayLabel, toLocalDate } from '../../domain/dates';
import { prescriptionFor } from '../../domain/rampUp';
import { canPushBack, pushBacksLeft, sessionForDate, weekStart } from '../../domain/schedule';
import { historySummary } from '../history/HistoryList';
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
  const [confirmPush, setConfirmPush] = useState(false);
  const scheduledHeading = useId();
  const othersHeading = useId();

  const data = useLiveQuery(async () => {
    const [settings, routine, active, recent] = await Promise.all([
      db.settings.get('settings'),
      db.routine.get('routine'),
      getActiveSession(db),
      listHistory(db, { limit: 5 }),
    ]);
    return { settings, routine, active, doneToday: recent.find((s) => s.date === today) };
  }, [today]);
  if (!data?.settings || !data.routine) return null;
  const { settings, routine, active, doneToday } = data;

  const pushBacks = (settings.pushBacks ?? []).filter((d) => weekStart(d) === weekStart(today));
  const scheduledId = sessionForDate(today, routine, pushBacks);
  const restDaysLeft = pushBacksLeft(today, routine, pushBacks);
  const canPush = !doneToday && !active && canPushBack(today, routine, pushBacks);
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
        {pushBacks.length > 0 && (
          <p className="muted">
            Week pushed back {pushBacks.length} {pushBacks.length === 1 ? 'day' : 'days'} · resets
            Monday
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

      {doneToday ? (
        <section aria-label="Workout complete" className="card stack done-card">
          <h2>Workout complete ✓</h2>
          <p className="history-name">{doneToday.name}</p>
          <p className="muted">{historySummary(doneToday)}</p>
          <p>Nice work. Rest up and refuel.</p>
          <Link to={`/history/session/${doneToday.id}`} className="button-like">
            See details
          </Link>
        </section>
      ) : scheduled ? (
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
          {canPush && !confirmPush && (
            <button type="button" onClick={() => setConfirmPush(true)}>
              Can't train today
            </button>
          )}
          {canPush && confirmPush && (
            <div role="alertdialog" aria-label="Push back a day?" className="stack">
              <p>
                {scheduled.name} moves to tomorrow and the rest of the week shifts one day.{' '}
                {restDaysLeft} rest {restDaysLeft === 1 ? 'day' : 'days'} left this week; this uses
                1. Resets Monday.
              </p>
              <button
                type="button"
                className="primary"
                onClick={() => void pushBackToday(db, now).then(() => setConfirmPush(false))}
              >
                Push back a day
              </button>
              <button type="button" onClick={() => setConfirmPush(false)}>
                Cancel
              </button>
            </div>
          )}
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
