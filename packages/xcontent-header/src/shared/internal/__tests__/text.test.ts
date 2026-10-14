import { describe, expect, it } from 'vitest';
import { manifest } from '../../../__tests__/fixtures/manifest.generated.js';
import { loadFixture } from '../../../__tests__/helpers/load-fixture.js';
import { decodeLatin1Field, decodeUtf16Field } from '../text.js';

/** Encodes code units big-endian into a field of `length` bytes, zero-padded. */
const field = (units: number[], length = 0x100): Uint8Array => {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  units.forEach((unit, i) => {
    view.setUint16(i * 2, unit);
  });
  return bytes;
};
const units = (text: string): number[] => Array.from(text, (c) => c.charCodeAt(0));

describe('decodeUtf16Field (R1.27-31)', () => {
  it('decodes UTF-16BE text (R1.27)', () => {
    expect(decodeUtf16Field(field(units('Halo 3')), 0, 0x100)).toBe('Halo 3');
  });

  it('decodes text inside a larger buffer, from the given offset', () => {
    const bytes = new Uint8Array(0x110);
    bytes.set(field(units('Hi')), 0x10);
    expect(decodeUtf16Field(bytes, 0x10, 0x100)).toBe('Hi');
  });

  it('ends a string at the first U+0000 (R1.28)', () => {
    expect(decodeUtf16Field(field([...units('AB'), 0, ...units('CD')]), 0, 0x100)).toBe('AB');
  });

  it('does not end a string at the character "0", whose code unit is 00 30 (R1.28)', () => {
    expect(decodeUtf16Field(field(units('Halo: 0')), 0, 0x100)).toBe('Halo: 0');
  });

  it('uses the full width when there is no U+0000: 128 units for 0x100 bytes, 64 for 0x80 (R1.28)', () => {
    expect(decodeUtf16Field(field(Array<number>(128).fill(0x41)), 0, 0x100)).toBe('A'.repeat(128));
    expect(decodeUtf16Field(field(Array<number>(64).fill(0x41), 0x80), 0, 0x80)).toBe('A'.repeat(64));
  });

  it('returns null when the first code unit is 0x0000 (R1.29)', () => {
    expect(decodeUtf16Field(field([]), 0, 0x100)).toBeNull();
    expect(decodeUtf16Field(field([0, ...units('hidden')]), 0, 0x100)).toBeNull();
  });

  it('replaces each unpaired surrogate with U+FFFD, and decodes the characters around it (R1.30)', () => {
    expect(decodeUtf16Field(field([0x41, 0xd83c, 0x42]), 0, 0x100)).toBe('A\uFFFDB');
    expect(decodeUtf16Field(field([0x41, 0xdfae, 0x42]), 0, 0x100)).toBe('A\uFFFDB');
    expect(decodeUtf16Field(field([0x41, 0x42, 0xd83c]), 0, 0x100)).toBe('AB\uFFFD');
  });

  it('keeps a valid surrogate pair as one character', () => {
    expect(decodeUtf16Field(field([0x41, 0xd83c, 0xdfae]), 0, 0x100)).toBe('A\u{1F3AE}');
  });

  it('returns strings that are always well-formed (R1.30)', () => {
    expect(decodeUtf16Field(field([0xd83c, 0xd83c, 0xdfae]), 0, 0x100)?.isWellFormed()).toBe(true);
  });

  it('keeps a leading byte-order mark, U+FEFF (R1.27)', () => {
    expect(decodeUtf16Field(field([0xfeff, ...units('Hi')]), 0, 0x100)).toBe('\uFEFFHi');
  });

  it('returns text stored as UTF-8 inside UTF-16BE exactly as decoded, without repair (R1.31)', () => {
    const bytes = loadFixture('live-svod-god-south-park-mojibake');
    const expected = manifest['live-svod-god-south-park-mojibake'].displayNames[0];
    expect(decodeUtf16Field(bytes, 0x411, 0x100)).toBe(expected);
  });
});

describe('decodeLatin1Field', () => {
  it('decodes ASCII text up to the first 0x00 byte', () => {
    const bytes = new Uint8Array([0x31, 0x31, 0x2d, 0x30, 0x36, 0x00, 0x39, 0x39]);
    expect(decodeLatin1Field(bytes, 0, 8)).toBe('11-06');
  });

  it('uses the full width when there is no 0x00 byte', () => {
    expect(decodeLatin1Field(new Uint8Array([0x41, 0x42]), 0, 2)).toBe('AB');
  });

  it('returns an empty string when the first byte is 0x00', () => {
    expect(decodeLatin1Field(new Uint8Array(4), 0, 4)).toBe('');
  });

  it("decodes a real certificate's part number and date", () => {
    const bytes = loadFixture('con-971a-mv2-xna-save');
    const certificate = manifest['con-971a-mv2-xna-save'].certificate;
    expect(decodeLatin1Field(bytes, 0x00b, 0x14)).toBe(certificate.consolePartNumber);
    expect(decodeLatin1Field(bytes, 0x020, 8)).toBe(certificate.certificateDate);
  });
});
