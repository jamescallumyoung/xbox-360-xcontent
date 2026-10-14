import { type Licence, parseLicences } from '../shared/licences.js';
import { parseCreatorConsoleId, parseDeviceId, parseProfileId } from '../shared/ownership-ids.js';
import { type PrecheckFailureReason, precheckHeader } from '../shared/precheck-header.js';
import { type TransferFlags, parseTransferFlags } from '../shared/transfer-flags.js';

/** What a header says about who may use a package, and how it may be moved. */
export interface Restrictions {
  /** All 16 licence entries, including unused ones. */
  licences: Licence[];
  transferFlags: TransferFlags;
  /** The console that created the package, as 10 hex digits. */
  creatorConsoleId: string;
  /** The owning profile, as 16 hex digits; all zeros for none. */
  profileId: string;
  /** The storage device the package is tied to, as 40 hex digits. */
  deviceId: string;
}

/** Why parseRestrictions failed: always a pre-check. */
export type ParseRestrictionsFailureReason = PrecheckFailureReason;

/** The restrictions, or the one reason they couldn't be parsed. */
export type ParseRestrictionsResult = [true, Restrictions] | [false, ParseRestrictionsFailureReason[]];

/**
 * Reads what a package header says about who may use the package and how it may
 * be moved: its licences, transfer flags, and the console, profile and device IDs.
 *
 * Needs bytes from 0x000 up to the header size stored at 0x340: 0x971A bytes when
 * that value is 0x971A, and 0xAD0E bytes when it is 0xAD0E. Reading 0xB000 bytes
 * always suffices. Bytes beyond the header are ignored.
 *
 * Returns `[true, restrictions]`, or `[false, [reason]]` when a pre-check fails. It
 * never throws on bad input, and always succeeds once the pre-checks pass.
 *
 * These are facts from the header, never verdicts such as "can be used": whether a
 * modded console honours licences is unknown (spec §2.2).
 */
export function parseRestrictions(bytes: Uint8Array): ParseRestrictionsResult {
  const [ok, precheck] = precheckHeader(bytes);
  if (!ok) return [false, precheck];

  return [
    true,
    {
      licences: parseLicences(bytes),
      transferFlags: parseTransferFlags(bytes),
      creatorConsoleId: parseCreatorConsoleId(bytes),
      profileId: parseProfileId(bytes),
      deviceId: parseDeviceId(bytes),
    },
  ];
}
