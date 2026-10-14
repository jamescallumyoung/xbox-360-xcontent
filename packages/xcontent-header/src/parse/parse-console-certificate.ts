import {
  type ConsoleType,
  parseCertificateDate,
  parseCertificateSignature,
  parseConsolePartNumber,
  parseConsoleType,
  parseOwnerConsoleId,
  parsePublicExponent,
  parsePublicKeyCertificateSize,
  parsePublicModulus,
} from '../shared/console-certificate.js';
import { type PrecheckFailureReason, precheckHeader } from '../shared/precheck-header.js';

/** The certificate of the console that signed a CON package (spec §6.2). */
export interface ConsoleCertificate {
  publicKeyCertificateSize: number;
  /** The console that signed the package, as 10 hex digits. */
  ownerConsoleId: string;
  consolePartNumber: string;
  consoleType: ConsoleType;
  /** As stored, such as `11-06-09`. Never parsed: its format is unknown. */
  certificateDate: string;
  publicExponent: number;
  /** 0x80 bytes. */
  publicModulus: Uint8Array;
  /** Microsoft's 0x100-byte signature of the certificate. Not verified. */
  certificateSignature: Uint8Array;
}

/** Why parseConsoleCertificate failed: always a pre-check. */
export type ParseConsoleCertificateFailureReason = PrecheckFailureReason;

/** The certificate (null for LIVE and PIRS), or the one reason it couldn't be parsed. */
export type ParseConsoleCertificateResult =
  [true, ConsoleCertificate | null] | [false, ParseConsoleCertificateFailureReason[]];

/**
 * Reads the certificate of the console that signed a `CON` package, or returns
 * null for `LIVE` and `PIRS` packages, which have a Microsoft signature instead.
 *
 * Needs bytes from 0x000 up to the header size stored at 0x340: 0x971A bytes when
 * that value is 0x971A, and 0xAD0E bytes when it is 0xAD0E. Reading 0xB000 bytes
 * always suffices. Bytes beyond the header are ignored.
 *
 * Returns `[true, certificate]` (null for `LIVE` and `PIRS`), or `[false, [reason]]`
 * when a pre-check fails. It never throws on bad input.
 *
 * It doesn't verify the certificate or the package's signature, and doesn't return
 * the package signature (see hasEmptySignature).
 */
export function parseConsoleCertificate(bytes: Uint8Array): ParseConsoleCertificateResult {
  const [ok, precheck] = precheckHeader(bytes);
  if (!ok) return [false, precheck];
  if (precheck.declaredSigning !== 'CON') return [true, null];

  return [
    true,
    {
      publicKeyCertificateSize: parsePublicKeyCertificateSize(bytes),
      ownerConsoleId: parseOwnerConsoleId(bytes),
      consolePartNumber: parseConsolePartNumber(bytes),
      consoleType: parseConsoleType(bytes),
      certificateDate: parseCertificateDate(bytes),
      publicExponent: parsePublicExponent(bytes),
      publicModulus: parsePublicModulus(bytes),
      certificateSignature: parseCertificateSignature(bytes),
    },
  ];
}
