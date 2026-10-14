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
