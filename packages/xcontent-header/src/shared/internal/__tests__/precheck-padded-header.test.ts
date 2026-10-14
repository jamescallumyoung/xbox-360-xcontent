import { describe, expect, it } from 'vitest'
import { buildHeader } from '../../../__tests__/helpers/header-builder.js'
import { FIXTURE_NAMES, loadFixture } from '../../../__tests__/helpers/load-fixture.js'
import { precheckPaddedHeader } from '../precheck-padded-header.js'

const ascii = (text: string): Uint8Array => Uint8Array.from(text, c => c.charCodeAt(0))

describe('precheckPaddedHeader (V1.7-11)', () => {
  it('runs the same magic and size steps as precheckHeader (V1.7-10)', () => {
    expect(precheckPaddedHeader(ascii('LIV'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 4, got: 3 }]])
    expect(precheckPaddedHeader(ascii('abcd'))).toEqual([false, [{ kind: 'not-a-package' }]])
    expect(precheckPaddedHeader(ascii('LIVE'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0x344, got: 4 }]])
    const badSize = buildHeader({ magic: 'LIVE', headerSize: 0x1234 }).bytes()
    expect(precheckPaddedHeader(badSize)).toEqual([false, [{ kind: 'header-size-invalid', declared: 0x1234 }]])
  })

  it('requires 0xA000 bytes for a 0x971A header (V1.11)', () => {
    const unpadded = buildHeader({ magic: 'CON ', headerSize: 0x971a }).truncate(0x971a).bytes()
    expect(precheckPaddedHeader(unpadded)).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0xa000, got: 0x971a }]])
    const padded = buildHeader({ magic: 'CON ', headerSize: 0x971a }).bytes()
    expect(precheckPaddedHeader(padded)).toEqual([true, { declaredSigning: 'CON', headerSize: 0x971a }])
  })

  it('requires 0xB000 bytes for a 0xAD0E header (V1.11)', () => {
    const short = buildHeader({ magic: 'LIVE', headerSize: 0xad0e }).truncate(0xafff).bytes()
    expect(precheckPaddedHeader(short)).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0xb000, got: 0xafff }]])
    const padded = buildHeader({ magic: 'LIVE', headerSize: 0xad0e }).bytes()
    expect(precheckPaddedHeader(padded)).toEqual([true, { declaredSigning: 'LIVE', headerSize: 0xad0e }])
  })

  it('passes every real fixture, since each holds its padded header', () => {
    for (const name of FIXTURE_NAMES) {
      expect(precheckPaddedHeader(loadFixture(name))[0], name).toBe(true)
    }
  })
})
