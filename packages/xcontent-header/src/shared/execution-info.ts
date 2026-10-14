// The execution info at 0x354-0x36B: the same fields a game's .xex carries in its
// optional header 0x40006 (spec §6.4).

import { readU32, readU8 } from './internal/bytes.js';
import {
  BASE_VERSION_OFFSET,
  DISC_COUNT_OFFSET,
  DISC_NUMBER_OFFSET,
  EXECUTABLE_TYPE_OFFSET,
  MEDIA_ID_LENGTH,
  MEDIA_ID_OFFSET,
  PLATFORM_OFFSET,
  SAVE_GAME_ID_LENGTH,
  SAVE_GAME_ID_OFFSET,
  TITLE_ID_LENGTH,
  TITLE_ID_OFFSET,
  VERSION_OFFSET,
} from './internal/layout.js';
import { toHex } from './internal/to-hex.js';

/**
 * Returns the media ID at 0x354, as 8 uppercase hex digits. It identifies a
 * particular disc or build.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseMediaId(bytes: Uint8Array): string {
  return toHex(bytes.subarray(MEDIA_ID_OFFSET, MEDIA_ID_OFFSET + MEDIA_ID_LENGTH));
}

/**
 * Returns the version at 0x358, as a number.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseVersion(bytes: Uint8Array): number {
  return readU32(bytes, VERSION_OFFSET);
}

/**
 * Returns the base version at 0x35C, as a number.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseBaseVersion(bytes: Uint8Array): number {
  return readU32(bytes, BASE_VERSION_OFFSET);
}

/**
 * Returns the Title ID the header claims, at 0x360, as 8 uppercase hex digits.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * The directory a package sits in decides its real Title ID, and headers often
 * disagree with it (spec §7.2). Some system packages store 0 here.
 */
export function parseDeclaredTitleId(bytes: Uint8Array): string {
  return toHex(bytes.subarray(TITLE_ID_OFFSET, TITLE_ID_OFFSET + TITLE_ID_LENGTH));
}

/**
 * Returns the platform byte at 0x364, as a number.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parsePlatform(bytes: Uint8Array): number {
  return readU8(bytes, PLATFORM_OFFSET);
}

/**
 * Returns the executable type byte at 0x365, as a number.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseExecutableType(bytes: Uint8Array): number {
  return readU8(bytes, EXECUTABLE_TYPE_OFFSET);
}

/**
 * Returns the disc number at 0x366, as a number.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseDiscNumber(bytes: Uint8Array): number {
  return readU8(bytes, DISC_NUMBER_OFFSET);
}

/**
 * Returns the disc count at 0x367, as a number.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseDiscCount(bytes: Uint8Array): number {
  return readU8(bytes, DISC_COUNT_OFFSET);
}

/**
 * Returns the save game ID at 0x368, as 8 uppercase hex digits.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseSaveGameId(bytes: Uint8Array): string {
  return toHex(bytes.subarray(SAVE_GAME_ID_OFFSET, SAVE_GAME_ID_OFFSET + SAVE_GAME_ID_LENGTH));
}
