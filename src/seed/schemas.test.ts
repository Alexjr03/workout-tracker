import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import exerciseDefaultsJson from './exerciseDefaults.json';
import routineJson from './routine.json';
import videosJson from './videos.json';
import { exerciseDefaultsSchema, routineSeedSchema } from './schemas';

function appendixA(): unknown {
  const spec = readFileSync('SPEC.md', 'utf8');
  const appendix = spec.slice(spec.indexOf('## Appendix A'));
  const block = /```json\r?\n([\s\S]*?)```/.exec(appendix);
  if (!block?.[1]) throw new Error('Appendix A JSON block not found in SPEC.md');
  return JSON.parse(block[1]);
}

const clone = <T>(value: T): T => structuredClone(value);

describe('routine.json', () => {
  it('matches SPEC Appendix A exactly', () => {
    expect(routineJson).toEqual(appendixA());
  });

  it('passes the routine schema', () => {
    expect(routineSeedSchema.safeParse(routineJson).success).toBe(true);
  });
});

describe('exerciseDefaults.json', () => {
  it('passes the defaults schema', () => {
    expect(exerciseDefaultsSchema.safeParse(exerciseDefaultsJson).success).toBe(true);
  });

  it('covers every exercise in the routine, and nothing else', () => {
    const routine = routineSeedSchema.parse(routineJson);
    const ids = new Set(
      Object.values(routine.sessions).flatMap((s) =>
        'exercises' in s ? s.exercises.map((e) => e.id) : [],
      ),
    );
    expect(Object.keys(exerciseDefaultsJson).sort()).toEqual([...ids].sort());
  });
});

describe('videos.json', () => {
  it('has a valid YouTube video id for every seed exercise', () => {
    expect(Object.keys(videosJson).sort()).toEqual(Object.keys(exerciseDefaultsJson).sort());
    for (const id of Object.values(videosJson)) expect(id).toMatch(/^[\w-]{11}$/);
  });
});

describe('routineSeedSchema rejects', () => {
  it('repMin above repMax', () => {
    const bad = clone(routineJson);
    const first = bad.sessions['upper-a'].exercises[0];
    if (!first) throw new Error('fixture');
    first.repMin = 12;
    expect(routineSeedSchema.safeParse(bad).success).toBe(false);
  });

  it('a schedule entry that names no session', () => {
    const bad = clone(routineJson);
    bad.schedule.monday = 'upper-z';
    expect(routineSeedSchema.safeParse(bad).success).toBe(false);
  });

  it('one exercise id with two different names or types', () => {
    const bad = clone(routineJson);
    const raise = bad.sessions['upper-b'].exercises.find((e) => e.id === 'lateral-raise');
    if (!raise) throw new Error('fixture');
    raise.type = 'compound';
    expect(routineSeedSchema.safeParse(bad).success).toBe(false);
  });

  it('zero sets', () => {
    const bad = clone(routineJson);
    const first = bad.sessions.legs.exercises[0];
    if (!first) throw new Error('fixture');
    first.sets = 0;
    expect(routineSeedSchema.safeParse(bad).success).toBe(false);
  });
});

describe('exerciseDefaultsSchema rejects', () => {
  it('a zero increment or unknown load basis', () => {
    expect(
      exerciseDefaultsSchema.safeParse({ x: { loadBasis: 'total', increment: 0 } }).success,
    ).toBe(false);
    expect(
      exerciseDefaultsSchema.safeParse({ x: { loadBasis: 'per-arm', increment: 5 } }).success,
    ).toBe(false);
  });
});
