import { describe, expect, it } from 'vitest'
import { manifest } from '../../__tests__/fixtures/manifest.js'
import { buildHeader } from '../../__tests__/helpers/header-builder.js'
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js'
import { hexOf, sha1Hex } from '../../__tests__/helpers/sha1.js'
import { parseDeclaredContentType } from '../content-type.js'
import { parseCategory, parseOnlineCreator } from '../creator-and-category.js'
import {
  parseBaseVersion,
  parseDeclaredTitleId,
  parseDiscCount,
  parseDiscNumber,
  parseExecutableType,
  parseMediaId,
  parsePlatform,
  parseSaveGameId,
  parseVersion,
} from '../execution-info.js'
import { parseInstallerMetadata, parseMediaOrAvatarData } from '../extension-data.js'
import { parseFormat } from '../format.js'
import { parseContentId, parseHeaderSize } from '../header-info.js'
import { parseMetadataVersion } from '../metadata-version.js'
import { parseDeclaredSigning } from '../signing.js'
import { parseContentSize, parseDataFileCount, parseDataFilesSize } from '../sizes.js'

const live = () => buildHeader({ magic: 'LIVE' })

describe('parseDeclaredSigning (R1.19)', () => {
  it('returns the magic without the trailing space of "CON "', () => {
    expect(parseDeclaredSigning(buildHeader({ magic: 'CON ' }).bytes())).toBe('CON')
    expect(parseDeclaredSigning(buildHeader({ magic: 'LIVE' }).bytes())).toBe('LIVE')
    expect(parseDeclaredSigning(buildHeader({ magic: 'PIRS' }).bytes())).toBe('PIRS')
  })
})

describe('parseHeaderSize', () => {
  it('returns the header size stored at 0x340', () => {
    expect(parseHeaderSize(buildHeader({ magic: 'CON ', headerSize: 0x971a }).bytes())).toBe(0x971a)
    expect(parseHeaderSize(buildHeader({ magic: 'CON ', headerSize: 0xad0e }).bytes())).toBe(0xad0e)
  })
})

describe('identifiers (R1.15-16)', () => {
  it('returns the content ID as 40 uppercase hex digits', () => {
    const bytes = live().setBytes(0x32c, Array.from({ length: 20 }, (_, i) => i)).bytes()
    expect(parseContentId(bytes)).toBe('000102030405060708090A0B0C0D0E0F10111213')
  })

  it('returns the media ID, Title ID and save game ID as 8 hex digits, keeping leading zeros', () => {
    const bytes = live().setU32(0x354, 0x00abcdef).setU32(0x360, 0x00000001).setU32(0x368, 0x0a0b0c0d).bytes()
    expect(parseMediaId(bytes)).toBe('00ABCDEF')
    expect(parseDeclaredTitleId(bytes)).toBe('00000001')
    expect(parseSaveGameId(bytes)).toBe('0A0B0C0D')
  })

  it('returns the online creator as 16 hex digits', () => {
    const bytes = live().setU64(0x3ad, 0x0009000000000001n).bytes()
    expect(parseOnlineCreator(bytes)).toBe('0009000000000001')
  })

  it('returns all-zero identifiers as zeros of the full width (R1.15)', () => {
    const bytes = live().bytes()
    expect(parseContentId(bytes)).toBe('0'.repeat(40))
    expect(parseDeclaredTitleId(bytes)).toBe('00000000')
    expect(parseOnlineCreator(bytes)).toBe('0000000000000000')
  })
})

describe('numbers (R1.17-18)', () => {
  it('returns the content type as a number, whether or not it is known (R1.18)', () => {
    expect(parseDeclaredContentType(live().setU32(0x344, 0x00007000).bytes())).toBe(0x7000)
    expect(parseDeclaredContentType(live().setU32(0x344, 0xdeadbeef).bytes())).toBe(0xdeadbeef)
  })

  it('returns version, base version, data file count and category as 4-byte numbers', () => {
    const bytes = live().setU32(0x358, 0x20000005).setU32(0x35c, 0x20000001).setU32(0x39d, 22).setU32(0x3b5, 0xffffffff).bytes()
    expect(parseVersion(bytes)).toBe(0x20000005)
    expect(parseBaseVersion(bytes)).toBe(0x20000001)
    expect(parseDataFileCount(bytes)).toBe(22)
    expect(parseCategory(bytes)).toBe(0xffffffff)
  })

  it('returns platform, executable type, disc number and disc count as 1-byte numbers', () => {
    const bytes = live().setBytes(0x364, [2, 1, 3, 4]).bytes()
    expect(parsePlatform(bytes)).toBe(2)
    expect(parseExecutableType(bytes)).toBe(1)
    expect(parseDiscNumber(bytes)).toBe(3)
    expect(parseDiscCount(bytes)).toBe(4)
  })
})

describe('64-bit sizes (the /extended contract, 3)', () => {
  it('returns the content size and combined data file size as exact bigints', () => {
    const bytes = live().setU64(0x34c, 1325899776n).setU64(0x3a1, 0xffffffffffffffffn).bytes()
    expect(parseContentSize(bytes)).toBe(1325899776n)
    expect(parseDataFilesSize(bytes)).toBe(0xffffffffffffffffn)
  })
})

