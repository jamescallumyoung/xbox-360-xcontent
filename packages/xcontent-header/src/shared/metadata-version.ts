import { readU32 } from './internal/bytes.js';
import { METADATA_VERSION_OFFSET } from './internal/layout.js';

/** The metadata version as stored, and how readers interpret it. */
export interface MetadataVersion {
  /** The value stored at 0x348. */
  declared: number;
  /** 2 when the stored value is 2; 1 for anything else, including 0. */
  effective: 1 | 2;
}

/**
 * Returns the metadata version at 0x348: the stored value, and the version it
 * means.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * Version 1 is stored as 0, and version 2 as 2. Like xenia and Velocity, any value
 * other than 2 is read as version 1 (spec §6.1). Version 2 adds three language
 * slots and shrinks the thumbnails' space.
 */
export function parseMetadataVersion(bytes: Uint8Array): MetadataVersion {
  const declared = readU32(bytes, METADATA_VERSION_OFFSET);
  return { declared, effective: declared === 2 ? 2 : 1 };
}
