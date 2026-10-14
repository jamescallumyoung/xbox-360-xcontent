import { describe, expect, it } from 'vitest';
import { manifest } from '../../__tests__/fixtures/manifest.generated.js';
import { buildHeader } from '../../__tests__/helpers/header-builder.js';
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js';
import { type Restrictions, parseRestrictions } from '../parse-restrictions.js';

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

/** Returns the restrictions, failing the test if parsing failed. */
const parsed = (bytes: Uint8Array): Restrictions => {
  const [ok, value] = parseRestrictions(bytes);
  if (!ok) throw new Error(`parseRestrictions failed: ${JSON.stringify(value)}`);
  return value;
};

describe('parseRestrictions: result and pre-checks (R4.1-9)', () => {
  it('returns [true, restrictions] on success (R4.1)', () => {
    const [ok, restrictions] = parseRestrictions(buildHeader({ magic: 'LIVE' }).bytes());
    expect(ok).toBe(true);
    expect(restrictions).toHaveProperty('licences');
  });

  it('returns exactly one reason when a pre-check fails (R4.1, R4.5-9)', () => {
    expect(parseRestrictions(ascii('LIV'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 4, got: 3 }]]);
    expect(parseRestrictions(ascii('text'))).toEqual([false, [{ kind: 'not-a-package' }]]);
    expect(parseRestrictions(ascii('LIVE'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0x344, got: 4 }]]);
    const badSize = buildHeader({ magic: 'LIVE', headerSize: 0x1234 }).bytes();
    expect(parseRestrictions(badSize)).toEqual([false, [{ kind: 'header-size-invalid', declared: 0x1234 }]]);
    const short = buildHeader({ magic: 'LIVE' }).truncate(0xad0d).bytes();
    expect(parseRestrictions(short)).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0xad0e, got: 0xad0d }]]);
  });

  it('always succeeds once the pre-checks pass, whatever the values (R4.2)', () => {
    const bytes = buildHeader({ magic: 'LIVE' })
      .setBytes(0x22c, new Array<number>(0x100).fill(0xff))
      .setU8(0x1711, 0xff)
      .bytes();
    expect(parseRestrictions(bytes)[0]).toBe(true);
  });

  it('works the same for CON, LIVE and PIRS packages (R4.3)', () => {
    for (const magic of ['CON ', 'LIVE', 'PIRS']) {
      const bytes = buildHeader({ magic }).setU64(0x371, 0x0123456789abcdefn).bytes();
      expect(parsed(bytes).profileId).toBe('0123456789ABCDEF');
    }
  });

  it('ignores bytes beyond the header size (R4.4)', () => {
    const bytes = new Uint8Array(0x20000);
    bytes.set(buildHeader({ magic: 'LIVE' }).bytes());
    bytes.fill(0xff, 0xb000);
    expect(parseRestrictions(bytes)[0]).toBe(true);
  });
});

describe('parseRestrictions: values', () => {
  it('returns exactly the documented properties, as facts rather than verdicts (R4.22)', () => {
    expect(Object.keys(parsed(buildHeader({ magic: 'LIVE' }).bytes())).sort()).toEqual([
      'creatorConsoleId',
      'deviceId',
      'licences',
      'profileId',
      'transferFlags',
    ]);
  });
});

describe('parseRestrictions, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const expected = manifest[name];
    const restrictions = parsed(loadFixture(name));
    expect(restrictions.licences.map((licence) => licence.licenseeData)).toEqual(
      expected.licences.map((licence) => licence.licenseeData),
    );
    expect(restrictions.transferFlags.raw).toBe(expected.transferFlags);
    expect(restrictions.creatorConsoleId).toBe(expected.creatorConsoleId);
    expect(restrictions.profileId).toBe(expected.profileId);
    expect(restrictions.deviceId).toBe(expected.deviceId);
  });
});
