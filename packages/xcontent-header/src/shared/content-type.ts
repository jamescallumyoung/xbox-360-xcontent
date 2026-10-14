import { readU32 } from './internal/bytes.js'
import { CONTENT_TYPE_OFFSET } from './internal/layout.js'

/**
 * Returns the content type the header claims, at 0x344, as a number.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It's returned whether or not the content type is known; names aren't looked up.
 * The directory a package sits in decides its real content type, and headers often
 * disagree with it (spec §7.2).
 */
export function parseDeclaredContentType(bytes: Uint8Array): number {
  return readU32(bytes, CONTENT_TYPE_OFFSET)
}
