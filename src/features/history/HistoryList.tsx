import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { listHistory, type HistoryItem } from '../../db/repos/history';
import { db } from '../../db/schema';
import { formatDayLabel } from '../../domain/dates';

const PAGE = 30;

function summary(item: HistoryItem): string {
  if (item.cardio) return `${item.cardio.machine} · ${item.cardio.durationMin} min`;
  return `${item.sets} ${item.sets === 1 ? 'set' : 'sets'} · ${item.minutes} min`;
}

export function HistoryList() {
  const [pages, setPages] = useState(1);
  const data = useLiveQuery(async () => {
    const [items, total] = await Promise.all([
      listHistory(db, { limit: pages * PAGE }),
      db.sessions.where('status').equals('finished').count(),
    ]);
    return { items, total };
  }, [pages]);
  if (!data) return null;

  return (
    <div className="stack">
      <h1>History</h1>
      <Link to="/history/exercises" className="button-like">
        Exercise progress
      </Link>
      {data.items.length === 0 ? (
        <p className="muted">No finished sessions yet.</p>
      ) : (
        <ul className="history-list" aria-label="Sessions">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link to={`/history/session/${item.id}`}>
                <span className="muted">{formatDayLabel(item.date)}</span>
                <span className="history-name">{item.name}</span>
                {item.swapped && <span className="tag">Swapped</span>}
                <span className="muted">{summary(item)}</span>
              </Link>
            </li>
          ))}
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
