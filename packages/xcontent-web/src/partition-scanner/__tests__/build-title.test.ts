import { describe, it, expect } from 'vitest'
import type { XContentHeader } from 'xcontent'
import { buildTitle } from '../build-title.js'

function makeHeader(overrides: Partial<XContentHeader> = {}): XContentHeader {
  return {
    magic: 'LIVE',
    contentType: 0x00007000,
    contentTypeName: 'GameOnDemand',
    titleId: 0x4D530808,
    titleIdHex: '4D530808',
    metadataVersion: 2,
    displayNames: ['Halo Wars'],
    displayDescriptions: [],
    publisherName: 'Microsoft Studios',
    titleName: 'Halo Wars',
    transferFlags: 0,
    consoleId: null,
    consoleType: null,
    thumbnail: null,
    secondaryThumbnail: null,
    ...overrides,
  }
}

describe('buildTitle', () => {
  it('uses the first non-empty display name as the display name', () => {
    const result = buildTitle('4D530808', [makeHeader({ displayNames: ['Halo Wars'] })], false)
    expect(result.displayName).toBe('Halo Wars')
  })

  it('falls back to titleIdHex when no display names are present', () => {
    const result = buildTitle('4D530808', [makeHeader({ displayNames: [] })], false)
    expect(result.displayName).toBe('4D530808')
  })

  it('falls back to titleIdHex when headers array is empty', () => {
    const result = buildTitle('4D530808', [], false)
    expect(result.displayName).toBe('4D530808')
    expect(result.signingTypes.size).toBe(0)
    expect(result.contentTypes.size).toBe(0)
  })

  it('collects all signing types across headers', () => {
    const headers = [
      makeHeader({ magic: 'LIVE' }),
      makeHeader({ magic: 'CON' }),
    ]
    const result = buildTitle('4D530808', headers, false)
    expect(result.signingTypes).toContain('LIVE')
    expect(result.signingTypes).toContain('CON')
  })

  it('sets gameIsPresent for game format content types', () => {
    expect(buildTitle('01234567', [makeHeader({ contentType: 0x00007000 })], false).gameIsPresent).toBe(true)
    expect(buildTitle('01234567', [makeHeader({ contentType: 0x000D0000 })], false).gameIsPresent).toBe(true)
    expect(buildTitle('01234567', [makeHeader({ contentType: 0x00000001 })], false).gameIsPresent).toBe(false)
  })

  it('sets hasTitleUpdate for Installer content type', () => {
    const result = buildTitle('4D530808', [makeHeader({ contentType: 0x000B0000, contentTypeName: 'Installer' })], false)
    expect(result.hasTitleUpdate).toBe(true)
    expect(result.gameIsPresent).toBe(false)
  })

  it('sets hasDlc for MarketPlaceContent type', () => {
    const result = buildTitle('4D530808', [makeHeader({ contentType: 0x00000002, contentTypeName: 'MarketPlaceContent' })], false)
    expect(result.hasDlc).toBe(true)
  })

  it('sets hasSaves for SavedGame type', () => {
    const result = buildTitle('4D530808', [makeHeader({ contentType: 0x00000001, contentTypeName: 'SavedGame' })], false)
    expect(result.hasSaves).toBe(true)
  })

  it('sets hasOtherContent when none of the categorised types match', () => {
    const result = buildTitle('4D530808', [makeHeader({ contentType: 0x00020000, contentTypeName: 'GamerPicture' })], false)
    expect(result.hasOtherContent).toBe(true)
    expect(result.gameIsPresent).toBe(false)
    expect(result.hasDlc).toBe(false)
  })

  it('propagates hasCorruptContent', () => {
    expect(buildTitle('4D530808', [], true).hasCorruptContent).toBe(true)
    expect(buildTitle('4D530808', [], false).hasCorruptContent).toBe(false)
  })

  it('normalises titleIdHex to uppercase', () => {
    const result = buildTitle('4d530808', [], false)
    expect(result.titleIdHex).toBe('4D530808')
  })
})
