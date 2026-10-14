import type { DeclaredSigning } from '../precheck-header.js'
import { MAGIC_LENGTH, MAGIC_OFFSET } from './layout.js'
import { decodeLatin1Field } from './text.js'

const SIGNING_BY_MAGIC: Partial<Record<string, DeclaredSigning>> = {
  'CON ': 'CON',
  LIVE: 'LIVE',
  PIRS: 'PIRS',
}

/**
 * Looks up the signing type that the magic at 0x000 declares (spec §6.2), or
 * returns undefined when the magic isn't `CON `, `LIVE` or `PIRS`.
 *
 * Needs at least the first 4 bytes.
 */
export function signingForMagic(bytes: Uint8Array): DeclaredSigning | undefined {
  return SIGNING_BY_MAGIC[decodeLatin1Field(bytes, MAGIC_OFFSET, MAGIC_LENGTH)]
}
