import type { RirTarget, Settings, TemplateExercise } from '../db/types';
import { addDays, type LocalDate } from './dates';

export interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  rirTarget: RirTarget;
  rampUp: boolean;
}

/**
 * What to show for an exercise on `date`. During the first `rampUpWeeks` weeks after the
 * program start: one fewer set (minimum 1) and ~3 reps in reserve; afterwards 1–2.
 */
export function prescriptionFor(
  exercise: Pick<TemplateExercise, 'sets' | 'repMin' | 'repMax'>,
  date: LocalDate,
  settings: Pick<Settings, 'programStartDate' | 'rampUpWeeks'>,
): Prescription {
  const rampUpEnds = addDays(settings.programStartDate, settings.rampUpWeeks * 7);
  const rampUp = settings.rampUpWeeks > 0 && date < rampUpEnds;
  return {
    sets: rampUp ? Math.max(1, exercise.sets - 1) : exercise.sets,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    rirTarget: rampUp ? '~3' : '1-2',
    rampUp,
  };
}

export function rirText(target: RirTarget): string {
  return target === '~3' ? 'leave ~3 reps in reserve' : 'leave 1–2 reps in reserve';
}
