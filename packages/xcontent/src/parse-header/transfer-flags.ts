/** Reads the single transfer flags byte at offset 0x1711. Returns null if the buffer is too short. */
export function parseTransferFlags(bytes: Uint8Array): number | null {
  if (bytes.length <= 0x1711) return null
  return bytes[0x1711]
}
