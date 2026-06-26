import type { SigningMagic } from '../types.js'

/** Reads the 4-byte signing magic at offset 0x000. Returns null if the bytes do not match a known magic. */
export function parseMagic(bytes: Uint8Array): SigningMagic | null {
  if (bytes.length < 4) return null
  const [b0, b1, b2, b3] = bytes
  if (b0 === 0x43 && b1 === 0x4F && b2 === 0x4E && b3 === 0x20) return 'CON'
  if (b0 === 0x4C && b1 === 0x49 && b2 === 0x56 && b3 === 0x45) return 'LIVE'
  if (b0 === 0x50 && b1 === 0x49 && b2 === 0x52 && b3 === 0x53) return 'PIRS'
  return null
}
