// Content type names and kinds (docs/lib-design.md, CT1).

import type { PackageKind } from './types.js';

/** Every content type in spec section 4.2, by its 8-hex-digit ID. */
const NAMES: Readonly<Record<string, string>> = {
  '00000001': 'SavedGame',
  '00000002': 'MarketplaceContent',
  '00000003': 'Publisher',
  '00001000': 'Xbox360Title',
  '00002000': 'IPTVPauseBuffer',
  '00003000': 'XNACommunity',
  '00004000': 'InstalledGame',
  '00005000': 'XboxTitle',
  '00006000': 'SocialTitle',
  '00007000': 'GameOnDemand',
  '00008000': 'SUStoragePack',
  '00009000': 'AvatarItem',
  '00010000': 'Profile',
  '00020000': 'GamerPicture',
  '00030000': 'Theme',
  '00040000': 'CacheFile',
  '00050000': 'StorageDownload',
  '00060000': 'XboxSavedGame',
  '00070000': 'XboxDownload',
  '00080000': 'GameDemo',
  '00090000': 'Video',
  '000A0000': 'GameTitle',
  '000B0000': 'Installer',
  '000C0000': 'GameTrailer',
  '000D0000': 'ArcadeTitle',
  '000E0000': 'XNA',
  '000F0000': 'LicenseStore',
  '00100000': 'Movie',
  '00200000': 'TV',
  '00300000': 'MusicVideo',
  '00400000': 'GameVideo',
  '00500000': 'PodcastVideo',
  '00600000': 'ViralVideo',
  '02000000': 'CommunityGame',
};

/** Content types that hold a playable game or app (CT1.3). */
const GAMES = new Set(['00007000', '00004000', '000D0000', '00005000', '00080000', '02000000', '00001000']);

/** The name spec section 4.2 gives a content type, or `Unknown (<ID>)` (CT1.1, CT1.2). */
export function contentTypeName(id: string): string {
  return NAMES[id] ?? `Unknown (${id})`;
}

/** What a package of this content type holds (CT1.3). */
export function packageKind(id: string): PackageKind {
  if (GAMES.has(id)) return 'game';
  if (id === '000B0000') return 'title-update';
  if (id === '00000002') return 'dlc';
  if (id === '00000001') return 'save';
  return 'other';
}
