// Tests for checking and copying a PackageLocation.
// Function design doc: package-wide rules 4, 6 and 7.

import { describe, expect, it } from 'vitest';
import type { PackageLocation } from '../../types.js';
import { checkLocation, isValidEntryName } from '../location.js';

const valid: PackageLocation = {
  partition: '0000000000000000',
  titleId: '4D5307E6',
  contentType: '00007000',
  packageName: 'ABC',
};

describe('checkLocation', () => {
  it('rule 7: accepts a valid location', () => {
    expect(checkLocation(valid)).toEqual([true, valid]);
  });

  it('rule 7.1: accepts a profile partition and every hex digit', () => {
    const location = { ...valid, partition: 'E812CECF9EA2AF5F', titleId: '0123ABCD', contentType: '89EF0000' };
    expect(checkLocation(location)).toEqual([true, location]);
  });

  it.each([
    ['partition', 'e812cecf9ea2af5f'],
    ['partition', '000000000000000'],
    ['partition', '00000000000000000'],
    ['partition', '000000000000000G'],
    ['titleId', '4d5307e6'],
    ['titleId', '4D5307E'],
    ['titleId', ' 4D5307E6'],
    ['contentType', '00007000 '],
    ['contentType', '0x007000'],
    ['contentType', ''],
  ] as const)('rule 7.1: rejects %s %j, lowercase included, without converting it', (field, value) => {
    expect(checkLocation({ ...valid, [field]: value })).toEqual([false, [{ kind: 'invalid-location', field, value }]]);
  });

  it.each(['', '.', '..', 'a/b', 'a\\b', '/'])('rule 7.2: rejects packageName %j', (packageName) => {
    expect(checkLocation({ ...valid, packageName })).toEqual([
      false,
      [{ kind: 'invalid-location', field: 'packageName', value: packageName }],
    ]);
  });

  it.each([
    'abc',
    'tu00000002_00000000',
    'E42409217241BEFFDAE1EFBA10F7DA460283CFB358',
    'C5Data.xml',
    'creep ',
    'a.b(c)[d]^$',
    'x'.repeat(300),
    '...',
  ])("rule 7.2: accepts packageName %j, which needn't follow FATX rules", (packageName) => {
    expect(checkLocation({ ...valid, packageName })[0]).toBe(true);
  });

  it('rule 4: reports every invalid field together', () => {
    const [ok, reasons] = checkLocation({ partition: 'x', titleId: 'y', contentType: 'z', packageName: '' });
    expect(ok).toBe(false);
    expect(reasons).toHaveLength(4);
    expect(reasons).toEqual(
      expect.arrayContaining([
        { kind: 'invalid-location', field: 'partition', value: 'x' },
        { kind: 'invalid-location', field: 'titleId', value: 'y' },
        { kind: 'invalid-location', field: 'contentType', value: 'z' },
        { kind: 'invalid-location', field: 'packageName', value: '' },
      ]),
    );
  });

  it("rule 6: returns a copy, so later changes to the caller's object have no effect", () => {
    const location = { ...valid };
    const [ok, copy] = checkLocation(location);
    expect(ok).toBe(true);
    location.packageName = 'changed';
    expect(copy).toEqual(valid);
    expect(copy).not.toBe(location);
  });

  it('rule 6: reads each field once', () => {
    let reads = 0;
    const location = {
      ...valid,
      get packageName() {
        reads++;
        return reads === 1 ? 'ABC' : '../escape';
      },
    };
    expect(checkLocation(location)).toEqual([true, valid]);
    expect(reads).toBe(1);
  });

  it("rule 7: rejects fields that aren't strings, from JavaScript callers", () => {
    const location = { ...valid, titleId: 0x4d5307e6 } as unknown as PackageLocation;
    expect(checkLocation(location)).toEqual([
      false,
      [{ kind: 'invalid-location', field: 'titleId', value: String(0x4d5307e6) }],
    ]);
  });

  it("rule 7: rejects a location that isn't an object, field by field", () => {
    const [ok, reasons] = checkLocation(null as unknown as PackageLocation);
    expect(ok).toBe(false);
    expect(reasons).toHaveLength(4);
  });
});

describe('isValidEntryName', () => {
  it('rule 7.2: accepts names the File System Access API accepts', () => {
    expect(isValidEntryName('Data0000')).toBe(true);
    expect(isValidEntryName('._ABC')).toBe(true);
  });

  it.each(['', '.', '..', 'a/b', 'a\\b'])('rule 7.2: rejects %j', (name) => {
    expect(isValidEntryName(name)).toBe(false);
  });
});
