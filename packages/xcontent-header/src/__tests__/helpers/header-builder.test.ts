import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildHeader, headerFrom } from './header-builder.js'
import { loadFixture } from './load-fixture.js'

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length))

describe('buildHeader', () => {
  it('writes the magic at 0x000', () => {
    expect(ascii(buildHeader({ magic: 'LIVE' }).bytes(), 0, 4)).toBe('LIVE')
    expect(ascii(buildHeader({ magic: 'CON ' }).bytes(), 0, 4)).toBe('CON ')
  })

  it('defaults to a CON header of size 0x971A, and LIVE or PIRS of size 0xAD0E', () => {
    expect(view(buildHeader({ magic: 'CON ' }).bytes()).getUint32(0x340)).toBe(0x971a)
    expect(view(buildHeader({ magic: 'LIVE' }).bytes()).getUint32(0x340)).toBe(0xad0e)
    expect(view(buildHeader({ magic: 'PIRS' }).bytes()).getUint32(0x340)).toBe(0xad0e)
  })

  it('writes the given header size and metadata version', () => {
    const bytes = buildHeader({ magic: 'CON ', headerSize: 0xad0e, metadataVersion: 7 }).bytes()
    expect(view(bytes).getUint32(0x340)).toBe(0xad0e)
    expect(view(bytes).getUint32(0x348)).toBe(7)
  })

  it('defaults to metadata version 2', () => {
    expect(view(buildHeader({ magic: 'LIVE' }).bytes()).getUint32(0x348)).toBe(2)
  })

  it('is as long as the padded header by default: 0xA000 or 0xB000', () => {
    expect(buildHeader({ magic: 'CON ' }).bytes().length).toBe(0xa000)
    expect(buildHeader({ magic: 'LIVE' }).bytes().length).toBe(0xb000)
  })

  it('accepts any header size, even invalid ones, and then defaults to 0xB000 bytes', () => {
    const bytes = buildHeader({ magic: 'LIVE', headerSize: 0x1234 }).bytes()
    expect(view(bytes).getUint32(0x340)).toBe(0x1234)
    expect(bytes.length).toBe(0xb000)
  })

  it('accepts any 4-byte magic', () => {
    expect(ascii(buildHeader({ magic: 'NOPE' }).bytes(), 0, 4)).toBe('NOPE')
  })

  it('writes big-endian integers of 1, 2, 4 and 8 bytes', () => {
    const bytes = buildHeader({ magic: 'LIVE' })
      .setU8(0x1711, 0xc0)
      .setU16(0x22c, 0xf000)
      .setU32(0x360, 0x4d5307e6)
      .setU64(0x3a1, 0x0102030405060708n)
      .bytes()
    expect(bytes[0x1711]).toBe(0xc0)
    expect([...bytes.subarray(0x22c, 0x22e)]).toEqual([0xf0, 0x00])
    expect([...bytes.subarray(0x360, 0x364)]).toEqual([0x4d, 0x53, 0x07, 0xe6])
    expect([...bytes.subarray(0x3a1, 0x3a9)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('writes raw bytes', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setBytes(0x36c, [1, 2, 3, 4, 5]).bytes()
    expect([...bytes.subarray(0x36c, 0x371)]).toEqual([1, 2, 3, 4, 5])
  })

  it('writes text as UTF-16BE code units, without a terminator', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setUtf16(0x411, 'Hi™').bytes()
    expect([...bytes.subarray(0x411, 0x419)]).toEqual([0x00, 0x48, 0x00, 0x69, 0x21, 0x22, 0x00, 0x00])
  })

  it('writes lone UTF-16 code units, so tests can build unpaired surrogates', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU16(0x411, 0xd83c).bytes()
    expect([...bytes.subarray(0x411, 0x413)]).toEqual([0xd8, 0x3c])
  })

  it('cuts the header to a given length', () => {
    expect(buildHeader({ magic: 'LIVE' }).truncate(0x343).bytes().length).toBe(0x343)
  })

  it('recomputes the content ID: the SHA-1 of 0x344 up to the padded end', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU32(0x360, 0x4d5307e6).withContentId().bytes()
    const expected = createHash('sha1').update(bytes.subarray(0x344, 0xb000)).digest()
    expect([...bytes.subarray(0x32c, 0x340)]).toEqual([...expected])
  })

  it('returns a new copy from each call to bytes()', () => {
    const builder = buildHeader({ magic: 'LIVE' })
    const first = builder.bytes()
    first[0] = 0
    expect(ascii(builder.bytes(), 0, 4)).toBe('LIVE')
  })
})

describe('headerFrom', () => {
  it('starts from existing bytes, without changing them', () => {
    const fixture = loadFixture('live-stfs-dlc-non-ascii')
    const copy = headerFrom(fixture).setU32(0x360, 0).bytes()
    expect(view(copy).getUint32(0x360)).toBe(0)
    expect(view(fixture).getUint32(0x360)).not.toBe(0)
  })

  it("leaves a real fixture's content ID unchanged when recomputing it", () => {
    for (const name of ['con-971a-mv2-xna-save', 'live-svod-god-dead-island-riptide'] as const) {
      const fixture = loadFixture(name)
      const rebuilt = headerFrom(fixture).withContentId().bytes()
      expect([...rebuilt.subarray(0x32c, 0x340)]).toEqual([...fixture.subarray(0x32c, 0x340)])
    }
  })
})
