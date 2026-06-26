import type { SigningMagic } from '../types.js'

/** Reads the console type byte at offset 0x01F (0x01 = devkit, 0x02 = retail). Returns null for non-CON packages. */
export function parseConsoleType(bytes: Uint8Array, magic: SigningMagic): 'devkit' | 'retail' | null {
  if (magic !== 'CON') return null
  if (bytes.length <= 0x01F) return null
  const b = bytes[0x01F]
  if (b === 0x01) return 'devkit'
  if (b === 0x02) return 'retail'
  return null
}
