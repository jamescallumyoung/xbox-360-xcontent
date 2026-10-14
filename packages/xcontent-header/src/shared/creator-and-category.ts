import { readU32 } from './internal/bytes.js';
import { CATEGORY_OFFSET, ONLINE_CREATOR_LENGTH, ONLINE_CREATOR_OFFSET } from './internal/layout.js';
import { toHex } from './internal/to-hex.js';

/**
 * Returns the online creator at 0x3AD, as 16 uppercase hex digits.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseOnlineCreator(bytes: Uint8Array): string {
  return toHex(bytes.subarray(ONLINE_CREATOR_OFFSET, ONLINE_CREATOR_OFFSET + ONLINE_CREATOR_LENGTH));
}

/**
 * Returns the category at 0x3B5, as a number.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseCategory(bytes: Uint8Array): number {
  return readU32(bytes, CATEGORY_OFFSET);
}
