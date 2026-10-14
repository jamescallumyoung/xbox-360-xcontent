// Where things are in a header (spec §6). Offsets are from the start of the
// header; constants are added here as the parsers need them.

/** The magic: 4 bytes at 0x000 (§6.2). */
export const MAGIC_OFFSET = 0x000
export const MAGIC_LENGTH = 4

/** The header size: 4 bytes at 0x340 (§6.3). Reading it needs the first 0x344 bytes. */
export const HEADER_SIZE_OFFSET = 0x340
export const HEADER_SIZE_END = 0x344

/** The two valid header sizes (§6.1). */
export const HEADER_SIZE_STANDARD = 0x971a
export const HEADER_SIZE_INSTALLER = 0xad0e

/** The padded length of each header size: the next 4 KiB boundary (§6.1). */
export const PADDED_LENGTH_STANDARD = 0xa000
export const PADDED_LENGTH_INSTALLER = 0xb000

/** The content ID: 20 bytes at 0x32C (§6.3). */
export const CONTENT_ID_OFFSET = 0x32c
export const CONTENT_ID_LENGTH = 0x14

/** Metadata fields (§6.4). Lengths are in bytes. */
export const CONTENT_TYPE_OFFSET = 0x344
export const METADATA_VERSION_OFFSET = 0x348
export const CONTENT_SIZE_OFFSET = 0x34c
export const MEDIA_ID_OFFSET = 0x354
export const MEDIA_ID_LENGTH = 4
export const VERSION_OFFSET = 0x358
export const BASE_VERSION_OFFSET = 0x35c
export const TITLE_ID_OFFSET = 0x360
export const TITLE_ID_LENGTH = 4
export const PLATFORM_OFFSET = 0x364
export const EXECUTABLE_TYPE_OFFSET = 0x365
export const DISC_NUMBER_OFFSET = 0x366
export const DISC_COUNT_OFFSET = 0x367
export const SAVE_GAME_ID_OFFSET = 0x368
export const SAVE_GAME_ID_LENGTH = 4
export const DATA_FILE_COUNT_OFFSET = 0x39d
export const DATA_FILES_SIZE_OFFSET = 0x3a1
export const VOLUME_TYPE_OFFSET = 0x3a9
export const ONLINE_CREATOR_OFFSET = 0x3ad
export const ONLINE_CREATOR_LENGTH = 8
export const CATEGORY_OFFSET = 0x3b5

/** Media or avatar asset data: 0x24 bytes at 0x3D9, used only in metadata version 2 (§6.1, §6.4). */
export const MEDIA_OR_AVATAR_DATA_OFFSET = 0x3d9
export const MEDIA_OR_AVATAR_DATA_LENGTH = 0x24

/** Installer metadata: from 0x971A to the end of a 0xAD0E header (§6.1). */
export const INSTALLER_METADATA_OFFSET = 0x971a
export const INSTALLER_METADATA_LENGTH = 0x15f4 // 0xAD0E - 0x971A
