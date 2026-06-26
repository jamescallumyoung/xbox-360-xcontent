import { describe, it, expect } from 'vitest'
import { parseConsoleId } from '../console-id.js'

describe('parseConsoleId', () => {
  it('returns null for LIVE packages', () => {
    expect(parseConsoleId(new Uint8Array(0x100), 'LIVE')).toBeNull()
  })

  it('returns null for PIRS packages', () => {
    expect(parseConsoleId(new Uint8Array(0x100), 'PIRS')).toBeNull()
  })

  it('returns the console ID as a hex string for CON packages', () => {
    const bytes = new Uint8Array(0x20)
    bytes[0x006] = 0xAB
    bytes[0x007] = 0xCD
    bytes[0x008] = 0xEF
    bytes[0x009] = 0x01
    bytes[0x00A] = 0x23
    expect(parseConsoleId(bytes, 'CON')).toBe('abcdef0123')
  })

  it('returns null when bytes are too short for a CON package', () => {
    expect(parseConsoleId(new Uint8Array(0x008), 'CON')).toBeNull()
  })

  it('returns all-zeros for a re-signed CON package', () => {
    const bytes = new Uint8Array(0x20)
    expect(parseConsoleId(bytes, 'CON')).toBe('0000000000')
  })
})
