import type { ExerciseDef } from '../db/types';
import { progressionSuggestion } from './progression';

interface SummaryInput {
  startedAt: string;
  finishedAt: string;
  exercises: {
    def: Pick<ExerciseDef, 'name' | 'loadBasis' | 'increment'>;
    prescribedSets: number;
    repMax: number;
    sets: { setIndex: number; weight: number; reps: number }[];
  }[];
}

export interface SessionSummary {
  setsDone: number;
  setsPrescribed: number;
  minutes: number;
  /** Exercises whose next session will suggest a new weight. */
  progressions: { name: string; next: number; loadBasis: ExerciseDef['loadBasis'] }[];
}

export function sessionSummary(input: SummaryInput): SessionSummary {
  const progressions: SessionSummary['progressions'] = [];
  for (const e of input.exercises) {
    const next = progressionSuggestion(
      [
        {
          finishedAt: input.finishedAt,
          prescribedSets: e.prescribedSets,
          repMax: e.repMax,
          sets: e.sets,
        },
      ],
      e.def,
    );
    if (next !== null) progressions.push({ name: e.def.name, next, loadBasis: e.def.loadBasis });
  }
  return {
    setsDone: input.exercises.reduce((n, e) => n + e.sets.length, 0),
    setsPrescribed: input.exercises.reduce((n, e) => n + e.prescribedSets, 0),
    minutes: Math.round((Date.parse(input.finishedAt) - Date.parse(input.startedAt)) / 60_000),
    progressions,
  };
}
