import { describe, expect, it } from 'vitest';
import { uniqueSlug } from './slug';

describe('uniqueSlug', () => {
  it('turns a name into a kebab-case id', () => {
    expect(uniqueSlug('Hack squat', new Set())).toBe('hack-squat');
    expect(uniqueSlug('  Pec-Deck  (machine) ', new Set())).toBe('pec-deck-machine');
    expect(uniqueSlug('Façade press', new Set())).toBe('facade-press');
  });

  it('adds a numeric suffix when the id is taken', () => {
    expect(uniqueSlug('Hack squat', new Set(['hack-squat']))).toBe('hack-squat-2');
    expect(uniqueSlug('Hack squat', new Set(['hack-squat', 'hack-squat-2']))).toBe('hack-squat-3');
  });

  it('falls back when the name has no letters or digits', () => {
    expect(uniqueSlug('!!!', new Set())).toBe('exercise');
  });
});
