import { describe, expect, it } from 'vitest'
import { manifest } from '../../__tests__/fixtures/manifest.js'
import { buildHeader } from '../../__tests__/helpers/header-builder.js'
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js'
import { hexOf, sha1Hex } from '../../__tests__/helpers/sha1.js'
import type { Header } from '../parse-header.js'
import { parseHeader } from '../parse-header.js'

const ascii = (text: string): Uint8Array => Uint8Array.from(text, c => c.charCodeAt(0))

/** Returns the header, failing the test if parsing failed. */
const parsed = (bytes: Uint8Array): Header => {
  const [ok, value] = parseHeader(bytes)
  if (!ok) throw new Error(`parseHeader failed: ${JSON.stringify(value)}`)
  return value
}

describe('parseHeader: result (R1.1-3)', () => {
  it('returns [true, header] on success (R1.1)', () => {
    const [ok, header] = parseHeader(buildHeader({ magic: 'LIVE' }).bytes())
    expect(ok).toBe(true)
    expect(header).toMatchObject({ declaredSigning: 'LIVE', headerSize: 0xad0e })
  })

  it('returns exactly one reason when a pre-check fails, and parses nothing (R1.2)', () => {
    expect(parseHeader(ascii('LIV'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 4, got: 3 }]])
    expect(parseHeader(ascii('text'))).toEqual([false, [{ kind: 'not-a-package' }]])
  })
})

describe('parseHeader: pre-checks (R1.7-11)', () => {
  it('runs the shared pre-checks in order', () => {
    expect(parseHeader(ascii('LIVE'))).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0x344, got: 4 }]])
    const badSize = buildHeader({ magic: 'LIVE', headerSize: 0x1234 }).bytes()
    expect(parseHeader(badSize)).toEqual([false, [{ kind: 'header-size-invalid', declared: 0x1234 }]])
    const short = buildHeader({ magic: 'LIVE' }).truncate(0xad0d).bytes()
    expect(parseHeader(short)).toEqual([false, [{ kind: 'insufficient-bytes', needed: 0xad0e, got: 0xad0d }]])
  })

  it('needs only the header size, not the padding (R1.4)', () => {
    expect(parseHeader(buildHeader({ magic: 'LIVE' }).truncate(0xad0e).bytes())[0]).toBe(true)
    expect(parseHeader(buildHeader({ magic: 'CON ' }).truncate(0x971a).bytes())[0]).toBe(true)
  })

  it('ignores bytes beyond the header size (R1.5)', () => {
    const bytes = new Uint8Array(0x20000)
    bytes.set(buildHeader({ magic: 'LIVE' }).bytes())
    bytes.fill(0xff, 0xb000)
    expect(parseHeader(bytes)[0]).toBe(true)
  })
})

describe('parseHeader: failures while parsing (R1.12-14)', () => {
  it('fails when the content size exceeds Number.MAX_SAFE_INTEGER, giving the exact raw value (R1.12)', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU64(0x34c, 0x0020000000000000n).bytes()
    expect(parseHeader(bytes)).toEqual([false, [
      { kind: 'value-exceeds-max-safe-integer', field: 'contentSize', raw: '0x0020000000000000' },
    ]])
  })

  it('fails when the combined data file size exceeds Number.MAX_SAFE_INTEGER (R1.12)', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU64(0x3a1, 0xffffffffffffffffn).bytes()
    expect(parseHeader(bytes)).toEqual([false, [
      { kind: 'value-exceeds-max-safe-integer', field: 'dataFilesSize', raw: '0xFFFFFFFFFFFFFFFF' },
    ]])
  })

  it('accepts a size of exactly Number.MAX_SAFE_INTEGER', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU64(0x34c, BigInt(Number.MAX_SAFE_INTEGER)).bytes()
    expect(parsed(bytes).contentSize).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('gives a raw value BigInt can read exactly (R1.12)', () => {
    const [, reasons] = parseHeader(buildHeader({ magic: 'LIVE' }).setU64(0x34c, 0x0123456789abcdefn).bytes())
    const reason = Array.isArray(reasons) ? reasons[0] : undefined
    expect(reason?.kind === 'value-exceeds-max-safe-integer' && BigInt(reason.raw)).toBe(0x0123456789abcdefn)
  })

  it('fails when a thumbnail is larger than its space: 0x4000 in version 1 (R1.13)', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 0 }).setU32(0x1712, 0x4001).bytes()
    expect(parseHeader(bytes)).toEqual([false, [
      { kind: 'value-out-of-range', field: 'thumbnail', declaredSize: 0x4001, availableSpace: 0x4000 },
    ]])
  })

  it('fails when a title thumbnail is larger than its space: 0x3D00 in version 2 (R1.13)', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 2 }).setU32(0x1716, 0x3d01).bytes()
    expect(parseHeader(bytes)).toEqual([false, [
      { kind: 'value-out-of-range', field: 'titleThumbnail', declaredSize: 0x3d01, availableSpace: 0x3d00 },
    ]])
  })

  it('accepts thumbnails that exactly fill their space', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 2 }).setU32(0x1712, 0x3d00).setU32(0x1716, 0x3d00).bytes()
    expect(parseHeader(bytes)[0]).toBe(true)
  })

  it('reports every field that fails, of both kinds (R1.14)', () => {
    const bytes = buildHeader({ magic: 'LIVE' })
      .setU64(0x34c, 0xffffffffffffffffn)
      .setU64(0x3a1, 0xffffffffffffffffn)
      .setU32(0x1712, 0xffffffff)
      .setU32(0x1716, 0x4000)
      .bytes()
    const [ok, reasons] = parseHeader(bytes)
    expect(ok).toBe(false)
    expect(reasons).toEqual(expect.arrayContaining([
      { kind: 'value-exceeds-max-safe-integer', field: 'contentSize', raw: '0xFFFFFFFFFFFFFFFF' },
      { kind: 'value-exceeds-max-safe-integer', field: 'dataFilesSize', raw: '0xFFFFFFFFFFFFFFFF' },
      { kind: 'value-out-of-range', field: 'thumbnail', declaredSize: 0xffffffff, availableSpace: 0x3d00 },
      { kind: 'value-out-of-range', field: 'titleThumbnail', declaredSize: 0x4000, availableSpace: 0x3d00 },
    ]))
    expect(reasons).toHaveLength(4)
  })

  it('never returns a partial header (R1.1)', () => {
    const [ok, value] = parseHeader(buildHeader({ magic: 'LIVE' }).setU32(0x1712, 0xffffffff).bytes())
    expect(ok).toBe(false)
    expect(value).not.toHaveProperty('declaredSigning')
  })
})

