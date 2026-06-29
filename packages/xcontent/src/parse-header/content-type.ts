import type { ContentTypeName } from '../types.js'
import { readUint32BE } from './bytes.js'

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

/** Maps each known ContentTypeName to its 8-character lowercase hex directory name. */
export const CONTENT_TYPE_HEX: ReadonlyMap<ContentTypeName, string> = new Map(
  [...CONTENT_TYPE_MAP.entries()].map(([value, name]) => [name, value.toString(16).padStart(8, '0')])
)

/** Reads the content type uint32 at offset 0x0344 and maps it to a known ContentTypeName (or 'Unknown'). Returns null if the buffer is too short. */
export function parseContentType(bytes: Uint8Array): { value: number; name: ContentTypeName } | null {
  if (bytes.length < 0x0348) return null
  const value = readUint32BE(bytes, 0x0344)
  const name = CONTENT_TYPE_MAP.get(value) ?? 'Unknown'
  return { value, name }
}
