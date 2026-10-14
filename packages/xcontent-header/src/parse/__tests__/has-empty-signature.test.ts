import { describe, expect, it } from 'vitest';
import { manifest } from '../../__tests__/fixtures/manifest.generated.js';
import { buildHeader } from '../../__tests__/helpers/header-builder.js';
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js';
import { hasEmptySignature } from '../has-empty-signature.js';

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

describe('hasEmptySignature (R51.1-8)', () => {
  it('returns [true, true] when the check runs and the signature is empty (R51.1)', () => {
    expect(hasEmptySignature(buildHeader({ magic: 'LIVE' }).bytes())).toEqual([true, true]);
  });

  it('returns [true, false] when the check runs and the signature is not empty (R51.2)', () => {
    expect(hasEmptySignature(buildHeader({ magic: 'LIVE' }).setU8(0x004, 1).bytes())).toEqual([true, false]);
  });

  it('returns exactly one reason when a pre-check fails (R51.1, R51.4-8)', () => {
    expect(hasEmptySignature(ascii('LI'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 4, got: 2 }]]);
    expect(hasEmptySignature(ascii('text'))).toEqual([false, [{ kind: 'not-a-package' }]]);
    expect(hasEmptySignature(ascii('PIRS'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0x344, got: 4 }]]);
    const badSize = buildHeader({ magic: 'LIVE', headerSize: 0x1234 }).bytes();
    expect(hasEmptySignature(badSize)).toEqual([false, [{ kind: 'header-size-invalid', declared: 0x1234 }]]);
    const short = buildHeader({ magic: 'LIVE' }).truncate(0x1000).bytes();
    expect(hasEmptySignature(short)).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0xad0e, got: 0x1000 }]]);
  });

  it('ignores bytes beyond the header size (R51.3)', () => {
    const bytes = new Uint8Array(0x20000);
    bytes.set(buildHeader({ magic: 'LIVE' }).bytes());
    bytes.fill(0xff, 0xb000);
    expect(hasEmptySignature(bytes)).toEqual([true, true]);
  });
});

describe('hasEmptySignature, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    expect(hasEmptySignature(loadFixture(name))).toEqual([true, manifest[name].signatureAllZero]);
  });
});
