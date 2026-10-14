// Readers for the big-endian integers that make up a header (spec §6).

const viewOf = (bytes: Uint8Array): DataView => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** Reads the unsigned byte at `offset`. */
export function readU8(bytes: Uint8Array, offset: number): number {
  return viewOf(bytes).getUint8(offset);
}

/** Reads the big-endian unsigned 16-bit integer at `offset`. */
export function readU16(bytes: Uint8Array, offset: number): number {
  return viewOf(bytes).getUint16(offset);
}

/** Reads the big-endian unsigned 32-bit integer at `offset`. */
export function readU32(bytes: Uint8Array, offset: number): number {
  return viewOf(bytes).getUint32(offset);
}

/**
 * Reads the big-endian unsigned 64-bit integer at `offset`, exactly.
 *
 * It returns a bigint because the value can exceed what a number holds exactly.
 */
export function readU64(bytes: Uint8Array, offset: number): bigint {
  return viewOf(bytes).getBigUint64(offset);
}

/** Copies `length` bytes from `offset`, so the result doesn't change if the input does. */
export function copyBytes(bytes: Uint8Array, offset: number, length: number): Uint8Array {
  return bytes.slice(offset, offset + length);
}
