import { describe, expect, it } from 'vitest'
import { copyBytes, readU16, readU32, readU64, readU8 } from '../bytes.js'

const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0xff])

describe('byte readers (big-endian, spec §6)', () => {
  it('reads one byte', () => {
    expect(readU8(bytes, 9)).toBe(0xff)
  })

  it('reads 2 and 4 bytes big-endian', () => {
    expect(readU16(bytes, 1)).toBe(0x0102)
    expect(readU32(bytes, 1)).toBe(0x01020304)
  })

  it('reads 4 bytes as an unsigned value', () => {
    expect(readU32(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 0)).toBe(0xffffffff)
  })

  it('reads 8 bytes as an exact bigint', () => {
    expect(readU64(bytes, 1)).toBe(0x0102030405060708n)
    expect(readU64(new Uint8Array(8).fill(0xff), 0)).toBe(0xffffffffffffffffn)
  })

  it('reads from a view that starts partway into its buffer', () => {
    const offsetView = new Uint8Array(bytes.buffer, 2)
    expect(readU16(offsetView, 0)).toBe(0x0203)
  })
})

describe('copyBytes', () => {
  it('returns the requested range', () => {
    expect([...copyBytes(bytes, 2, 3)]).toEqual([2, 3, 4])
  })

  it('returns a copy, not a view, so later changes to the input do not affect it', () => {
    const input = bytes.slice()
    const copy = copyBytes(input, 0, 4)
    input[0] = 0xaa
    expect(copy[0]).toBe(0x00)
  })
})
