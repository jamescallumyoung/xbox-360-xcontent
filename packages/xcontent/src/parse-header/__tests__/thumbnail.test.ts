import { describe, it, expect } from 'vitest'
import { parseThumbnail } from '../thumbnail.js'
import { godDeadIslandRiptide, godSouthParkTsot, dlcHaloWars, dlcHaloReachAnniversary } from './fixtures.js'

describe('parseThumbnail', () => {
  it('returns a Uint8Array for all real fixtures (PNG present at 0x171A)', () => {
    expect(parseThumbnail(godDeadIslandRiptide)).toBeInstanceOf(Uint8Array)
    expect(parseThumbnail(godSouthParkTsot)).toBeInstanceOf(Uint8Array)
    expect(parseThumbnail(dlcHaloWars)).toBeInstanceOf(Uint8Array)
    expect(parseThumbnail(dlcHaloReachAnniversary)).toBeInstanceOf(Uint8Array)
  })

  it('returned thumbnail starts with PNG magic bytes', () => {
    const thumbnail = parseThumbnail(godDeadIslandRiptide)!
    expect(thumbnail[0]).toBe(0x89)
    expect(thumbnail[1]).toBe(0x50)
    expect(thumbnail[2]).toBe(0x4E)
    expect(thumbnail[3]).toBe(0x47)
  })

  it('returned thumbnail is at most 0x3D00 bytes for metadata v2 files', () => {
    // All real fixtures are metadata v2; parseThumbnail defaults to v1 so pass version explicitly
    const thumbnail = parseThumbnail(godDeadIslandRiptide, 2)!
    expect(thumbnail.length).toBeLessThanOrEqual(0x3D00)
  })

  it('returns null when bytes are too short to reach the thumbnail offset', () => {
    expect(parseThumbnail(new Uint8Array(0x1000))).toBeNull()
  })

  it('returns null when no PNG or JPEG magic is present at the thumbnail offset', () => {
    const bytes = new Uint8Array(0x6000)
    expect(parseThumbnail(bytes)).toBeNull()
  })
})
