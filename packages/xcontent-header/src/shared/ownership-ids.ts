// The IDs that tie a package to the console that created it, a profile and a
// storage device (spec §6.4).

import {
  CREATOR_CONSOLE_ID_LENGTH,
  CREATOR_CONSOLE_ID_OFFSET,
  DEVICE_ID_LENGTH,
  DEVICE_ID_OFFSET,
  PROFILE_ID_LENGTH,
  PROFILE_ID_OFFSET,
} from './internal/layout.js';
import { toHex } from './internal/to-hex.js';

/**
 * Returns the ID of the console that created the package, at 0x36C, as 10 hex
 * digits.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It isn't the console that signed it: that's the certificate's owner console ID.
 */
export function parseCreatorConsoleId(bytes: Uint8Array): string {
  return toHex(bytes.subarray(CREATOR_CONSOLE_ID_OFFSET, CREATOR_CONSOLE_ID_OFFSET + CREATOR_CONSOLE_ID_LENGTH));
}

/**
 * Returns the ID of the profile that owns the package, at 0x371, as 16 hex
 * digits. All zeros means no owning profile.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * The partition a package is stored in decides its owner; this is only a
 * cross-check (spec §7.2).
 */
export function parseProfileId(bytes: Uint8Array): string {
  return toHex(bytes.subarray(PROFILE_ID_OFFSET, PROFILE_ID_OFFSET + PROFILE_ID_LENGTH));
}

/**
 * Returns the ID of the storage device the package is tied to, at 0x3FD, as 40 hex
 * digits.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 */
export function parseDeviceId(bytes: Uint8Array): string {
  return toHex(bytes.subarray(DEVICE_ID_OFFSET, DEVICE_ID_OFFSET + DEVICE_ID_LENGTH));
}
