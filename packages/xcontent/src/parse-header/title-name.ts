import { readStr16BE } from './bytes.js'

/** Reads the UTF-16BE title name from the single 0x80-byte slot at offset 0x1691. Returns null if the buffer is too short to reach the field. */
export function parseTitleName(bytes: Uint8Array): string | null {
  if (bytes.length <= 0x1691) return null
  return readStr16BE(bytes, 0x1691, 0x80)
}
