import { describe, expect, it } from 'vitest';
import { manifest } from '../../__tests__/fixtures/manifest.generated.js';
import { buildHeader } from '../../__tests__/helpers/header-builder.js';
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js';
import { sha1Hex } from '../../__tests__/helpers/sha1.js';
import {
  parseCertificateDate,
  parseCertificateSignature,
  parseConsolePartNumber,
  parseConsoleType,
  parseOwnerConsoleId,
  parsePublicExponent,
  parsePublicKeyCertificateSize,
  parsePublicModulus,
} from '../console-certificate.js';
import { isSignatureEmpty } from '../signature.js';

const con = () => buildHeader({ magic: 'CON ' });
const ascii = (text: string): number[] => Array.from(text, (c) => c.charCodeAt(0));

describe('console certificate fields (R50.3, R50.10-13)', () => {
  it('reads the public key certificate size at 0x004 and the public exponent at 0x028', () => {
    const bytes = con().setU16(0x004, 0x1a8).setU32(0x028, 0x10001).bytes();
    expect(parsePublicKeyCertificateSize(bytes)).toBe(0x1a8);
    expect(parsePublicExponent(bytes)).toBe(0x10001);
  });

  it('returns the owner console ID at 0x006 as 10 hex digits, keeping leading zeros (R50.10)', () => {
    expect(parseOwnerConsoleId(con().setBytes(0x006, [0x00, 0x23, 0x45, 0x67, 0x89]).bytes())).toBe('0023456789');
  });

  it('returns the part number at 0x00B as text, up to the first 0x00 byte', () => {
    expect(parseConsolePartNumber(con().setBytes(0x00b, ascii('X850764-001')).bytes())).toBe('X850764-001');
  });

  it('uses the full 0x14 bytes of the part number when there is no 0x00 byte', () => {
    expect(
      parseConsolePartNumber(
        con()
          .setBytes(0x00b, ascii('A'.repeat(0x14)))
          .bytes(),
      ),
    ).toBe('A'.repeat(0x14));
  });

  it.each([
    [0x01, 'devkit'],
    [0x02, 'retail'],
    [0x00, 'unknown'],
    [0x05, 'unknown'],
  ])('decodes console type %i as %s, keeping the raw byte (R50.11)', (raw, decoded) => {
    expect(parseConsoleType(con().setU8(0x01f, raw).bytes())).toEqual({ raw, decoded });
  });

  it('returns the certificate date as text, without parsing it as a date (R50.13)', () => {
    expect(parseCertificateDate(con().setBytes(0x020, ascii('11-06-09')).bytes())).toBe('11-06-09');
    expect(parseCertificateDate(con().setBytes(0x020, ascii('not-date')).bytes())).toBe('not-date');
  });

  it('ends the certificate date at the first 0x00 byte (R50.13)', () => {
    expect(
      parseCertificateDate(
        con()
          .setBytes(0x020, [...ascii('11-06'), 0, ...ascii('xy')])
          .bytes(),
      ),
    ).toBe('11-06');
  });

  it('returns the 0x80-byte public modulus and 0x100-byte certificate signature as copies (R50.12)', () => {
    const bytes = con()
      .setBytes(0x02c, new Array<number>(0x80).fill(0x11))
      .setBytes(0x0ac, new Array<number>(0x100).fill(0x22))
      .bytes();
    const modulus = parsePublicModulus(bytes);
    const signature = parseCertificateSignature(bytes);
    expect(modulus).toHaveLength(0x80);
    expect(signature).toHaveLength(0x100);
    expect(modulus.every((b) => b === 0x11)).toBe(true);
    expect(signature.every((b) => b === 0x22)).toBe(true);
    bytes.fill(0);
    expect(modulus[0]).toBe(0x11);
    expect(signature[0]).toBe(0x22);
  });
});

describe('isSignatureEmpty (R51.9-12)', () => {
  it('checks the 0x100 bytes from 0x004 for LIVE and PIRS (R51.9)', () => {
    for (const magic of ['LIVE', 'PIRS']) {
      expect(isSignatureEmpty(buildHeader({ magic }).bytes())).toBe(true);
      expect(isSignatureEmpty(buildHeader({ magic }).setU8(0x004, 1).bytes())).toBe(false);
      expect(isSignatureEmpty(buildHeader({ magic }).setU8(0x103, 1).bytes())).toBe(false);
    }
  });

  it('ignores the padding after a LIVE or PIRS signature, 0x104-0x22B (R51.12)', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setBytes(0x104, new Array<number>(0x128).fill(0xff)).bytes();
    expect(isSignatureEmpty(bytes)).toBe(true);
  });

  it('checks only the 0x80-byte package signature from 0x1AC for CON (R51.10)', () => {
    expect(isSignatureEmpty(con().bytes())).toBe(true);
    expect(isSignatureEmpty(con().setU8(0x1ac, 1).bytes())).toBe(false);
    expect(isSignatureEmpty(con().setU8(0x22b, 1).bytes())).toBe(false);
  });

  it('ignores the certificate before a CON package signature (R51.10)', () => {
    const bytes = con().setBytes(0x004, new Array<number>(0x1a8).fill(0xff)).bytes();
    expect(isSignatureEmpty(bytes)).toBe(true);
  });

  it("is false for any non-zero signature, such as an unlocker's marker (R51.11)", () => {
    const marker = ascii('ByromWasHereUnlockingYourGODGame');
    const bytes = buildHeader({ magic: 'LIVE' })
      .setBytes(0x004, [...marker, ...marker, ...marker, ...marker, ...marker, ...marker, ...marker, ...marker])
      .bytes();
    expect(isSignatureEmpty(bytes)).toBe(false);
  });
});

describe('signature fields, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const bytes = loadFixture(name);
    const expected = manifest[name];
    expect(isSignatureEmpty(bytes)).toBe(expected.signatureAllZero);
    if (expected.certificate === null) return;
    expect({
      publicKeyCertificateSize: parsePublicKeyCertificateSize(bytes),
      ownerConsoleId: parseOwnerConsoleId(bytes),
      consolePartNumber: parseConsolePartNumber(bytes),
      consoleType: parseConsoleType(bytes).raw,
      certificateDate: parseCertificateDate(bytes),
      publicExponent: parsePublicExponent(bytes),
      publicModulusSha1: sha1Hex(parsePublicModulus(bytes)),
      certificateSignatureSha1: sha1Hex(parseCertificateSignature(bytes)),
    }).toEqual(expected.certificate);
  });

  it("finds the tool-made GOD's empty signature, and the anonymised CON signatures not empty", () => {
    expect(isSignatureEmpty(loadFixture('live-svod-god-empty-signature'))).toBe(true);
    expect(isSignatureEmpty(loadFixture('con-971a-mv2-xna-save'))).toBe(false);
  });
});
