import { describe, it, expect } from 'vitest'
import { parseMagic } from '../magic.js'
import { godDeadIslandRiptide, dlcHaloWars } from './fixtures.js'

describe('parseMagic', () => {
  it('returns LIVE for LIVE-signed packages', () => {
    expect(parseMagic(godDeadIslandRiptide)).toBe('LIVE')
    expect(parseMagic(dlcHaloWars)).toBe('LIVE')
  })

  it('returns CON for CON magic bytes', () => {
    const bytes = new Uint8Array([0x43, 0x4F, 0x4E, 0x20])
    expect(parseMagic(bytes)).toBe('CON')
  })

  it('returns PIRS for PIRS magic bytes', () => {
    const bytes = new Uint8Array([0x50, 0x49, 0x52, 0x53])
    expect(parseMagic(bytes)).toBe('PIRS')
  })

  it('returns null for unrecognised magic', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03])
    expect(parseMagic(bytes)).toBeNull()
  })

  it('returns null when bytes are too short', () => {
    expect(parseMagic(new Uint8Array([0x43, 0x4F, 0x4E]))).toBeNull()
  })
})
