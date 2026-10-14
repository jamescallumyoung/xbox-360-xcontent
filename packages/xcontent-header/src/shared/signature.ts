import {
  CON_SIGNATURE_LENGTH,
  CON_SIGNATURE_OFFSET,
  MICROSOFT_SIGNATURE_LENGTH,
  MICROSOFT_SIGNATURE_OFFSET,
} from './internal/layout.js';
import { parseDeclaredSigning } from './signing.js';

/**
 * Says whether the package's signature is all zero bytes, which marks a package
 * made by a tool rather than signed by Microsoft or a console.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * For `LIVE` and `PIRS`, it checks the 0x100-byte Microsoft signature at 0x004,
 * not the padding after it. For `CON`, it checks the 0x80-byte package signature at
 * 0x1AC, not the certificate before it (spec §6.2).
 *
 * `false` doesn't mean the signature is genuine: it isn't verified, and some
 * unlockers overwrite it with a marker (spec §2.3, §4.8).
 */
export function isSignatureEmpty(bytes: Uint8Array): boolean {
  const [offset, length] =
    parseDeclaredSigning(bytes) === 'CON'
      ? [CON_SIGNATURE_OFFSET, CON_SIGNATURE_LENGTH]
      : [MICROSOFT_SIGNATURE_OFFSET, MICROSOFT_SIGNATURE_LENGTH];
  return bytes.subarray(offset, offset + length).every((byte) => byte === 0);
}
