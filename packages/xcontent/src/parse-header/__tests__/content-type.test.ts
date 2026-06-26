import { describe, it, expect } from 'vitest'
import { parseContentType } from '../content-type.js'
import { godDeadIslandRiptide, dlcHaloWars } from './fixtures.js'

describe('parseContentType', () => {
  it('reads GameOnDemand from GOD header', () => {
    const result = parseContentType(godDeadIslandRiptide)
    expect(result?.value).toBe(0x00007000)
    expect(result?.name).toBe('GameOnDemand')
  })

  it('reads MarketPlaceContent from DLC header', () => {
    const result = parseContentType(dlcHaloWars)
    expect(result?.value).toBe(0x00000002)
    expect(result?.name).toBe('MarketPlaceContent')
  })

  it('returns null when the buffer is too short', () => {
    expect(parseContentType(new Uint8Array(0x0340))).toBeNull()
  })

  it('returns Unknown for unrecognised content type values', () => {
    const bytes = new Uint8Array(0x0400).fill(0)
    bytes[0x0344] = 0xFF
    bytes[0x0345] = 0xFF
    bytes[0x0346] = 0xFF
    bytes[0x0347] = 0xFF
    expect(parseContentType(bytes)?.name).toBe('Unknown')
  })
})
