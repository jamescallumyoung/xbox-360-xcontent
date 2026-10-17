import { describe, expect, it } from 'vitest';
import { removalRisk } from '../removal-check.js';
import { pkg } from './helpers/builders.js';

describe('removalRisk', () => {
  const drive = pkg({ contentId: '11'.repeat(20) });

  it('is not-in-vault without a vault copy (R1.1)', () => {
    expect(removalRisk(undefined, drive)).toBe('not-in-vault');
  });

  it('is mismatch when either copy is corrupt, even with equal content IDs (R1.2)', () => {
    expect(removalRisk({ ...drive, corrupt: true }, drive)).toBe('mismatch');
    expect(removalRisk(drive, { ...drive, corrupt: true })).toBe('mismatch');
  });

  it('is mismatch when the content IDs are missing (R1.2)', () => {
    expect(removalRisk({ ...drive, contentId: null }, { ...drive, contentId: null })).toBe('mismatch');
  });

  it('is mismatch when the content IDs differ (R1.3)', () => {
    expect(removalRisk({ ...drive, contentId: '22'.repeat(20) }, drive)).toBe('mismatch');
  });

  it('is none when the content IDs match (R1.4)', () => {
    expect(removalRisk({ ...drive }, drive)).toBe('none');
  });
});
