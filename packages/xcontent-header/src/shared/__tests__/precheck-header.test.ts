import { describe, expect, it } from 'vitest'
import { manifest } from '../../__tests__/fixtures/manifest.js'
import { buildHeader } from '../../__tests__/helpers/header-builder.js'
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js'
import { precheckHeader } from '../precheck-header.js'

const ascii = (text: string): Uint8Array => Uint8Array.from(text, c => c.charCodeAt(0))

describe('precheckHeader (R1.7-11; the /extended contract, 1)', () => {
  it('fails with insufficient-bytes when there are fewer than 4 bytes (R1.7)', () => {
    expect(precheckHeader(ascii('LIV'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 4, got: 3 }]])
    expect(precheckHeader(new Uint8Array(0))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 4, got: 0 }]])
  })

  it('fails with not-a-package when the magic is not CON, LIVE or PIRS (R1.8)', () => {
    expect(precheckHeader(ascii('abcd'))).toEqual([false, [{ kind: 'not-a-package' }]])
  })

  it('requires the trailing space in "CON " (R1.8)', () => {
    expect(precheckHeader(ascii('CON\0'))).toEqual([false, [{ kind: 'not-a-package' }]])
  })

  it('checks the magic before the length, so a short file that is not a package says so (R1.8)', () => {
    expect(precheckHeader(ascii('text'))).toEqual([false, [{ kind: 'not-a-package' }]])
  })

  it('treats a PEC, which has no magic, as not a package (R1.26)', () => {
    const pecStart = new Uint8Array(0x1000)
    pecStart.set([0x01, 0xa8], 0) // a PEC starts with its certificate (spec §6.8)
    expect(precheckHeader(pecStart)).toEqual([false, [{ kind: 'not-a-package' }]])
  })

  it('fails with insufficient-bytes when the header size at 0x340 cannot be read (R1.9)', () => {
    expect(precheckHeader(ascii('LIVE'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0x344, got: 4 }]])
    const bytes = buildHeader({ magic: 'LIVE' }).truncate(0x343).bytes()
    expect(precheckHeader(bytes)).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0x344, got: 0x343 }]])
  })

  it('fails with header-size-invalid when the header size is neither 0x971A nor 0xAD0E (R1.10)', () => {
    const bytes = buildHeader({ magic: 'LIVE', headerSize: 0x1234 }).bytes()
    expect(precheckHeader(bytes)).toEqual([false, [{ kind: 'header-size-invalid', declared: 0x1234 }]])
  })

  it('checks the header size once 0x344 bytes are present, before the full length (R1.10)', () => {
    const bytes = buildHeader({ magic: 'LIVE', headerSize: 0xffffffff }).truncate(0x344).bytes()
    expect(precheckHeader(bytes)).toEqual([false, [{ kind: 'header-size-invalid', declared: 0xffffffff }]])
  })

  it('fails with insufficient-bytes when there are fewer bytes than the header size (R1.11)', () => {
    const short971a = buildHeader({ magic: 'CON ', headerSize: 0x971a }).truncate(0x9719).bytes()
    expect(precheckHeader(short971a)).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0x971a, got: 0x9719 }]])
    const shortAd0e = buildHeader({ magic: 'PIRS', headerSize: 0xad0e }).truncate(0xad0d).bytes()
    expect(precheckHeader(shortAd0e)).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0xad0e, got: 0xad0d }]])
  })

  it('passes with exactly the header size, without the padding', () => {
    const bytes = buildHeader({ magic: 'CON ', headerSize: 0x971a }).truncate(0x971a).bytes()
    expect(precheckHeader(bytes)).toEqual([true, { declaredSigning: 'CON', headerSize: 0x971a }])
  })

  it('returns the declared signing without the trailing space of "CON ", and the header size', () => {
    expect(precheckHeader(buildHeader({ magic: 'CON ' }).bytes())).toEqual([true, { declaredSigning: 'CON', headerSize: 0x971a }])
    expect(precheckHeader(buildHeader({ magic: 'LIVE' }).bytes())).toEqual([true, { declaredSigning: 'LIVE', headerSize: 0xad0e }])
    expect(precheckHeader(buildHeader({ magic: 'PIRS' }).bytes())).toEqual([true, { declaredSigning: 'PIRS', headerSize: 0xad0e }])
  })

  it('accepts a CON header of size 0xAD0E', () => {
    const bytes = buildHeader({ magic: 'CON ', headerSize: 0xad0e }).bytes()
    expect(precheckHeader(bytes)).toEqual([true, { declaredSigning: 'CON', headerSize: 0xad0e }])
  })

  it('ignores bytes beyond the header size', () => {
    const bytes = new Uint8Array(0x20000)
    bytes.set(buildHeader({ magic: 'LIVE' }).bytes())
    expect(precheckHeader(bytes)[0]).toBe(true)
  })

  it('passes every real fixture', () => {
    for (const name of FIXTURE_NAMES) {
      const expected = manifest[name]
      expect(precheckHeader(loadFixture(name)), name).toEqual([
        true,
        { declaredSigning: expected.magic.trim(), headerSize: expected.headerSize },
      ])
    }
  })
})
