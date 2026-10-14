// The shape of each entry in manifest.ts: the expected values for one fixture,
// computed from its raw bytes by generate_manifest.py (not by package code).
//
// Raw values are recorded as stored. Hex strings are uppercase with no prefix.
// SHA-1 hashes of byte blocks are lowercase.

export interface ManifestThumbnail {
  /** The declared size. */
  size: number
  /** SHA-1 of the declared number of bytes from the image's offset. */
  sha1: string
}

export interface ManifestLicence {
  /** The top 16 bits of the licensee ID. */
  licenseeType: number
  /** The low 48 bits of the licensee ID, as 12 hex digits. */
  licenseeData: string
  bits: number
  flags: number
}

export interface ManifestCertificate {
  publicKeyCertificateSize: number
  ownerConsoleId: string
  /** ASCII text up to the first 0x00 byte. */
  consolePartNumber: string
  consoleType: number
  /** ASCII text up to the first 0x00 byte. */
  certificateDate: string
  publicExponent: number
  publicModulusSha1: string
  certificateSignatureSha1: string
}

export interface ManifestEntry {
  /** What the fixture is, and what it covers. */
  description: string
  fileLength: number
  magic: 'CON ' | 'LIVE' | 'PIRS'
  /** True when the signature is all zero bytes (0x004–0x103, or 0x1AC–0x22B for CON). */
  signatureAllZero: boolean
  certificate: ManifestCertificate | null
  licences: ManifestLicence[]
  contentId: string
  /** True when the content ID equals the SHA-1 of 0x344 up to the padded header end. */
  contentIdMatchesHash: boolean
  headerSize: number
  contentType: number
  metadataVersion: number
  contentSize: bigint
  mediaId: string
  version: number
  baseVersion: number
  titleId: string
  platform: number
  executableType: number
  discNumber: number
  discCount: number
  saveGameId: string
  creatorConsoleId: string
  profileId: string
  /** The volume descriptor's first byte (its length). */
  volumeDescriptorLength: number
  dataFileCount: number
  dataFilesSize: bigint
  volumeType: number
  onlineCreator: string
  category: number
  reservedAllZero: boolean
  /** The 0x24 bytes at 0x3D9, as hex. */
  mediaOrAvatarData: string
  deviceId: string
  /** One entry per language slot: 9, or 12 when the stored metadata version is 2. */
  displayNames: (string | null)[]
  descriptions: (string | null)[]
  publisherName: string | null
  titleName: string | null
  transferFlags: number
  thumbnail: ManifestThumbnail | null
  titleThumbnail: ManifestThumbnail | null
  /** SHA-1 of 0x971A–0xAD0D, or null for a 0x971A header. */
  installerMetadataSha1: string | null
}
