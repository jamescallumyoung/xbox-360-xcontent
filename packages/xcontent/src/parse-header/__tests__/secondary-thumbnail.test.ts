import { describe, it, expect } from 'vitest'
import { parseSecondaryThumbnail } from '../secondary-thumbnail.js'

const SECONDARY_THUMBNAIL_OFFSET = 0x571A

function makeBytesWithImageAt(offset: number, magic: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(offset + 0x4000)
  magic.forEach((b, i) => { bytes[offset + i] = b })
  return bytes
}

describe('parseSecondaryThumbnail', () => {
  it('returns null when bytes are too short to reach the secondary thumbnail offset', () => {
    expect(parseSecondaryThumbnail(new Uint8Array(0x1000))).toBeNull()
  })

  it('returns null when no PNG or JPEG magic is present at 0x571A', () => {
    expect(parseSecondaryThumbnail(new Uint8Array(SECONDARY_THUMBNAIL_OFFSET + 0x4000))).toBeNull()
  })

  it('returns a Uint8Array starting with PNG magic when PNG is present at 0x571A', () => {
    const bytes = makeBytesWithImageAt(SECONDARY_THUMBNAIL_OFFSET, [0x89, 0x50, 0x4E, 0x47])
    const result = parseSecondaryThumbnail(bytes)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result![0]).toBe(0x89)
    expect(result![1]).toBe(0x50)
    expect(result![2]).toBe(0x4E)
    expect(result![3]).toBe(0x47)
  })

  it('returns a Uint8Array starting with JPEG magic when JPEG is present at 0x571A', () => {
    const bytes = makeBytesWithImageAt(SECONDARY_THUMBNAIL_OFFSET, [0xFF, 0xD8, 0xFF, 0xE0])
    const result = parseSecondaryThumbnail(bytes)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result![0]).toBe(0xFF)
    expect(result![1]).toBe(0xD8)
    expect(result![2]).toBe(0xFF)
  })

  it('caps the returned slice at 0x3D00 bytes for metadata v2', () => {
    const bytes = makeBytesWithImageAt(SECONDARY_THUMBNAIL_OFFSET, [0x89, 0x50, 0x4E, 0x47])
    expect(parseSecondaryThumbnail(bytes, 2)!.length).toBeLessThanOrEqual(0x3D00)
  })

  it('caps the returned slice at 0x4000 bytes for metadata v1', () => {
    const bytes = makeBytesWithImageAt(SECONDARY_THUMBNAIL_OFFSET, [0x89, 0x50, 0x4E, 0x47])
    expect(parseSecondaryThumbnail(bytes, 1)!.length).toBeLessThanOrEqual(0x4000)
  })
})
