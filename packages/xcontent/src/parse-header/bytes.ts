/** Reads a big-endian uint32 from the given offset. */
export function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0
}

const decoder = new TextDecoder('utf-16be')

/** Decodes a UTF-16BE string of up to `length` bytes at `offset`, stripping null bytes and trimming whitespace. */
export function readStr16BE(bytes: Uint8Array, offset: number, length: number): string {
  if (offset >= bytes.length) return ''
  const end = Math.min(offset + length, bytes.length)
  return decoder.decode(bytes.subarray(offset, end)).replace(/\0/g, '').trim()
}
