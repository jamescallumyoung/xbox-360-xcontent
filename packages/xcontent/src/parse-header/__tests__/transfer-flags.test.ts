import { describe, it, expect } from 'vitest'
import { parseTransferFlags } from '../transfer-flags.js'
import { godDeadIslandRiptide, dlcHaloWars } from './fixtures.js'

describe('parseTransferFlags', () => {
  it('reads transfer flags from real fixtures', () => {
    expect(parseTransferFlags(godDeadIslandRiptide)).toBe(0x00)
    expect(parseTransferFlags(dlcHaloWars)).toBe(0xC0)
  })

  it('returns null when bytes are too short', () => {
    expect(parseTransferFlags(new Uint8Array(0x100))).toBeNull()
  })
})
