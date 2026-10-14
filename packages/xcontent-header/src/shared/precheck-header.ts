import { runPrechecks } from './internal/prechecks.js';

/** The signing type a header's magic declares: `CON `, `LIVE` or `PIRS`, without the trailing space. */
export type DeclaredSigning = 'CON' | 'LIVE' | 'PIRS';

/** The two valid header sizes: 0x971A, and 0xAD0E for headers with installer metadata. */
export type HeaderSize = 0x971a | 0xad0e;

/** Why the pre-checks failed. Every API function reports these the same way. */
export type PrecheckFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number };

/** What the pre-checks found: the declared signing and header size, or the one reason they failed. */
export type PrecheckResult =
  [true, { declaredSigning: DeclaredSigning; headerSize: HeaderSize }] | [false, [PrecheckFailureReason]];

/**
 * Checks that bytes hold a whole package header, before anything else reads it.
 *
 * Needs bytes from 0x000 up to the header size stored at 0x340: 0x971A bytes when
 * that value is 0x971A, and 0xAD0E bytes when it is 0xAD0E. Reading 0xB000 bytes
 * always suffices. Bytes beyond the header are ignored.
 *
 * The checks run in order, and the first failure is returned:
 * 1. at least 4 bytes, for the magic
 * 2. a magic of `CON `, `LIVE` or `PIRS` (otherwise not a package)
 * 3. at least 0x344 bytes, to read the header size
 * 4. a header size of 0x971A or 0xAD0E
 * 5. at least as many bytes as the header size
 *
 * The magic is checked before the length, so a short file that isn't a package is
 * reported as not a package. Every API function runs these checks first. Call this
 * before any field parser in `xcontent-header/extended`: they assume it passed.
 */
export function precheckHeader(bytes: Uint8Array): PrecheckResult {
  return runPrechecks(bytes, (headerSize) => headerSize);
}
