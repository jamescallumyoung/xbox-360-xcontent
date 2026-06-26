import { describe, it, expect } from 'vitest'
import { parseDisplayDescriptions } from '../display-descriptions.js'
import { godDeadIslandRiptide, dlcHaloWars } from './fixtures.js'

describe('parseDisplayDescriptions', () => {
  it('returns only non-empty slots', () => {
    const descs = parseDisplayDescriptions(godDeadIslandRiptide)
    expect(descs?.length).toBeGreaterThan(0)
    expect(descs?.every(d => d !== '')).toBe(true)
  })

  it('reads the English description from slot 0', () => {
    const desc = parseDisplayDescriptions(godDeadIslandRiptide)?.[0]
    expect(desc).toContain('installed game')
  })

  it('reads localised descriptions from DLC', () => {
    const descs = parseDisplayDescriptions(dlcHaloWars)
    expect(descs?.[0]).toBe('Upgrade your Wraiths to the unique Honor Guard variant!')
  })

  it('returns null when bytes are too short to contain any description', () => {
    expect(parseDisplayDescriptions(new Uint8Array(0x100))).toBeNull()
  })
})
