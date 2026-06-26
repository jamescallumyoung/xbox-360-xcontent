import { describe, it, expect } from 'vitest'
import { parseMetadataVersion } from '../metadata-version.js'
import { godDeadIslandRiptide, dlcHaloWars } from './fixtures.js'

describe('parseMetadataVersion', () => {
  it('reads version 2 from real fixtures', () => {
    expect(parseMetadataVersion(godDeadIslandRiptide)).toBe(2)
    expect(parseMetadataVersion(dlcHaloWars)).toBe(2)
  })

  it('returns null when bytes are too short to contain the field', () => {
    expect(parseMetadataVersion(new Uint8Array(0x0340))).toBeNull()
  })
})
