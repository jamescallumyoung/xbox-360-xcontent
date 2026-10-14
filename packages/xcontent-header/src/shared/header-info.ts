import type { HeaderSize } from './precheck-header.js';
import { readU32 } from './internal/bytes.js';
import { CONTENT_ID_LENGTH, CONTENT_ID_OFFSET, HEADER_SIZE_OFFSET } from './internal/layout.js';
import { toHex } from './internal/to-hex.js';

/**
 * Returns the content ID at 0x32C, as 40 uppercase hex digits.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * The content ID is the SHA-1 of 0x344 up to the end of the padded header (spec
 * §6.3). It doesn't cover the licences.
 */
export function parseContentId(bytes: Uint8Array): string {
  return toHex(bytes.subarray(CONTENT_ID_OFFSET, CONTENT_ID_OFFSET + CONTENT_ID_LENGTH));
}

/**
 * Returns the header size at 0x340: 0x971A, or 0xAD0E for a header with installer
 * metadata.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It's the header's length in bytes, from 0x000 (spec §6.1).
 */
export function parseHeaderSize(bytes: Uint8Array): HeaderSize {
  return readU32(bytes, HEADER_SIZE_OFFSET) as HeaderSize;
}
