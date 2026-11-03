import { useId, useState } from 'react';
import { db } from '../../../db/schema';
import { BackupError, parseBackup, restoreBackup, type BackupCounts } from './importData';
import type { ValidBackup } from './schemas';

function describeCounts(c: BackupCounts): string {
  return `${c.sessions} sessions, ${c.sets} sets, ${c.cardio} cardio, ${c.bodyWeight} body weight, ${c.food} food entries`;
}

const errorText = (error: unknown) =>
  error instanceof BackupError
    ? error.message
    : `Import failed: ${error instanceof Error ? error.message : String(error)}`;

/** Pick a backup file, preview what's in it, and replace all data only after confirming. */
export function ImportButton() {
  const inputId = useId();
  const [pending, setPending] = useState<{ backup: ValidBackup; counts: BackupCounts } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      setPending(parseBackup(await file.text()));
    } catch (error) {
      setMessage(errorText(error));
    }
  }

  async function restore() {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(db, pending.backup);
      setMessage('Backup restored.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setPending(null);
      setBusy(false);
    }
  }

  return (
    <>
      <label htmlFor={inputId} className="button-like">
        Import backup
      </label>
      <input
        id={inputId}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = ''; // picking the same file again still fires
        }}
      />
      {pending && (
        <div role="alertdialog" aria-label="Import backup?" className="card stack">
          <p>This backup has {describeCounts(pending.counts)}.</p>
          <p>
            <strong>Replace all data on this device?</strong> What's on the phone now will be gone.
          </p>
          <button type="button" className="danger" disabled={busy} onClick={() => void restore()}>
            Replace all data
          </button>
          <button type="button" disabled={busy} onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}
