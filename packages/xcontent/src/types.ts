export type SigningMagic = 'CON' | 'LIVE' | 'PIRS'

export type ContentTypeName =
  | 'SavedGame'
  | 'MarketPlaceContent'
  | 'Publisher'
  | 'Xbox360Title'
  | 'IPTVPauseBuffer'
  | 'InstalledGame'
  | 'XboxOriginalGame'
  | 'GameOnDemand'
  | 'AvatarAssetPack'
  | 'AvatarItem'
  | 'Profile'
  | 'GamerPicture'
  | 'Theme'
  | 'CacheFile'
  | 'StorageDownload'
  | 'XboxSavedGame'
  | 'XboxDownload'
  | 'GameDemo'
  | 'GamerTitle'
  | 'Installer'
  | 'GameTrailer'
  | 'ArcadeGame'
  | 'XNA'
  | 'LicenseStore'
  | 'Movie'
  | 'Video'
  | 'MusicVideo'
  | 'GameVideo'
  | 'PodcastVideo'
  | 'ViralVideo'
  | 'CommunityGame'
  | 'Unknown'

export type XContentHeader = {
  magic: SigningMagic
  contentType: number
  contentTypeName: ContentTypeName
  titleId: number
  titleIdHex: string
  metadataVersion: number
  displayNames: string[]
  displayDescriptions: string[]
  publisherName: string
  titleName: string
  transferFlags: number
  consoleId: string | null        // null for non-CON content
  consoleType: 'devkit' | 'retail' | null  // null for non-CON content
  thumbnail: Uint8Array | null           // null when no valid thumbnail image is found
  secondaryThumbnail: Uint8Array | null  // null when no valid secondary thumbnail is found
}
