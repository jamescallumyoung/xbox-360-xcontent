import { readU8 } from './internal/bytes.js';
import { TRANSFER_FLAGS_OFFSET } from './internal/layout.js';

/** The transfer flags byte, and its known bits. */
export interface TransferFlags {
  /** The byte at 0x1711. The unknown bits 0x02 and 0x01 are visible only here. */
  raw: number;
  decoded: {
    /** 0x80: can be moved to another profile. */
    canMoveToProfile: boolean;
    /** 0x40: can be moved to another storage device. */
    canMoveToDevice: boolean;
    /** 0x20: can be moved, but not copied. */
    moveOnly: boolean;
    /** 0x10 */
    kinectEnabled: boolean;
    /** 0x08 */
    networkStorageDisabled: boolean;
    /** 0x04 */
    deepLinksSupported: boolean;
  };
}

/**
 * Returns the transfer flags at 0x1711: the raw byte, and each known bit.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * The bit meanings come from Velocity. Their order is widely reported but not
 * verified (spec §6.4): xenia's bitfield could be read the other way round.
 */
export function parseTransferFlags(bytes: Uint8Array): TransferFlags {
  const raw = readU8(bytes, TRANSFER_FLAGS_OFFSET);
  const isSet = (bit: number): boolean => (raw & bit) !== 0;
  return {
    raw,
    decoded: {
      canMoveToProfile: isSet(0x80),
      canMoveToDevice: isSet(0x40),
      moveOnly: isSet(0x20),
      kinectEnabled: isSet(0x10),
      networkStorageDisabled: isSet(0x08),
      deepLinksSupported: isSet(0x04),
    },
  };
}
