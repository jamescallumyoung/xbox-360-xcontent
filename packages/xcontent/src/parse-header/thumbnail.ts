// Thumbnail is always at 0x171A regardless of metadata version.
// 0x3D00 is the allocation *size* for v2 (vs 0x4000 for v1), not an offset.
const THUMBNAIL_OFFSET = 0x171A
const THUMBNAIL_SIZE_V1 = 0x4000
const THUMBNAIL_SIZE_V2 = 0x3D00

/** Reads the primary thumbnail PNG/JPEG at offset 0x171A (0x4000 bytes for v1, 0x3D00 for v2). Returns null if no valid image is found. */
export function parseThumbnail(bytes: Uint8Array, metadataVersion = 1): Uint8Array | null {
  const maxSize = metadataVersion === 2 ? THUMBNAIL_SIZE_V2 : THUMBNAIL_SIZE_V1
  if (bytes.length < THUMBNAIL_OFFSET + 4) return null

  const b0 = bytes[THUMBNAIL_OFFSET]
  const b1 = bytes[THUMBNAIL_OFFSET + 1]
  const b2 = bytes[THUMBNAIL_OFFSET + 2]
  const b3 = bytes[THUMBNAIL_OFFSET + 3]

  const isPng = b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47
  const isJpeg = b0 === 0xFF && b1 === 0xD8 && b2 === 0xFF

  if (!isPng && !isJpeg) return null

  return bytes.slice(THUMBNAIL_OFFSET, Math.min(THUMBNAIL_OFFSET + maxSize, bytes.length))
}
