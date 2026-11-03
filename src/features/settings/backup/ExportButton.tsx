import { useState } from 'react';
import { db } from '../../../db/schema';
import { exportBackup, type ExportResult } from './exportData';

const MESSAGES: Record<ExportResult, string> = {
  shared: 'Backup exported.',
  downloaded: 'Backup exported.',
  cancelled: 'Export cancelled.',
};

export function ExportButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(MESSAGES[await exportBackup(db)]);
    } catch (error) {
      setMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="primary" disabled={busy} onClick={() => void run()}>
        Export backup
      </button>
      {message && <p role="status">{message}</p>}
    </>
  );
}
