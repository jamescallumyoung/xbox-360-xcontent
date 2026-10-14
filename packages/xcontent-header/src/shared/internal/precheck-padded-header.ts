import type { PrecheckResult } from '../precheck-header.js'
import { HEADER_SIZE_STANDARD, PADDED_LENGTH_INSTALLER, PADDED_LENGTH_STANDARD } from './layout.js'
import { runPrechecks } from './prechecks.js'

/**
 * Runs the same pre-checks as `precheckHeader`, but requires the padded header.
 *
 * Needs 0xA000 bytes when the header size stored at 0x340 is 0x971A, and 0xB000
 * bytes when it is 0xAD0E. Reading 0xB000 bytes always suffices.
 *
 * verifyHeaderAsync needs the padding because the content ID is a hash of 0x344
 * up to the end of the padded header, not just up to the header size (spec §6.3).
 */
export function precheckPaddedHeader(bytes: Uint8Array): PrecheckResult {
  return runPrechecks(bytes, headerSize =>
    headerSize === HEADER_SIZE_STANDARD ? PADDED_LENGTH_STANDARD : PADDED_LENGTH_INSTALLER)
}
