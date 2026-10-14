// Where things are in a header (spec §6). Offsets are from the start of the
// header; constants are added here as the parsers need them.

/** The magic: 4 bytes at 0x000 (§6.2). */
export const MAGIC_OFFSET = 0x000;
export const MAGIC_LENGTH = 4;

/** The header size: 4 bytes at 0x340 (§6.3). Reading it needs the first 0x344 bytes. */
export const HEADER_SIZE_OFFSET = 0x340;
export const HEADER_SIZE_END = 0x344;

/** The two valid header sizes (§6.1). */
export const HEADER_SIZE_STANDARD = 0x971a;
export const HEADER_SIZE_INSTALLER = 0xad0e;

/** The padded length of each header size: the next 4 KiB boundary (§6.1). */
export const PADDED_LENGTH_STANDARD = 0xa000;
export const PADDED_LENGTH_INSTALLER = 0xb000;

/** The content ID: 20 bytes at 0x32C (§6.3). */
export const CONTENT_ID_OFFSET = 0x32c;
export const CONTENT_ID_LENGTH = 0x14;

/** Metadata fields (§6.4). Lengths are in bytes. */
export const CONTENT_TYPE_OFFSET = 0x344;
export const METADATA_VERSION_OFFSET = 0x348;
export const CONTENT_SIZE_OFFSET = 0x34c;
export const MEDIA_ID_OFFSET = 0x354;
export const MEDIA_ID_LENGTH = 4;
export const VERSION_OFFSET = 0x358;
export const BASE_VERSION_OFFSET = 0x35c;
export const TITLE_ID_OFFSET = 0x360;
export const TITLE_ID_LENGTH = 4;
export const PLATFORM_OFFSET = 0x364;
export const EXECUTABLE_TYPE_OFFSET = 0x365;
export const DISC_NUMBER_OFFSET = 0x366;
export const DISC_COUNT_OFFSET = 0x367;
export const SAVE_GAME_ID_OFFSET = 0x368;
export const SAVE_GAME_ID_LENGTH = 4;
export const DATA_FILE_COUNT_OFFSET = 0x39d;
export const DATA_FILES_SIZE_OFFSET = 0x3a1;
export const VOLUME_TYPE_OFFSET = 0x3a9;
export const ONLINE_CREATOR_OFFSET = 0x3ad;
export const ONLINE_CREATOR_LENGTH = 8;
export const CATEGORY_OFFSET = 0x3b5;

/** Media or avatar asset data: 0x24 bytes at 0x3D9, used only in metadata version 2 (§6.1, §6.4). */
export const MEDIA_OR_AVATAR_DATA_OFFSET = 0x3d9;
export const MEDIA_OR_AVATAR_DATA_LENGTH = 0x24;

/** Installer metadata: from 0x971A to the end of a 0xAD0E header (§6.1). */
export const INSTALLER_METADATA_OFFSET = 0x971a;
export const INSTALLER_METADATA_LENGTH = 0x15f4; // 0xAD0E - 0x971A

/** Display names and descriptions: 9 slots of 0x100 bytes, plus 3 more in metadata version 2 (§6.5). */
export const LANGUAGE_SLOT_LENGTH = 0x100;
export const BASE_LANGUAGE_SLOTS = 9;
export const EXTRA_LANGUAGE_SLOTS = 3;
export const DISPLAY_NAMES_OFFSET = 0x411;
export const DESCRIPTIONS_OFFSET = 0xd11;
export const EXTRA_DISPLAY_NAMES_OFFSET = 0x541a;
export const EXTRA_DESCRIPTIONS_OFFSET = 0x941a;

/** Publisher name and title name: 0x80 bytes each (§6.4). */
export const PUBLISHER_NAME_OFFSET = 0x1611;
export const TITLE_NAME_OFFSET = 0x1691;
export const NAME_FIELD_LENGTH = 0x80;

/** Thumbnails: a 4-byte size, then the image in its space (§6.4, §6.5). */
export const THUMBNAIL_SIZE_OFFSET = 0x1712;
export const TITLE_THUMBNAIL_SIZE_OFFSET = 0x1716;
export const THUMBNAIL_OFFSET = 0x171a;
export const TITLE_THUMBNAIL_OFFSET = 0x571a;
export const THUMBNAIL_SPACE_V1 = 0x4000;
export const THUMBNAIL_SPACE_V2 = 0x3d00;

/** Licences: 16 entries of 0x10 bytes from 0x22C (§6.3). */
export const LICENCES_OFFSET = 0x22c;
export const LICENCE_COUNT = 16;
export const LICENCE_LENGTH = 0x10;

/** Transfer flags: 1 byte at 0x1711 (§6.4). */
export const TRANSFER_FLAGS_OFFSET = 0x1711;

/** The IDs that tie a package to a console, a profile and a storage device (§6.4). */
export const CREATOR_CONSOLE_ID_OFFSET = 0x36c;
export const CREATOR_CONSOLE_ID_LENGTH = 5;
export const PROFILE_ID_OFFSET = 0x371;
export const PROFILE_ID_LENGTH = 8;
export const DEVICE_ID_OFFSET = 0x3fd;
export const DEVICE_ID_LENGTH = 0x14;

/** A CON package's console certificate (§6.2). */
export const PUBLIC_KEY_CERTIFICATE_SIZE_OFFSET = 0x004;
export const OWNER_CONSOLE_ID_OFFSET = 0x006;
export const OWNER_CONSOLE_ID_LENGTH = 5;
export const CONSOLE_PART_NUMBER_OFFSET = 0x00b;
export const CONSOLE_PART_NUMBER_LENGTH = 0x14;
export const CONSOLE_TYPE_OFFSET = 0x01f;
export const CERTIFICATE_DATE_OFFSET = 0x020;
export const CERTIFICATE_DATE_LENGTH = 8;
export const PUBLIC_EXPONENT_OFFSET = 0x028;
export const PUBLIC_MODULUS_OFFSET = 0x02c;
export const PUBLIC_MODULUS_LENGTH = 0x80;
export const CERTIFICATE_SIGNATURE_OFFSET = 0x0ac;
export const CERTIFICATE_SIGNATURE_LENGTH = 0x100;

/** The signature: a CON package's own signature after its certificate, or Microsoft's for LIVE and PIRS (§6.2). */
export const CON_SIGNATURE_OFFSET = 0x1ac;
export const CON_SIGNATURE_LENGTH = 0x80;
export const MICROSOFT_SIGNATURE_OFFSET = 0x004;
export const MICROSOFT_SIGNATURE_LENGTH = 0x100;
