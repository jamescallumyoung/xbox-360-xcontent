// The console certificate a CON package carries at 0x004-0x1AB (spec §6.2): the
// fields that identify the console that signed it. LIVE and PIRS packages carry a
// Microsoft signature here instead.

import { copyBytes, readU16, readU32, readU8 } from './internal/bytes.js';
import {
  CERTIFICATE_DATE_LENGTH,
  CERTIFICATE_DATE_OFFSET,
  CERTIFICATE_SIGNATURE_LENGTH,
  CERTIFICATE_SIGNATURE_OFFSET,
  CONSOLE_PART_NUMBER_LENGTH,
  CONSOLE_PART_NUMBER_OFFSET,
  CONSOLE_TYPE_OFFSET,
  OWNER_CONSOLE_ID_LENGTH,
  OWNER_CONSOLE_ID_OFFSET,
  PUBLIC_EXPONENT_OFFSET,
  PUBLIC_KEY_CERTIFICATE_SIZE_OFFSET,
  PUBLIC_MODULUS_LENGTH,
  PUBLIC_MODULUS_OFFSET,
} from './internal/layout.js';
import { decodeLatin1Field } from './internal/text.js';
import { toHex } from './internal/to-hex.js';

/** The console type byte, and what it means. */
export interface ConsoleType {
  /** The byte at 0x01F. */
  raw: number;
  /** 'devkit' for 0x01, 'retail' for 0x02, and 'unknown' for anything else. */
  decoded: 'devkit' | 'retail' | 'unknown';
}

/**
 * Returns the public key certificate size at 0x004.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the magic is `CON `. In `LIVE` and `PIRS` packages these
 * bytes are Microsoft's signature, not a certificate.
 */
export function parsePublicKeyCertificateSize(bytes: Uint8Array): number {
  return readU16(bytes, PUBLIC_KEY_CERTIFICATE_SIZE_OFFSET);
}

/**
 * Returns the ID of the console that signed the package, at 0x006, as 10 hex
 * digits.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the magic is `CON `. In `LIVE` and `PIRS` packages these
 * bytes are Microsoft's signature, not a certificate.
 *
 * It isn't necessarily the console that created the package (see
 * parseCreatorConsoleId).
 */
export function parseOwnerConsoleId(bytes: Uint8Array): string {
  return toHex(bytes.subarray(OWNER_CONSOLE_ID_OFFSET, OWNER_CONSOLE_ID_OFFSET + OWNER_CONSOLE_ID_LENGTH));
}

/**
 * Returns the console's part number at 0x00B, as text up to the first 0x00 byte.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the magic is `CON `. In `LIVE` and `PIRS` packages these
 * bytes are Microsoft's signature, not a certificate.
 */
export function parseConsolePartNumber(bytes: Uint8Array): string {
  return decodeLatin1Field(bytes, CONSOLE_PART_NUMBER_OFFSET, CONSOLE_PART_NUMBER_LENGTH);
}

/**
 * Returns the console type at 0x01F: the raw byte, and whether it means a devkit
 * or a retail console.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the magic is `CON `. In `LIVE` and `PIRS` packages these
 * bytes are Microsoft's signature, not a certificate.
 */
export function parseConsoleType(bytes: Uint8Array): ConsoleType {
  const raw = readU8(bytes, CONSOLE_TYPE_OFFSET);
  return { raw, decoded: raw === 0x01 ? 'devkit' : raw === 0x02 ? 'retail' : 'unknown' };
}

/**
 * Returns the certificate date at 0x020, as text up to the first 0x00 byte.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the magic is `CON `. In `LIVE` and `PIRS` packages these
 * bytes are Microsoft's signature, not a certificate.
 *
 * It's returned as stored, never parsed into a date: real values look like
 * `11-06-09`, but whether that's month-day-year or day-month-year, which century,
 * and which time zone are all unknown (spec §6.2, "The certificate date field").
 */
export function parseCertificateDate(bytes: Uint8Array): string {
  return decodeLatin1Field(bytes, CERTIFICATE_DATE_OFFSET, CERTIFICATE_DATE_LENGTH);
}

/**
 * Returns the public exponent at 0x028.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the magic is `CON `. In `LIVE` and `PIRS` packages these
 * bytes are Microsoft's signature, not a certificate.
 */
export function parsePublicExponent(bytes: Uint8Array): number {
  return readU32(bytes, PUBLIC_EXPONENT_OFFSET);
}

/**
 * Returns a copy of the 0x80-byte public modulus at 0x02C.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the magic is `CON `. In `LIVE` and `PIRS` packages these
 * bytes are Microsoft's signature, not a certificate.
 */
export function parsePublicModulus(bytes: Uint8Array): Uint8Array {
  return copyBytes(bytes, PUBLIC_MODULUS_OFFSET, PUBLIC_MODULUS_LENGTH);
}

/**
 * Returns a copy of the 0x100-byte certificate signature at 0x0AC, made by
 * Microsoft.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the magic is `CON `. In `LIVE` and `PIRS` packages these
 * bytes are Microsoft's signature, not a certificate.
 *
 * It isn't verified. This is the certificate's signature, not the package's (see
 * isSignatureEmpty).
 */
export function parseCertificateSignature(bytes: Uint8Array): Uint8Array {
  return copyBytes(bytes, CERTIFICATE_SIGNATURE_OFFSET, CERTIFICATE_SIGNATURE_LENGTH);
}
