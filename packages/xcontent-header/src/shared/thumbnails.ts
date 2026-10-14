import { copyBytes, readU32 } from './internal/bytes.js';
import {
  THUMBNAIL_OFFSET,
  THUMBNAIL_SIZE_OFFSET,
  THUMBNAIL_SPACE_V1,
  THUMBNAIL_SPACE_V2,
  TITLE_THUMBNAIL_OFFSET,
  TITLE_THUMBNAIL_SIZE_OFFSET,
} from './internal/layout.js';
import { parseMetadataVersion } from './metadata-version.js';

/** The declared size of each thumbnail, and the space available to each. */
export interface ThumbnailSizes {
  /** The thumbnail's declared size, at 0x1712. */
  thumbnail: number;
  /** The title thumbnail's declared size, at 0x1716. */
  titleThumbnail: number;
  /** The space each thumbnail has: 0x4000 in metadata version 1, 0x3D00 in version 2. */
  availableSpace: number;
}

/**
 * Returns both thumbnails' declared sizes, and the space available to each.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * Use it to check parseThumbnail's and parseTitleThumbnail's second precondition:
 * a declared size must be no larger than `availableSpace`. Sizes are returned as
 * stored, even when they're too large. Version 2 has less space because its extra
 * language slots take the last 0x300 bytes of each thumbnail's space (spec §6.5).
 */
export function parseThumbnailSizes(bytes: Uint8Array): ThumbnailSizes {
  return {
    thumbnail: readU32(bytes, THUMBNAIL_SIZE_OFFSET),
    titleThumbnail: readU32(bytes, TITLE_THUMBNAIL_SIZE_OFFSET),
    availableSpace: parseMetadataVersion(bytes).effective === 2 ? THUMBNAIL_SPACE_V2 : THUMBNAIL_SPACE_V1,
  };
}

/**
 * Returns a copy of the thumbnail's image bytes, or null when its declared size
 * is 0.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the declared size (see parseThumbnailSizes) must fit its
 * space. Otherwise the copy would include bytes from the next field.
 *
 * The image starts at 0x171A, and its declared size is at 0x1712. The bytes are
 * returned as they are, without checking they're a PNG.
 */
export function parseThumbnail(bytes: Uint8Array): Uint8Array | null {
  const size = readU32(bytes, THUMBNAIL_SIZE_OFFSET);
  return size === 0 ? null : copyBytes(bytes, THUMBNAIL_OFFSET, size);
}

/**
 * Returns a copy of the title thumbnail's image bytes, or null when its declared
 * size is 0.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * A second precondition: the declared size (see parseThumbnailSizes) must fit its
 * space. Otherwise the copy would include bytes from the next field.
 *
 * The image starts at 0x571A, and its declared size is at 0x1716. The bytes are
 * returned as they are, without checking they're a PNG.
 */
export function parseTitleThumbnail(bytes: Uint8Array): Uint8Array | null {
  const size = readU32(bytes, TITLE_THUMBNAIL_SIZE_OFFSET);
  return size === 0 ? null : copyBytes(bytes, TITLE_THUMBNAIL_OFFSET, size);
}
