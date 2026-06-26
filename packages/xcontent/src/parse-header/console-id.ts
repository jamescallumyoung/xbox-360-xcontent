import type { SigningMagic } from '../types.js'

/** Reads the 5-byte console ID at offset 0x006 as a lowercase hex string. Returns null for non-CON packages. */
export function parseConsoleId(bytes: Uint8Array, magic: SigningMagic): string | null {
  if (magic !== 'CON') return null
  if (bytes.length < 0x00B) return null
  return Array.from(bytes.subarray(0x006, 0x00B))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
