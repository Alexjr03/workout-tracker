import { daysBetween, toLocalDate } from './dates';

/** Calendar days since the last export, or null if there was none. */
export function daysSinceExport(lastExportAt: string | null, now: Date): number | null {
  if (lastExportAt === null) return null;
  return daysBetween(toLocalDate(new Date(lastExportAt)), toLocalDate(now));
}

export function lastBackupText(lastExportAt: string | null, now: Date): string {
  const days = daysSinceExport(lastExportAt, now);
  if (days === null) return 'Last backup: never';
  if (days === 0) return 'Last backup: today';
  return `Last backup: ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
