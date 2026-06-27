import type { XContentHeader } from 'xcontent'
import type { TitleXContent } from '../types.js'

const GAME_FORMAT_TYPES = new Set([
  0x00001000, // Xbox360Title
  0x00004000, // InstalledGame
  0x00005000, // XboxOriginalGame
  0x00007000, // GameOnDemand
  0x000D0000, // ArcadeGame
  0x000E0000, // XNA
  0x02000000, // CommunityGame
])

/** Aggregates a set of parsed headers for a single title directory into a TitleXContent summary. */
export function buildTitle(
  titleIdHex: string,
  headers: XContentHeader[],
  hasCorruptContent: boolean,
): TitleXContent {
  const upperHex = titleIdHex.toUpperCase()

  const displayName =
    headers.flatMap(h => h.displayNames).find(n => n.length > 0 && n !== upperHex) ?? upperHex

  const signingTypes = new Set(headers.map(h => h.magic))
  const contentTypes = new Set(headers.map(h => h.contentTypeName))

  const gameIsPresent = headers.some(h => GAME_FORMAT_TYPES.has(h.contentType))
  const hasTitleUpdate = headers.some(h => h.contentType === 0x000B0000)
  const hasDlc = headers.some(h => h.contentType === 0x00000002)
  const hasSaves = headers.some(h => h.contentType === 0x00000001)
  const hasOtherContent = headers.some(
    h =>
      !GAME_FORMAT_TYPES.has(h.contentType) &&
      h.contentType !== 0x000B0000 &&
      h.contentType !== 0x00000002 &&
      h.contentType !== 0x00000001,
  )

  return {
    titleId: parseInt(upperHex, 16),
    titleIdHex: upperHex,
    displayName,
    signingTypes,
    contentTypes,
    gameIsPresent,
    hasTitleUpdate,
    hasDlc,
    hasSaves,
    hasOtherContent,
    hasCorruptContent,
  }
}
