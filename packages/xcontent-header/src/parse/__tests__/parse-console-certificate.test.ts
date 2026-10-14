import { describe, expect, it } from 'vitest';
import { manifest } from '../../__tests__/fixtures/manifest.generated.js';
import { buildHeader } from '../../__tests__/helpers/header-builder.js';
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js';
import { sha1Hex } from '../../__tests__/helpers/sha1.js';
import { parseConsoleCertificate } from '../parse-console-certificate.js';

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

describe('parseConsoleCertificate: result and pre-checks (R50.1-9)', () => {
  it('returns [true, certificate] for a CON package (R50.1, R50.3)', () => {
    const [ok, certificate] = parseConsoleCertificate(buildHeader({ magic: 'CON ' }).setU8(0x01f, 2).bytes());
    expect(ok).toBe(true);
    expect(certificate).toMatchObject({ consoleType: { raw: 2, decoded: 'retail' } });
  });

  it('returns [true, null] for LIVE and PIRS packages, which have no console certificate (R50.2)', () => {
    expect(parseConsoleCertificate(buildHeader({ magic: 'LIVE' }).bytes())).toEqual([true, null]);
    expect(parseConsoleCertificate(buildHeader({ magic: 'PIRS' }).bytes())).toEqual([true, null]);
  });

  it('returns exactly one reason when a pre-check fails (R50.1, R50.5-9)', () => {
    expect(parseConsoleCertificate(ascii('CO'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 4, got: 2 }]]);
    expect(parseConsoleCertificate(ascii('text'))).toEqual([false, [{ kind: 'not-a-package' }]]);
    expect(parseConsoleCertificate(ascii('CON '))).toEqual([
      false,
      [{ kind: 'insufficient-bytes', needed: 0x344, got: 4 }],
    ]);
    const badSize = buildHeader({ magic: 'CON ', headerSize: 0x1234 }).bytes();
    expect(parseConsoleCertificate(badSize)).toEqual([false, [{ kind: 'header-size-invalid', declared: 0x1234 }]]);
    const short = buildHeader({ magic: 'CON ' }).truncate(0x9719).bytes();
    expect(parseConsoleCertificate(short)).toEqual([
      false,
      [{ kind: 'insufficient-bytes', needed: 0x971a, got: 0x9719 }],
    ]);
  });

  it('ignores bytes beyond the header size (R50.4)', () => {
    const bytes = new Uint8Array(0x20000);
    bytes.set(buildHeader({ magic: 'CON ' }).bytes());
    expect(parseConsoleCertificate(bytes)[0]).toBe(true);
  });

  it('returns exactly the documented fields, and not the package signature (R50.14)', () => {
    const [, certificate] = parseConsoleCertificate(buildHeader({ magic: 'CON ' }).bytes());
    expect(Object.keys(certificate ?? {}).sort()).toEqual([
      'certificateDate',
      'certificateSignature',
      'consolePartNumber',
      'consoleType',
      'ownerConsoleId',
      'publicExponent',
      'publicKeyCertificateSize',
      'publicModulus',
    ]);
  });
});

describe('parseConsoleCertificate, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const expected = manifest[name];
    const [ok, certificate] = parseConsoleCertificate(loadFixture(name));
    expect(ok).toBe(true);
    if (expected.certificate === null || certificate === null || !ok) {
      expect(certificate).toBe(expected.certificate);
      return;
    }
    const { publicModulus, certificateSignature, consoleType, ...rest } = certificate;
    expect({
      ...rest,
      consoleType: consoleType.raw,
      publicModulusSha1: sha1Hex(publicModulus),
      certificateSignatureSha1: sha1Hex(certificateSignature),
    }).toEqual(expected.certificate);
  });
});
