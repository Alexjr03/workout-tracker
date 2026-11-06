export type LiftUnit = 'lb' | 'kg';

const KG_PER_LB = 0.45359237;
// Resolution a gym can actually load: 0.25 kg microplates, 0.5 lb.
const RESOLUTION: Record<LiftUnit, number> = { kg: 0.25, lb: 0.5 };
// Typical plate / dumbbell / stack steps, for snapping a converted increment.
const STEPS: Record<LiftUnit, number[]> = {
  kg: [0.5, 1, 1.25, 2, 2.5, 5, 10],
  lb: [1, 2.5, 5, 10, 20],
};

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** A logged or suggested weight in another unit, rounded to what can be loaded. */
export function convertWeight(value: number, from: LiftUnit, to: LiftUnit): number {
  if (from === to) return value;
  const raw = to === 'kg' ? value * KG_PER_LB : value / KG_PER_LB;
  return roundTo(raw, RESOLUTION[to]);
}

/** A weight step in another unit, snapped to the nearest typical gym step. */
export function convertIncrement(value: number, from: LiftUnit, to: LiftUnit): number {
  if (from === to) return value;
  const raw = to === 'kg' ? value * KG_PER_LB : value / KG_PER_LB;
  return STEPS[to].reduce((best, step) =>
    Math.abs(step - raw) < Math.abs(best - raw) ? step : best,
  );
}
