// Secondary thumbnail is always at 0x571A (immediately after the primary's v1 allocation).
// Size rules are the same as the primary: 0x4000 for v1, 0x3D00 for v2.
const SECONDARY_THUMBNAIL_OFFSET = 0x571A
const THUMBNAIL_SIZE_V1 = 0x4000
const THUMBNAIL_SIZE_V2 = 0x3D00

/** Reads the secondary thumbnail PNG/JPEG at offset 0x571A (0x4000 bytes for v1, 0x3D00 for v2). Returns null if no valid image magic is found. */
export function parseSecondaryThumbnail(bytes: Uint8Array, metadataVersion = 1): Uint8Array | null {
  const maxSize = metadataVersion === 2 ? THUMBNAIL_SIZE_V2 : THUMBNAIL_SIZE_V1
  if (bytes.length < SECONDARY_THUMBNAIL_OFFSET + 4) return null

  const b0 = bytes[SECONDARY_THUMBNAIL_OFFSET]
  const b1 = bytes[SECONDARY_THUMBNAIL_OFFSET + 1]
  const b2 = bytes[SECONDARY_THUMBNAIL_OFFSET + 2]
  const b3 = bytes[SECONDARY_THUMBNAIL_OFFSET + 3]

  const isPng = b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47
  const isJpeg = b0 === 0xFF && b1 === 0xD8 && b2 === 0xFF

  if (!isPng && !isJpeg) return null

  return bytes.slice(SECONDARY_THUMBNAIL_OFFSET, Math.min(SECONDARY_THUMBNAIL_OFFSET + maxSize, bytes.length))
}
