import { readU16, readU32 } from './internal/bytes.js';
import { LICENCE_COUNT, LICENCE_LENGTH, LICENCES_OFFSET } from './internal/layout.js';
import { toHex } from './internal/to-hex.js';

/** What a licensee type means (spec §6.3, from Velocity). 'unknown' is any undocumented type. */
export type LicenseeTypeName =
  | 'unrestricted'
  | 'xboxLiveAccount'
  | 'windowsLiveAccount'
  | 'console'
  | 'mediaFlags'
  | 'keyvaultPrivilege'
  | 'hypervisorFlags'
  | 'userPrivilege'
  | 'unused'
  | 'unknown';

/** One of the header's 16 licence entries. */
export interface Licence {
  /** The entry's position, 0-15. */
  index: number;
  /** The top 16 bits of the licensee ID, and what they mean. */
  licenseeType: { raw: number; decoded: LicenseeTypeName };
  /** The low 48 bits of the licensee ID, as 12 hex digits: for example an XUID or a console ID. */
  licenseeData: string;
  /** The licence bits. Their meaning isn't confirmed, so they aren't decoded. */
  bits: number;
  /** The licence flags. Their meaning is unknown, so they aren't decoded. */
  flags: number;
}

const LICENSEE_TYPES: Partial<Record<number, LicenseeTypeName>> = {
  0xffff: 'unrestricted',
  0x0009: 'xboxLiveAccount',
  0x0003: 'windowsLiveAccount',
  0xf000: 'console',
  0xe000: 'mediaFlags',
  0xd000: 'keyvaultPrivilege',
  0xc000: 'hypervisorFlags',
  0xb000: 'userPrivilege',
  0x0000: 'unused',
};

/**
 * Returns all 16 licence entries, in header order, including unused ones.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * Entry n starts at 0x22C + n * 0x10. Each licensee ID is split into its type (the
 * top 16 bits, decoded where documented) and its data (the low 48 bits). An
 * unrestricted licence (anyone may use the package) has type 0xFFFF. These are
 * facts from the header, not a verdict on who can use the package (spec §2.2).
 */
export function parseLicences(bytes: Uint8Array): Licence[] {
  return Array.from({ length: LICENCE_COUNT }, (_, index) => {
    const offset = LICENCES_OFFSET + index * LICENCE_LENGTH;
    const raw = readU16(bytes, offset);
    return {
      index,
      licenseeType: { raw, decoded: LICENSEE_TYPES[raw] ?? 'unknown' },
      licenseeData: toHex(bytes.subarray(offset + 2, offset + 8)),
      bits: readU32(bytes, offset + 8),
      flags: readU32(bytes, offset + 12),
    };
  });
}
