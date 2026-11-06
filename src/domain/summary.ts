import type { ExerciseDef } from '../db/types';
import { progressionSuggestion } from './progression';

interface SummaryInput {
  startedAt: string;
  finishedAt: string;
  exercises: {
    def: Pick<ExerciseDef, 'name' | 'loadBasis' | 'increment' | 'unit'>;
    prescribedSets: number;
    optionalSets: number;
    repMax: number;
    sets: { setIndex: number; weight: number; reps: number }[];
  }[];
}

export interface SessionSummary {
  setsDone: number;
  /** Required sets, plus optional ones only if they were done. */
  setsPrescribed: number;
  minutes: number;
  /** Exercises whose next session will suggest a new weight. */
  progressions: {
    name: string;
    next: number;
    loadBasis: ExerciseDef['loadBasis'];
    unit: ExerciseDef['unit'];
  }[];
}

export function sessionSummary(input: SummaryInput): SessionSummary {
  const progressions: SessionSummary['progressions'] = [];
  let setsPrescribed = 0;
  for (const e of input.exercises) {
    const next = progressionSuggestion([{ ...e, finishedAt: input.finishedAt }], e.def);
    if (next !== null)
      progressions.push({ name: e.def.name, next, loadBasis: e.def.loadBasis, unit: e.def.unit });

    const required = e.prescribedSets - e.optionalSets;
    const optionalDone = Math.min(e.prescribedSets, e.sets.length) - required;
    setsPrescribed += required + Math.max(0, optionalDone);
  }
  return {
    setsDone: input.exercises.reduce((n, e) => n + e.sets.length, 0),
    setsPrescribed,
    minutes: Math.round((Date.parse(input.finishedAt) - Date.parse(input.startedAt)) / 60_000),
    progressions,
  };
}
