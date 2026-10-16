// Junk files found in real Content/ trees (design record §3.6): macOS
// AppleDouble files and Chromium swap files.

/** The first 4 bytes of every AppleDouble file. */
export const APPLE_DOUBLE_MAGIC: Uint8Array = Uint8Array.of(0x00, 0x05, 0x16, 0x07);

/**
 * An AppleDouble file, as macOS writes beside files and directories on FAT32:
 * 4 KiB, starting with the magic and version 2 (record §2.4).
 */
export function appleDouble(size = 4096): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(APPLE_DOUBLE_MAGIC.subarray(0, Math.min(size, 4)));
  if (size >= 8) bytes.set([0x00, 0x02, 0x00, 0x00], 4);
  return bytes;
}

/** A file with an AppleDouble-style name but other contents: `clean` must keep it. */
export function fakeAppleDouble(size = 4096): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x50, 0x4b, 0x03, 0x04].slice(0, size));
  return bytes;
}

/** The first 3 bytes of the magic only: too short to be an AppleDouble file. */
export function truncatedAppleDouble(): Uint8Array {
  return APPLE_DOUBLE_MAGIC.slice(0, 3);
}

/** A swap file's contents: anything, since swap files are recognised by name. */
export function swapFile(size = 16): Uint8Array {
  return new Uint8Array(size).fill(0x5a);
}
