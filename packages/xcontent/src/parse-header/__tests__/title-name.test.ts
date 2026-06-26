import { describe, it, expect } from 'vitest'
import { parseTitleName } from '../title-name.js'
import { godDeadIslandRiptide, dlcHaloWars } from './fixtures.js'

describe('parseTitleName', () => {
  it('reads the title name from real fixtures', () => {
    expect(parseTitleName(godDeadIslandRiptide)).toBe('Dead Island Riptide')
    expect(parseTitleName(dlcHaloWars)).toBe('Halo Wars')
  })

  it('returns null when bytes are too short', () => {
    expect(parseTitleName(new Uint8Array(0x100))).toBeNull()
  })
})
