import { addDays, type LocalDate } from './dates';

/**
 * Mean of the entries dated in the 7 calendar days ending on `date` (inclusive), rounded to
 * 0.1 kg. Days without an entry are skipped; null when the window is empty.
 */
export function sevenDayAverage(
  entries: { date: LocalDate; kg: number }[],
  date: LocalDate,
): number | null {
  const from = addDays(date, -6);
  const inWindow = entries.filter((e) => e.date >= from && e.date <= date);
  if (inWindow.length === 0) return null;
  const mean = inWindow.reduce((sum, e) => sum + e.kg, 0) / inWindow.length;
  return Math.round(mean * 10) / 10;
}
