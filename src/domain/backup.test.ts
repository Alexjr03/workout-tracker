import { describe, expect, it } from 'vitest';
import { lastBackupText } from './backup';

const NOW = new Date(2026, 10, 23, 21, 0);

describe('lastBackupText', () => {
  it('says never when there has been no export', () => {
    expect(lastBackupText(null, NOW)).toBe('Last backup: never');
  });

  it('counts calendar days since the export', () => {
    expect(lastBackupText(new Date(2026, 10, 23, 8).toISOString(), NOW)).toBe('Last backup: today');
    expect(lastBackupText(new Date(2026, 10, 22, 23).toISOString(), NOW)).toBe(
      'Last backup: 1 day ago',
    );
    expect(lastBackupText(new Date(2026, 10, 15, 9).toISOString(), NOW)).toBe(
      'Last backup: 8 days ago',
    );
  });
});
