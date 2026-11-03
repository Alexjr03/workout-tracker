import type { RirTarget, Settings, TemplateExercise } from '../db/types';
import { addDays, type LocalDate } from './dates';

export interface Prescription {
  sets: number;
  /** Trailing sets that may be skipped without counting as missed. */
  optionalSets: number;
  repMin: number;
  repMax: number;
  rirTarget: RirTarget;
  rampUp: boolean;
}

/**
 * What to show for an exercise on `date`. During the first `rampUpWeeks` weeks after the
 * program start: every set, with the last one optional, and ~3 reps in reserve; afterwards
 * every set required and 1–2.
 */
export function prescriptionFor(
  exercise: Pick<TemplateExercise, 'sets' | 'repMin' | 'repMax'>,
  date: LocalDate,
  settings: Pick<Settings, 'programStartDate' | 'rampUpWeeks'>,
): Prescription {
  const rampUpEnds = addDays(settings.programStartDate, settings.rampUpWeeks * 7);
  const rampUp = settings.rampUpWeeks > 0 && date < rampUpEnds;
  return {
    sets: exercise.sets,
    optionalSets: rampUp && exercise.sets > 1 ? 1 : 0,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    rirTarget: rampUp ? '~3' : '1-2',
    rampUp,
  };
}

export function rirText(target: RirTarget): string {
  return target === '~3' ? 'leave ~3 reps in reserve' : 'leave 1–2 reps in reserve';
}
