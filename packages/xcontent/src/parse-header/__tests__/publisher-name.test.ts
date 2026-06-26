import { describe, it, expect } from 'vitest'
import { parsePublisherName } from '../publisher-name.js'
import { godDeadIslandRiptide } from './fixtures.js'

describe('parsePublisherName', () => {
  it('returns a string (empty when not set)', () => {
    expect(typeof parsePublisherName(godDeadIslandRiptide)).toBe('string')
  })

  it('returns null when bytes are too short', () => {
    expect(parsePublisherName(new Uint8Array(0x100))).toBeNull()
  })

  it('reads a synthetic publisher name', () => {
    const bytes = new Uint8Array(0x2000)
    const name = 'Microsoft'
    for (let i = 0; i < name.length; i++) {
      bytes[0x1611 + i * 2] = 0x00
      bytes[0x1611 + i * 2 + 1] = name.charCodeAt(i)
    }
    expect(parsePublisherName(bytes)).toBe('Microsoft')
  })
})
