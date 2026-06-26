import { readUint32BE } from './bytes.js'

/** Reads the title ID uint32 at offset 0x0360. Returns null if the ID is zero or the buffer is too short. */
export function parseTitleId(bytes: Uint8Array): number | null {
  if (bytes.length < 0x0364) return null
  const id = readUint32BE(bytes, 0x0360)
  return id === 0 ? null : id
}
