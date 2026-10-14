import { describe, expect, it } from 'vitest';
import { LanguageSlot } from '../language-slot.js';

describe('LanguageSlot (R1.35)', () => {
  it('maps each confirmed language to its slot index', () => {
    expect(LanguageSlot).toEqual({
      English: 0,
      Japanese: 1,
      German: 2,
      French: 3,
      Spanish: 4,
      Italian: 5,
      Korean: 6,
      TraditionalChinese: 7,
      Portuguese: 8,
      Polish: 10,
      Russian: 11,
    });
  });

  it('has no entry for slot 9, whose language is not confirmed', () => {
    expect(Object.values(LanguageSlot)).not.toContain(9);
  });
});
