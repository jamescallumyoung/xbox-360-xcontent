import { describe, it, expect } from 'vitest'
import { parseDisplayNames } from '../display-names.js'
import { godDeadIslandRiptide, godSouthParkTsot, dlcHaloWars, dlcHaloReachAnniversary } from './fixtures.js'

describe('parseDisplayNames', () => {
  it('returns only non-empty slots', () => {
    const names = parseDisplayNames(godDeadIslandRiptide)
    expect(names?.length).toBeGreaterThan(0)
    expect(names?.every(n => n !== '')).toBe(true)
  })

  it('reads the English display name from slot 0', () => {
    expect(parseDisplayNames(godDeadIslandRiptide)?.[0]).toBe('Dead Island Riptide')
    expect(parseDisplayNames(godSouthParkTsot)?.[0]).toContain('South Park')
    expect(parseDisplayNames(dlcHaloWars)?.[0]).toBe('Unique unit: Honor Guard Wraith')
    expect(parseDisplayNames(dlcHaloReachAnniversary)?.[0]).toBe('Halo: Reach - Anniversary Map Pack')
  })

  it('reads localised names from the DLC fixture', () => {
    const names = parseDisplayNames(dlcHaloReachAnniversary)
    expect(names?.[1]).toBe('Halo: Reach アニバーサリー マップ パック')
  })

  it('returns null when bytes are too short to contain any name', () => {
    expect(parseDisplayNames(new Uint8Array(0x100))).toBeNull()
  })
})
