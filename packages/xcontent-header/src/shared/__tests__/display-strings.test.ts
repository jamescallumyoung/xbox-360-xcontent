import { describe, expect, it } from 'vitest'
import { manifest } from '../../__tests__/fixtures/manifest.js'
import { buildHeader } from '../../__tests__/helpers/header-builder.js'
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js'
import { parseDescriptions, parseDisplayNames, parsePublisherName, parseTitleName } from '../display-strings.js'

describe('parseDisplayNames and parseDescriptions (R1.32-34)', () => {
  it('return 9 slots in metadata version 1, and 12 in version 2 (R1.32)', () => {
    expect(parseDisplayNames(buildHeader({ magic: 'LIVE', metadataVersion: 0 }).bytes())).toHaveLength(9)
    expect(parseDescriptions(buildHeader({ magic: 'LIVE', metadataVersion: 0 }).bytes())).toHaveLength(9)
    expect(parseDisplayNames(buildHeader({ magic: 'LIVE', metadataVersion: 2 }).bytes())).toHaveLength(12)
    expect(parseDescriptions(buildHeader({ magic: 'LIVE', metadataVersion: 2 }).bytes())).toHaveLength(12)
  })

  it('read slots 0-8 from 0x100-byte slots at 0x411 and 0xD11 (R1.33)', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 0 })
      .setUtf16(0x411, 'English')
      .setUtf16(0x411 + 8 * 0x100, 'Portuguese')
      .setUtf16(0xd11, 'An English description')
      .bytes()
    const names = parseDisplayNames(bytes)
    expect(names[0]).toBe('English')
    expect(names[8]).toBe('Portuguese')
    expect(parseDescriptions(bytes)[0]).toBe('An English description')
  })

  it('read slots 9-11 from 0x541A and 0x941A in metadata version 2 (R1.34)', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 2 })
      .setUtf16(0x541a, 'Slot 9')
      .setUtf16(0x541a + 0x100, 'Polish')
      .setUtf16(0x541a + 0x200, 'Russian')
      .setUtf16(0x941a + 0x200, 'A Russian description')
      .bytes()
    expect(parseDisplayNames(bytes).slice(9)).toEqual(['Slot 9', 'Polish', 'Russian'])
    expect(parseDescriptions(bytes)[11]).toBe('A Russian description')
  })

  it('keep empty slots as null, so every value stays at its slot index (R1.32)', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 2 }).setUtf16(0x411 + 3 * 0x100, 'French').bytes()
    const names = parseDisplayNames(bytes)
    expect(names[3]).toBe('French')
    expect(names.filter(name => name !== null)).toEqual(['French'])
  })

  it('ignore the extra slots in metadata version 1, where those bytes are thumbnail space', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 0 }).setUtf16(0x541a, 'Not a name').bytes()
    expect(parseDisplayNames(bytes)).not.toContain('Not a name')
  })
})

describe('parsePublisherName and parseTitleName (R1.28-29)', () => {
  it('read 0x80-byte fields at 0x1611 and 0x1691', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setUtf16(0x1611, 'Microsoft').setUtf16(0x1691, 'Halo 3').bytes()
    expect(parsePublisherName(bytes)).toBe('Microsoft')
    expect(parseTitleName(bytes)).toBe('Halo 3')
  })

  it('use the full 64 code units when there is no terminator (R1.28)', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setUtf16(0x1611, 'P'.repeat(64)).setUtf16(0x1691, 'T'.repeat(64)).bytes()
    expect(parsePublisherName(bytes)).toBe('P'.repeat(64))
    expect(parseTitleName(bytes)).toBe('T'.repeat(64))
  })

  it('return null for empty fields (R1.29)', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).bytes()
    expect(parsePublisherName(bytes)).toBeNull()
    expect(parseTitleName(bytes)).toBeNull()
  })
})

describe('display strings, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', name => {
    const bytes = loadFixture(name)
    const expected = manifest[name]
    expect(parseDisplayNames(bytes)).toEqual(expected.displayNames)
    expect(parseDescriptions(bytes)).toEqual(expected.descriptions)
    expect(parsePublisherName(bytes)).toBe(expected.publisherName)
    expect(parseTitleName(bytes)).toBe(expected.titleName)
  })

  it('decode non-ASCII names', () => {
    expect(parseDisplayNames(loadFixture('live-stfs-dlc-non-ascii'))[0]).toBe('Mass Effect\u2122 3: Extended Cut')
    expect(parseDisplayNames(loadFixture('live-stfs-mv0-title-update'))[0]).toBe('Far Cry\u00AE 3 Title Update')
    expect(parseDisplayNames(loadFixture('pirs-stfs-dlc-non-ascii'))[0]).toBe('Claptrap\u2019s New Robot Revolution')
  })

  it("return South Park's Polish and Russian names in slots 10 and 11, as stored (R1.31, R1.34)", () => {
    const names = parseDisplayNames(loadFixture('live-svod-god-south-park-mojibake'))
    const expected = manifest['live-svod-god-south-park-mojibake'].displayNames
    expect(names[10]).toBe(expected[10])
    expect(names[11]).toBe(expected[11])
  })
})