describe('parseMetadataVersion (R1.21-22)', () => {
  it('returns the stored value as declared (R1.21)', () => {
    expect(parseMetadataVersion(live().setU32(0x348, 7).bytes()).declared).toBe(7)
  })

  it('reads 2 as version 2, and any other value as version 1 (R1.22)', () => {
    expect(parseMetadataVersion(buildHeader({ magic: 'LIVE', metadataVersion: 2 }).bytes())).toEqual({ declared: 2, effective: 2 })
    expect(parseMetadataVersion(buildHeader({ magic: 'LIVE', metadataVersion: 0 }).bytes())).toEqual({ declared: 0, effective: 1 })
    expect(parseMetadataVersion(buildHeader({ magic: 'LIVE', metadataVersion: 1 }).bytes())).toEqual({ declared: 1, effective: 1 })
    expect(parseMetadataVersion(buildHeader({ magic: 'LIVE', metadataVersion: 3 }).bytes())).toEqual({ declared: 3, effective: 1 })
  })
})

describe('parseFormat (R1.23-25)', () => {
  it('decodes volume type 0 as STFS and 1 as SVOD (R1.23-24)', () => {
    expect(parseFormat(live().setU32(0x3a9, 0).bytes())).toEqual({ raw: 0, decoded: 'stfs' })
    expect(parseFormat(live().setU32(0x3a9, 1).bytes())).toEqual({ raw: 1, decoded: 'svod' })
  })

  it('decodes any other volume type as unknown, keeping the raw value (R1.24)', () => {
    expect(parseFormat(live().setU32(0x3a9, 5).bytes())).toEqual({ raw: 5, decoded: 'unknown' })
  })

  it('reads the format only from the volume type, never from the content type or magic (R1.25)', () => {
    const godWithStfsVolume = buildHeader({ magic: 'CON ' }).setU32(0x344, 0x7000).setU32(0x3a9, 0).bytes()
    expect(parseFormat(godWithStfsVolume).decoded).toBe('stfs')
  })
})

describe('parseMediaOrAvatarData', () => {
  it('returns a copy of the 0x24 bytes at 0x3D9 in metadata version 2', () => {
    const data = Array.from({ length: 0x24 }, (_, i) => i + 1)
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 2 }).setBytes(0x3d9, data).bytes()
    const result = parseMediaOrAvatarData(bytes)
    expect(result === null ? null : [...result]).toEqual(data)
    bytes[0x3d9] = 0xff
    expect(result?.[0]).toBe(1)
  })

  it('returns null in metadata version 1, where those bytes are unused', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 0 }).setBytes(0x3d9, [1, 2, 3]).bytes()
    expect(parseMediaOrAvatarData(bytes)).toBeNull()
  })
})

describe('parseInstallerMetadata', () => {
  it('returns a copy of the 0x15F4 bytes from 0x971A in a 0xAD0E header', () => {
    const bytes = buildHeader({ magic: 'LIVE', headerSize: 0xad0e }).setBytes(0x971a, [9, 8, 7]).setU8(0xad0d, 0x55).bytes()
    const result = parseInstallerMetadata(bytes)
    expect(result?.length).toBe(0x15f4)
    expect(result === null ? null : [...result.subarray(0, 3)]).toEqual([9, 8, 7])
    expect(result?.[0x15f3]).toBe(0x55)
    bytes[0x971a] = 0
    expect(result?.[0]).toBe(9)
  })

  it('returns null for a 0x971A header, which has no installer metadata', () => {
    expect(parseInstallerMetadata(buildHeader({ magic: 'CON ', headerSize: 0x971a }).bytes())).toBeNull()
  })
})

describe('every scalar parser, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', name => {
    const bytes = loadFixture(name)
    const expected = manifest[name]
    expect(parseDeclaredSigning(bytes)).toBe(expected.magic.trim())
    expect(parseContentId(bytes)).toBe(expected.contentId)
    expect(parseHeaderSize(bytes)).toBe(expected.headerSize)
    expect(parseDeclaredContentType(bytes)).toBe(expected.contentType)
    expect(parseMetadataVersion(bytes).declared).toBe(expected.metadataVersion)
    expect(parseContentSize(bytes)).toBe(expected.contentSize)
    expect(parseMediaId(bytes)).toBe(expected.mediaId)
    expect(parseVersion(bytes)).toBe(expected.version)
    expect(parseBaseVersion(bytes)).toBe(expected.baseVersion)
    expect(parseDeclaredTitleId(bytes)).toBe(expected.titleId)
    expect(parsePlatform(bytes)).toBe(expected.platform)
    expect(parseExecutableType(bytes)).toBe(expected.executableType)
    expect(parseDiscNumber(bytes)).toBe(expected.discNumber)
    expect(parseDiscCount(bytes)).toBe(expected.discCount)
    expect(parseSaveGameId(bytes)).toBe(expected.saveGameId)
    expect(parseDataFileCount(bytes)).toBe(expected.dataFileCount)
    expect(parseDataFilesSize(bytes)).toBe(expected.dataFilesSize)
    expect(parseFormat(bytes).raw).toBe(expected.volumeType)
    expect(parseOnlineCreator(bytes)).toBe(expected.onlineCreator)
    expect(parseCategory(bytes)).toBe(expected.category)

    const mediaOrAvatarData = parseMediaOrAvatarData(bytes)
    if (expected.metadataVersion === 2) {
      expect(mediaOrAvatarData === null ? null : hexOf(mediaOrAvatarData)).toBe(expected.mediaOrAvatarData)
    } else {
      expect(mediaOrAvatarData).toBeNull()
    }

    const installerMetadata = parseInstallerMetadata(bytes)
    expect(installerMetadata === null ? null : sha1Hex(installerMetadata)).toBe(expected.installerMetadataSha1)
  })
})
