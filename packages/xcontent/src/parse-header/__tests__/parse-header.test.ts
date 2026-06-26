import { describe, it, expect } from 'vitest'
import { parseHeader } from '../index.js'
import { godDeadIslandRiptide, godSouthParkTsot, dlcHaloWars, dlcHaloReachAnniversary } from './fixtures.js'

describe('parseHeader', () => {
  describe('god-dead-island-riptide', () => {
    it('parses all top-level fields correctly', () => {
      const result = parseHeader(godDeadIslandRiptide)
      expect(result.success).toBe(true)
      if (!result.success) return
      const h = result.header
      expect(h.magic).toBe('LIVE')
      expect(h.titleId).toBe(0x4B4D07F2)
      expect(h.titleIdHex).toBe('4B4D07F2')
      expect(h.contentType).toBe(0x00007000)
      expect(h.contentTypeName).toBe('GameOnDemand')
      expect(h.metadataVersion).toBe(2)
      expect(h.titleName).toBe('Dead Island Riptide')
      expect(h.displayNames[0]).toBe('Dead Island Riptide')
      expect(h.consoleId).toBeNull()
      expect(h.consoleType).toBeNull()
      expect(h.thumbnail).toBeInstanceOf(Uint8Array)
    })
  })

  describe('god-south-park-tsot', () => {
    it('parses all top-level fields correctly', () => {
      const result = parseHeader(godSouthParkTsot)
      expect(result.success).toBe(true)
      if (!result.success) return
      const h = result.header
      expect(h.magic).toBe('LIVE')
      expect(h.titleId).toBe(0x555308C5)
      expect(h.titleIdHex).toBe('555308C5')
      expect(h.contentType).toBe(0x00007000)
      expect(h.contentTypeName).toBe('GameOnDemand')
      expect(h.displayNames[0]).toContain('South Park')
    })
  })

  describe('dlc-halo-wars', () => {
    it('parses all top-level fields correctly', () => {
      const result = parseHeader(dlcHaloWars)
      expect(result.success).toBe(true)
      if (!result.success) return
      const h = result.header
      expect(h.magic).toBe('LIVE')
      expect(h.titleId).toBe(0x4D530808)
      expect(h.titleIdHex).toBe('4D530808')
      expect(h.contentType).toBe(0x00000002)
      expect(h.contentTypeName).toBe('MarketPlaceContent')
      expect(h.titleName).toBe('Halo Wars')
      expect(h.displayNames[0]).toBe('Unique unit: Honor Guard Wraith')
      expect(h.transferFlags).toBe(0xC0)
    })
  })

  describe('dlc-halo-reach-anniversary', () => {
    it('parses all top-level fields correctly', () => {
      const result = parseHeader(dlcHaloReachAnniversary)
      expect(result.success).toBe(true)
      if (!result.success) return
      const h = result.header
      expect(h.magic).toBe('LIVE')
      expect(h.titleId).toBe(0x4D53085B)
      expect(h.titleIdHex).toBe('4D53085B')
      expect(h.contentType).toBe(0x00000002)
      expect(h.contentTypeName).toBe('MarketPlaceContent')
      expect(h.titleName).toBe('Halo: Reach')
      expect(h.displayNames[0]).toBe('Halo: Reach - Anniversary Map Pack')
      expect(h.transferFlags).toBe(0xC0)
    })
  })

  it('returns success: false for bytes with no valid magic', () => {
    expect(parseHeader(new Uint8Array(0x1000)).success).toBe(false)
  })

  it('returns success: false when title ID is zero', () => {
    const bytes = new Uint8Array(0x1000)
    bytes[0] = 0x4C; bytes[1] = 0x49; bytes[2] = 0x56; bytes[3] = 0x45 // LIVE
    expect(parseHeader(bytes).success).toBe(false)
  })
})
