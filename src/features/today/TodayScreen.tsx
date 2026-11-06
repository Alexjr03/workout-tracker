import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { listHistory } from '../../db/repos/history';
import { pushBackToday } from '../../db/repos/settings';
import { discardSession, getActiveSession, startSession } from '../../db/repos/sessions';
import { db } from '../../db/schema';
import type { SessionTemplate } from '../../db/types';
import { addDays, daysBetween, formatDayLabel, toLocalDate } from '../../domain/dates';
import { prescriptionFor } from '../../domain/rampUp';
import { canPushBack, pushBacksLeft, sessionForDate, weekStart } from '../../domain/schedule';
import { historySummary } from '../history/HistoryList';
import { BackupNudge } from './BackupNudge';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const scheduledHeading = useId();
  const othersHeading = useId();

  const data = useLiveQuery(async () => {
    const monday = weekStart(today);
    const [settings, routine, active, recent, week, food, weight] = await Promise.all([
      db.settings.get('settings'),
      db.routine.get('routine'),
      getActiveSession(db),
      listHistory(db, { limit: 5 }),
      db.sessions.where('date').between(monday, addDays(monday, 6), true, true).toArray(),
      db.food.where('date').equals(today).toArray(),
      db.bodyWeight.orderBy('date').last(),
    ]);
    return {
      settings,
      routine,
      active,
      doneToday: recent.find((s) => s.date === today),
      trained: new Set(week.filter((s) => s.status === 'finished').map((s) => s.date)),
      eaten: food.reduce((n, e) => n + e.kcal, 0),
      weight,
    };
  }, [today]);
  if (!data?.settings || !data.routine) return null;
  const { settings, routine, active, doneToday, trained, eaten, weight } = data;

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

  const monday = weekStart(today);
  const week = DAY_LETTERS.map((letter, i) => {
    const date = addDays(monday, i);
    const state = trained.has(date)
      ? 'done'
      : sessionForDate(date, routine, pushBacks) === 'rest'
        ? 'rest'
        : 'planned';
    return { date, letter, name: DAY_NAMES[i], state };
  });
  const kcalLeft = settings.calorieMax - eaten;
  // Shown whenever a session is in progress, whatever else the cover says.
  const resumeButton = active && (
    <button type="button" className="primary" onClick={() => navigate('/session')}>
      Resume <span className="visually-hidden">{active.templateName}</span>{' '}
      <span aria-hidden="true">›</span>
    </button>
  );

  return (
    <div className="stack">
      <div className="cover stack">
        <header>
          <h1 className="visually-hidden">Today</h1>
          <p className="cover-meta">{formatDayLabel(today)}</p>
          {rampUp && (
            <p className="banner">
              Ramp-up week {rampUpWeek} of {settings.rampUpWeeks}
            </p>
          )}
          {pushBacks.length > 0 && (
            <p className="cover-meta">
              Week pushed back {pushBacks.length} {pushBacks.length === 1 ? 'day' : 'days'} · resets
              Monday
            </p>
          )}
        </header>

        {doneToday ? (
          <section aria-label="Workout complete" className="stack">
            <p className="cover-meta">Workout complete ✓</p>
            <h2 className="cover-big">{doneToday.name}</h2>
            <p className="cover-meta">{historySummary(doneToday)}</p>
            <p className="cover-meta">Nice work. Rest up and refuel.</p>
            <div className="cover-actions">
              {resumeButton}
              <Link to={`/history/session/${doneToday.id}`} className="button-like">
                See details
              </Link>
            </div>
          </section>
        ) : scheduled ? (
          <section aria-labelledby={scheduledHeading} className="stack">
            <h2 id={scheduledHeading} className="cover-big">
              {scheduled.name}
            </h2>
            <p className="cover-meta">{summary(scheduled)}</p>
            {confirmPush ? (
              <div role="alertdialog" aria-label="Push back a day?" className="stack">
                <p>
                  {scheduled.name} moves to tomorrow and the rest of the week shifts one day.{' '}
                  {restDaysLeft} rest {restDaysLeft === 1 ? 'day' : 'days'} left this week; this
                  uses 1. Resets Monday.
                </p>
                <div className="cover-actions">
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
              </div>
            ) : (
              <div className="cover-actions">
                {resumeButton}
                <button
                  type="button"
                  className={active ? undefined : 'primary'}
                  onClick={() => void start(scheduledId, scheduled.name)}
                >
                  Start <span className="visually-hidden">{scheduled.name}</span>{' '}
                  <span aria-hidden="true">›</span>
                </button>
                {canPush && (
                  <button type="button" onClick={() => setConfirmPush(true)}>
                    Can&apos;t train today
                  </button>
                )}
              </div>
            )}
          </section>
        ) : (
          <section aria-labelledby={scheduledHeading} className="stack">
            <h2 id={scheduledHeading} className="cover-big">
              Rest day
            </h2>
            {active && <div className="cover-actions">{resumeButton}</div>}
          </section>
        )}
      </div>

      {active &&
        !pending &&
        (confirmDiscard ? (
          <div
            role="alertdialog"
            aria-label={`Discard ${active.templateName}?`}
            className="card stack"
          >
            <p>
              Discard {active.templateName}? Sets logged in it won&apos;t count in History or
              progress.
            </p>
            <button
              type="button"
              className="danger"
              onClick={() =>
                void discardSession(db, active.id).then(() => setConfirmDiscard(false))
              }
            >
              Discard session
            </button>
            <button type="button" onClick={() => setConfirmDiscard(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmDiscard(true)}>
            Discard {active.templateName}
          </button>
        ))}

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

      <section aria-label="This week">
        <ol className="week-strip">
          {week.map((d) => (
            <li key={d.date} className={d.date === today ? 'today' : undefined}>
              <span aria-hidden="true">{d.letter}</span>
              <span className={`week-day ${d.state}${d.state === 'rest' ? ' tone' : ''}`}>
                {d.state === 'done' && <span aria-hidden="true">✓</span>}
              </span>
              <span className="visually-hidden">
                {d.name}: {d.state === 'done' ? 'trained' : d.state === 'rest' ? 'rest' : 'planned'}
              </span>
            </li>
          ))}
        </ol>
        <p className="legend">Solid = trained · dotted = rest day</p>
      </section>

      <dl className="stat-row">
        <div className={kcalLeft < 0 ? 'stat-cell accent' : 'stat-cell'}>
          <dt>{kcalLeft < 0 ? 'Kcal over' : 'Kcal left'}</dt>
          <dd>{Math.abs(kcalLeft).toLocaleString('en-US')}</dd>
        </div>
        <div className="stat-cell">
          <dt>Weight</dt>
          <dd>
            {weight ? (
              <>
                {weight.kg} <small>kg</small>
              </>
            ) : (
              '–'
            )}
          </dd>
        </div>
      </dl>

      <section aria-labelledby={othersHeading} className="stack">
        <h2 id={othersHeading} className="tag-heading">
          Start a different session
        </h2>
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
