import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { db } from '../../db/schema';
import { daysSinceExport } from '../../domain/backup';

const NUDGE_AFTER_DAYS = 7;

/** Reminder on Today when there has never been a backup, or the last one is over a week old. */
export function BackupNudge({ now = new Date() }: { now?: Date }) {
  const lastExportAt = useLiveQuery(async () => (await db.settings.get('settings'))?.lastExportAt);
  const [dismissed, setDismissed] = useState(false);
  if (lastExportAt === undefined || dismissed) return null;

  const days = daysSinceExport(lastExportAt, now);
  if (days !== null && days <= NUDGE_AFTER_DAYS) return null;

  return (
    <section className="card stack" aria-label="Backup reminder">
      <p>{days === null ? 'No backup yet.' : `Last backup was ${days} days ago.`}</p>
      <p className="muted">Your data lives only on this phone.</p>
      <div className="row">
        <Link to="/settings" className="button-like">
          Back up now
        </Link>
        <button type="button" onClick={() => setDismissed(true)}>
          Not now
        </button>
      </div>
    </section>
  );
}
