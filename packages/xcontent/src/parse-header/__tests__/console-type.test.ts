import { describe, it, expect } from 'vitest'
import { parseConsoleType } from '../console-type.js'

describe('parseConsoleType', () => {
  it('returns null for LIVE packages', () => {
    expect(parseConsoleType(new Uint8Array(0x100), 'LIVE')).toBeNull()
  })

  it('returns null for PIRS packages', () => {
    expect(parseConsoleType(new Uint8Array(0x100), 'PIRS')).toBeNull()
  })

  it('returns retail for byte 0x02 at offset 0x01F', () => {
    const bytes = new Uint8Array(0x30)
    bytes[0x01F] = 0x02
    expect(parseConsoleType(bytes, 'CON')).toBe('retail')
  })

  it('returns devkit for byte 0x01 at offset 0x01F', () => {
    const bytes = new Uint8Array(0x30)
    bytes[0x01F] = 0x01
    expect(parseConsoleType(bytes, 'CON')).toBe('devkit')
  })

  it('returns null for unrecognised console type byte', () => {
    const bytes = new Uint8Array(0x30)
    bytes[0x01F] = 0x00
    expect(parseConsoleType(bytes, 'CON')).toBeNull()
  })

  it('returns null when bytes are too short', () => {
    expect(parseConsoleType(new Uint8Array(0x010), 'CON')).toBeNull()
  })
})
