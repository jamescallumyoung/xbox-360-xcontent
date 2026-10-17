// A test-only builder for package headers that `parseHeader` accepts, using the
// offsets in docs/xcontent-specification.md §6, never the library's own.

export interface HeaderOptions {
  /** Default `LIVE`. `CON ` builds a 0x971A header, the others 0xAD0E (§6.1). */
  magic?: 'CON ' | 'LIVE' | 'PIRS';
  /** Default 0x00007000. */
  contentType?: number;
  /** 8 hex digits. Default `4D5307E6`. */
  titleId?: string;
  /** 0 for STFS, 1 for SVOD. Default 0. */
  format?: 0 | 1;
  /** The combined size of the data files, for SVOD. */
  dataFilesSize?: number;
  /** The English display name (slot 0). */
  displayName?: string;
  titleName?: string;
  publisher?: string;
  /** 40 hex digits. Default all `AB`. */
  contentId?: string;
  thumbnail?: Uint8Array;
  titleThumbnail?: Uint8Array;
  /** Default 0x971A for `CON `, 0xAD0E otherwise; real headers don't always follow that (§6.1). */
  headerSize?: 0x971a | 0xad0e;
  /** The stored metadata version: 0 (version 1) or 2. Default 2. */
  metadataVersion?: 0 | 2;
}

function utf16(bytes: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    bytes[offset + i * 2] = unit >> 8;
    bytes[offset + i * 2 + 1] = unit & 0xff;
  }
}

/** A whole header, padded as on disk: 0xA000 bytes for `CON `, 0xB000 otherwise. */
export function header(options: HeaderOptions = {}): Uint8Array<ArrayBuffer> {
  const { magic = 'LIVE', contentType = 0x7000, titleId = '4D5307E6', format = 0 } = options;
  const headerSize = options.headerSize ?? (magic === 'CON ' ? 0x971a : 0xad0e);
  const bytes = new Uint8Array(headerSize === 0x971a ? 0xa000 : 0xb000);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < 4; i++) bytes[i] = magic.charCodeAt(i);
  const contentId = options.contentId ?? 'AB'.repeat(20);
  for (let i = 0; i < 20; i++) bytes[0x32c + i] = parseInt(contentId.slice(i * 2, i * 2 + 2), 16);
  view.setUint32(0x340, headerSize);
  view.setUint32(0x344, contentType);
  view.setUint32(0x348, options.metadataVersion ?? 2);
  view.setUint32(0x360, parseInt(titleId, 16));
  view.setBigUint64(0x3a1, BigInt(options.dataFilesSize ?? 0));
  view.setUint32(0x3a9, format);
  if (options.displayName !== undefined) utf16(bytes, 0x411, options.displayName);
  if (options.publisher !== undefined) utf16(bytes, 0x1611, options.publisher);
  if (options.titleName !== undefined) utf16(bytes, 0x1691, options.titleName);
  if (options.thumbnail !== undefined) {
    view.setUint32(0x1712, options.thumbnail.length);
    bytes.set(options.thumbnail, 0x171a);
  }
  if (options.titleThumbnail !== undefined) {
    view.setUint32(0x1716, options.titleThumbnail.length);
    bytes.set(options.titleThumbnail, 0x571a);
  }
  return bytes;
}
