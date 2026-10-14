import { readU32, readU64 } from './internal/bytes.js'
import { CONTENT_SIZE_OFFSET, DATA_FILE_COUNT_OFFSET, DATA_FILES_SIZE_OFFSET } from './internal/layout.js'

/**
 * Returns the content size at 0x34C, exactly, as a bigint.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It's an 8-byte field. parseHeader returns it as a number instead, and fails if
 * it's larger than Number.MAX_SAFE_INTEGER.
 */
export function parseContentSize(bytes: Uint8Array): bigint {
  return readU64(bytes, CONTENT_SIZE_OFFSET)
}

/**
 * Returns the number of data files at 0x39D: how many Data#### files an SVOD
 * package has.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It's 0 for STFS packages (spec §6.4).
 */
export function parseDataFileCount(bytes: Uint8Array): number {
  return readU32(bytes, DATA_FILE_COUNT_OFFSET)
}

/**
 * Returns the combined size of an SVOD package's data files, at 0x3A1, exactly,
 * as a bigint.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It's an 8-byte field. parseHeader returns it as a number instead, and fails if
 * it's larger than Number.MAX_SAFE_INTEGER.
 */
export function parseDataFilesSize(bytes: Uint8Array): bigint {
  return readU64(bytes, DATA_FILES_SIZE_OFFSET)
}
