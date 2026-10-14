import { type PrecheckFailureReason, precheckHeader } from '../shared/precheck-header.js';
import { isSignatureEmpty } from '../shared/signature.js';

/** Why hasEmptySignature failed: always a pre-check. */
export type HasEmptySignatureFailureReason = PrecheckFailureReason;

/** Whether the signature is empty, or the one reason the check couldn't run. */
export type HasEmptySignatureResult = [true, boolean] | [false, HasEmptySignatureFailureReason[]];

/**
 * Says whether a package's signature is all zero bytes, which marks a package made
 * by a tool (such as a Disc to GOD rip) rather than signed by Microsoft or a
 * console.
 *
 * Needs bytes from 0x000 up to the header size stored at 0x340: 0x971A bytes when
 * that value is 0x971A, and 0xAD0E bytes when it is 0xAD0E. Reading 0xB000 bytes
 * always suffices. Bytes beyond the header are ignored.
 *
 * Returns `[true, isEmpty]`, or `[false, [reason]]` when a pre-check fails. The first
 * element says whether the check ran: `[true, false]` means "checked, and not empty".
 * It never throws on bad input.
 *
 * For `LIVE` and `PIRS` it checks the 0x100-byte Microsoft signature at 0x004; for
 * `CON`, the 0x80-byte package signature at 0x1AC. A non-empty signature isn't
 * necessarily genuine: it isn't verified, and some unlockers overwrite it with a
 * marker (spec §2.3, §4.8).
 */
export function hasEmptySignature(bytes: Uint8Array): HasEmptySignatureResult {
  const [ok, precheck] = precheckHeader(bytes);
  if (!ok) return [false, precheck];
  return [true, isSignatureEmpty(bytes)];
}
