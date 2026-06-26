import { describe, it, expect } from 'vitest'
import { parseTitleId } from '../title-id.js'
import { godDeadIslandRiptide, godSouthParkTsot, dlcHaloWars, dlcHaloReachAnniversary } from './fixtures.js'

describe('parseTitleId', () => {
  it('reads the correct title ID from each fixture', () => {
    expect(parseTitleId(godDeadIslandRiptide)).toBe(0x4B4D07F2)
    expect(parseTitleId(godSouthParkTsot)).toBe(0x555308C5)
    expect(parseTitleId(dlcHaloWars)).toBe(0x4D530808)
    expect(parseTitleId(dlcHaloReachAnniversary)).toBe(0x4D53085B)
  })

  it('returns null when title ID is zero', () => {
    const bytes = new Uint8Array(0x0400)
    expect(parseTitleId(bytes)).toBeNull()
  })

  it('returns null when bytes are too short to contain the title ID field', () => {
    expect(parseTitleId(new Uint8Array(0x0360))).toBeNull()
  })
})