describe('parseHeader: values', () => {
  it('returns sizes as numbers (R1.17)', () => {
    const header = parsed(buildHeader({ magic: 'LIVE' }).setU64(0x34c, 1325899776n).setU64(0x3a1, 3683106816n).bytes())
    expect(header.contentSize).toBe(1325899776)
    expect(header.dataFilesSize).toBe(3683106816)
  })

  it('does not change if the input changes after the call (R1.6)', () => {
    const bytes = buildHeader({ magic: 'LIVE' })
      .setUtf16(0x411, 'Name')
      .setU32(0x1712, 4)
      .setBytes(0x171a, [0x89, 0x50, 0x4e, 0x47])
      .bytes()
    const header = parsed(bytes)
    bytes.fill(0)
    expect(header.displayNames[0]).toBe('Name')
    expect([...(header.thumbnail ?? [])]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('does not return the signature, licences, IDs, volume descriptor or reserved bytes (R1.42)', () => {
    const header = parsed(buildHeader({ magic: 'CON ' }).bytes())
    for (const key of ['signature', 'certificate', 'licences', 'transferFlags', 'creatorConsoleId', 'profileId', 'deviceId', 'volumeDescriptor', 'reserved']) {
      expect(header).not.toHaveProperty(key)
    }
  })

  it('returns exactly the documented properties', () => {
    expect(Object.keys(parsed(buildHeader({ magic: 'LIVE' }).bytes())).sort()).toEqual([
      'baseVersion', 'category', 'contentId', 'contentSize', 'dataFileCount', 'dataFilesSize',
      'declaredContentType', 'declaredSigning', 'declaredTitleId', 'descriptions', 'discCount', 'discNumber',
      'displayNames', 'executableType', 'format', 'headerSize', 'installerMetadata', 'mediaId',
      'mediaOrAvatarData', 'metadataVersion', 'onlineCreator', 'platform', 'publisherName', 'saveGameId',
      'thumbnail', 'titleName', 'titleThumbnail', 'version',
    ])
  })
})

describe('parseHeader, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', name => {
    const expected = manifest[name]
    const header = parsed(loadFixture(name))
    const { mediaOrAvatarData, thumbnail, titleThumbnail, installerMetadata, ...rest } = header
    expect(rest).toEqual({
      declaredSigning: expected.magic.trim(),
      contentId: expected.contentId,
      headerSize: expected.headerSize,
      declaredContentType: expected.contentType,
      metadataVersion: { declared: expected.metadataVersion, effective: expected.metadataVersion === 2 ? 2 : 1 },
      contentSize: Number(expected.contentSize),
      mediaId: expected.mediaId,
      version: expected.version,
      baseVersion: expected.baseVersion,
      declaredTitleId: expected.titleId,
      platform: expected.platform,
      executableType: expected.executableType,
      discNumber: expected.discNumber,
      discCount: expected.discCount,
      saveGameId: expected.saveGameId,
      dataFileCount: expected.dataFileCount,
      dataFilesSize: Number(expected.dataFilesSize),
      format: { raw: expected.volumeType, decoded: ['stfs', 'svod'][expected.volumeType] ?? 'unknown' },
      onlineCreator: expected.onlineCreator,
      category: expected.category,
      displayNames: expected.displayNames,
      descriptions: expected.descriptions,
      publisherName: expected.publisherName,
      titleName: expected.titleName,
    })

    // Byte fields are compared by content.
    const bytesOrNull = (bytes: Uint8Array | null, describe: (b: Uint8Array) => unknown) => (bytes === null ? null : describe(bytes))
    expect(bytesOrNull(mediaOrAvatarData, hexOf)).toBe(expected.metadataVersion === 2 ? expected.mediaOrAvatarData : null)
    expect(bytesOrNull(thumbnail, b => ({ size: b.length, sha1: sha1Hex(b) }))).toEqual(expected.thumbnail)
    expect(bytesOrNull(titleThumbnail, b => ({ size: b.length, sha1: sha1Hex(b) }))).toEqual(expected.titleThumbnail)
    expect(bytesOrNull(installerMetadata, sha1Hex)).toBe(expected.installerMetadataSha1)
  })
})
