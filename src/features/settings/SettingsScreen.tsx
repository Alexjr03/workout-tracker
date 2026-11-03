import { useLiveQuery } from 'dexie-react-hooks';
import { useId } from 'react';
import { db } from '../../db/schema';
import { lastBackupText } from '../../domain/backup';
import { ExportButton } from './backup/ExportButton';
import { ImportButton } from './backup/ImportButton';

// The rest of Settings (rest times, targets, routine editor) arrives in T15–T17.
export function SettingsScreen() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const backupHeading = useId();
  if (!settings) return null;

  return (
    <div className="stack">
      <h1>Settings</h1>
      <section aria-labelledby={backupHeading} className="card stack">
        <h2 id={backupHeading}>Backup</h2>
        <p className="muted">
          Everything lives only on this phone. Export a copy to Files or iCloud now and then.
        </p>
        <p>{lastBackupText(settings.lastExportAt, new Date())}</p>
        <ExportButton />
        <ImportButton />
      </section>
    </div>
  );
}
