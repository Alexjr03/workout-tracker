import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { listHistory, weightIncreasesBySession, type HistoryItem } from '../../db/repos/history';
import { db } from '../../db/schema';
import { formatDayLabel, toLocalDate } from '../../domain/dates';
import { monthCells, monthLabel, monthOf, shiftMonth } from '../../domain/historyStats';
import { sessionForDate, weekStart } from '../../domain/schedule';

const PAGE = 30;
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function historySummary(item: HistoryItem): string {
  if (item.cardio) return `${item.cardio.machine} · ${item.cardio.durationMin} min`;
  return `${item.sets} ${item.sets === 1 ? 'set' : 'sets'} · ${item.minutes} min`;
}

export function HistoryList({ now = new Date() }: { now?: Date }) {
  const today = toLocalDate(now);
  const [pages, setPages] = useState(1);
  const [month, setMonth] = useState(monthOf(today));

  const data = useLiveQuery(async () => {
    const [items, total, finished, increases, routine, settings] = await Promise.all([
      listHistory(db, { limit: pages * PAGE }),
      db.sessions.where('status').equals('finished').count(),
      db.sessions.where('status').equals('finished').toArray(),
      weightIncreasesBySession(db),
      db.routine.get('routine'),
      db.settings.get('settings'),
    ]);
    const inMonth = finished.filter((s) => monthOf(s.date) === month);
    const sets = await db.sets
      .where('sessionId')
      .anyOf(inMonth.map((s) => s.id))
      .count();
    return {
      items,
      total,
      increases,
      routine,
      pushBacks: settings?.pushBacks ?? [],
      trained: new Set(inMonth.map((s) => s.date)),
      month: {
        sessions: inMonth.length,
        sets,
        records: inMonth.reduce((n, s) => n + (increases.get(s.id)?.length ?? 0), 0),
      },
    };
  }, [pages, month]);
  if (!data) return null;

  // Rest days follow the schedule; push-backs are only kept for the current week.
  const isRest = (date: string) =>
    data.routine !== undefined &&
    sessionForDate(
      date,
      data.routine,
      data.pushBacks.filter((p) => weekStart(p) === weekStart(date)),
    ) === 'rest';

  return (
    <div className="stack">
      <h1>History</h1>

      <section aria-label="Month" className="stack">
        <div className="day-nav">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ‹
          </button>
          <h2 className="month-title">{monthLabel(month)}</h2>
          <button
            type="button"
            aria-label="Next month"
            disabled={month >= monthOf(today)}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </button>
        </div>
        <div className="month-grid" aria-hidden="true">
          {WEEKDAY_LETTERS.map((d, i) => (
            <span key={i} className="month-weekday">
              {d}
            </span>
          ))}
        </div>
        <ol className="month-grid">
          {monthCells(month).map((date, i) => {
            if (!date) return <li key={`blank-${i}`} aria-hidden="true" />;
            const trained = data.trained.has(date);
            const rest = !trained && date <= today && isRest(date);
            const classes = [trained ? 'done' : rest ? 'rest tone' : '', date === today && 'today']
              .filter(Boolean)
              .join(' ');
            return (
              <li key={date} className={classes || undefined}>
                <span aria-hidden="true">{Number(date.slice(8))}</span>
                <span className="visually-hidden">
                  {formatDayLabel(date)}
                  {trained ? ': trained' : rest ? ': rest day' : ''}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="legend">Solid = trained · dotted = rest day</p>
        <dl className="stat-row stat-row--3">
          <div className="stat-cell">
            <dt>Sessions</dt>
            <dd>{data.month.sessions}</dd>
          </div>
          <div className="stat-cell">
            <dt>Sets</dt>
            <dd>{data.month.sets}</dd>
          </div>
          <div className="stat-cell accent">
            <dt>Weight PRs</dt>
            <dd>{data.month.records}</dd>
          </div>
        </dl>
      </section>

      <Link to="/history/exercises" className="nav-row">
        <span className="nav-row-text">
          <span className="nav-row-title">Exercise progress</span>
        </span>
        <span className="nav-row-chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <h2 className="tag-heading">Sessions</h2>
      {data.items.length === 0 ? (
        <p className="muted">No finished sessions yet.</p>
      ) : (
        <ul className="history-list" aria-label="Sessions">
          {data.items.map((item) => {
            const [first, ...more] = data.increases.get(item.id) ?? [];
            return (
              <li key={item.id}>
                <Link to={`/history/session/${item.id}`}>
                  <span className="muted">{formatDayLabel(item.date)}</span>
                  <span className="history-name">{item.name}</span>
                  {item.swapped && <span className="tag">Swapped</span>}
                  <span className="muted">{historySummary(item)}</span>
                  {first && (
                    <span className="history-pr">
                      ↑ {first.name} {first.weight} {first.unit}
                      {more.length > 0 && ` · +${more.length} more`}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {data.items.length < data.total && (
        <button type="button" onClick={() => setPages((p) => p + 1)}>
          Show more
        </button>
      )}
    </div>
  );
}
