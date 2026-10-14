import type { DeclaredSigning } from './precheck-header.js'
import { signingForMagic } from './internal/magic.js'

/**
 * Returns the signing type the header claims: `CON`, `LIVE` or `PIRS`.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It's read from the magic at 0x000, without the trailing space of `CON `. It
 * says only what kind of signature the package claims, not whether it's genuine
 * (spec §2.3).
 */
export function parseDeclaredSigning(bytes: Uint8Array): DeclaredSigning {
  const signing = signingForMagic(bytes)
  if (signing === undefined) throw new RangeError('The magic is not CON, LIVE or PIRS: run precheckHeader first.')
  return signing
}
