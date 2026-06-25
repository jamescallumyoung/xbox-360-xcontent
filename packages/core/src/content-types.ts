import type { ContentTypeName } from './types.js'

const CONTENT_TYPE_MAP: ReadonlyMap<number, ContentTypeName> = new Map([
  [0x00000001, 'SavedGame'],
  [0x00000002, 'MarketPlaceContent'],
  [0x00000003, 'Publisher'],
  [0x00001000, 'Xbox360Title'],
  [0x00002000, 'IPTVPauseBuffer'],
  [0x00004000, 'InstalledGame'],
  [0x00005000, 'XboxOriginalGame'],
  [0x00007000, 'GameOnDemand'],
  [0x00008000, 'AvatarAssetPack'],
  [0x00009000, 'AvatarItem'],
  [0x00010000, 'Profile'],
  [0x00020000, 'GamerPicture'],
  [0x00030000, 'Theme'],
  [0x00040000, 'CacheFile'],
  [0x00050000, 'StorageDownload'],
  [0x00060000, 'XboxSavedGame'],
  [0x00070000, 'XboxDownload'],
  [0x00080000, 'GameDemo'],
  [0x000A0000, 'GamerTitle'],
  [0x000B0000, 'Installer'],
  [0x000C0000, 'GameTrailer'],
  [0x000D0000, 'ArcadeGame'],
  [0x000E0000, 'XNA'],
  [0x000F0000, 'LicenseStore'],
  [0x00100000, 'Movie'],
  [0x00200000, 'Video'],
  [0x00300000, 'MusicVideo'],
  [0x00400000, 'GameVideo'],
  [0x00500000, 'PodcastVideo'],
  [0x00600000, 'ViralVideo'],
  [0x02000000, 'CommunityGame'],
])

const GAME_FORMAT_VALUES: ReadonlySet<number> = new Set([
  0x00001000, // Xbox360Title
  0x00004000, // InstalledGame
  0x00005000, // XboxOriginalGame
  0x00007000, // GameOnDemand
  0x000D0000, // ArcadeGame
  0x000E0000, // XNA
  0x02000000, // CommunityGame
])

const FLAGGED_VALUES = {
  titleUpdate: 0x000B0000,
  dlc: 0x00000002,
  saves: 0x00000001,
} as const

export function getContentTypeName(value: number): ContentTypeName {
  return CONTENT_TYPE_MAP.get(value) ?? 'Unknown'
}

export function isGameFormat(value: number): boolean {
  return GAME_FORMAT_VALUES.has(value)
}

export function isTitleUpdate(value: number): boolean {
  return value === FLAGGED_VALUES.titleUpdate
}

export function isDlc(value: number): boolean {
  return value === FLAGGED_VALUES.dlc
}

export function isSave(value: number): boolean {
  return value === FLAGGED_VALUES.saves
}
