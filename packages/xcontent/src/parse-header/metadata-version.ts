import { readUint32BE } from './bytes.js'

/** Reads the metadata version uint32 at offset 0x0348. Returns null if the buffer is too short. */
export function parseMetadataVersion(bytes: Uint8Array): number | null {
  if (bytes.length < 0x034C) return null
  return readUint32BE(bytes, 0x0348)
}
