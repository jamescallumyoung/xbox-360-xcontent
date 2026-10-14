import { readU32 } from './internal/bytes.js';
import { VOLUME_TYPE_OFFSET } from './internal/layout.js';

/** The package format: the volume type as stored, and what it means. */
export interface Format {
  /** The volume type stored at 0x3A9. */
  raw: number;
  /** 'stfs' for 0, 'svod' for 1, and 'unknown' for anything else. */
  decoded: 'stfs' | 'svod' | 'unknown';
}

/**
 * Returns the package format, from the volume type at 0x3A9.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * 0 means STFS (a single-file package) and 1 means SVOD (a header file plus a
 * .data folder). The format is never inferred from the content type, the magic or
 * the presence of a .data folder (spec §6.9).
 */
export function parseFormat(bytes: Uint8Array): Format {
  const raw = readU32(bytes, VOLUME_TYPE_OFFSET);
  return { raw, decoded: raw === 0 ? 'stfs' : raw === 1 ? 'svod' : 'unknown' };
}
