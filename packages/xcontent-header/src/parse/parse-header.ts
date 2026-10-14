import { parseDeclaredContentType } from '../shared/content-type.js';
import { parseCategory, parseOnlineCreator } from '../shared/creator-and-category.js';
import { parseDescriptions, parseDisplayNames, parsePublisherName, parseTitleName } from '../shared/display-strings.js';
import {
  parseBaseVersion,
  parseDeclaredTitleId,
  parseDiscCount,
  parseDiscNumber,
  parseExecutableType,
  parseMediaId,
  parsePlatform,
  parseSaveGameId,
  parseVersion,
} from '../shared/execution-info.js';
import { parseInstallerMetadata, parseMediaOrAvatarData } from '../shared/extension-data.js';
import { type Format, parseFormat } from '../shared/format.js';
import { parseContentId } from '../shared/header-info.js';
import { type MetadataVersion, parseMetadataVersion } from '../shared/metadata-version.js';
import {
  type DeclaredSigning,
  type HeaderSize,
  type PrecheckFailureReason,
  precheckHeader,
} from '../shared/precheck-header.js';
import { parseContentSize, parseDataFileCount, parseDataFilesSize } from '../shared/sizes.js';
import { parseThumbnail, parseThumbnailSizes, parseTitleThumbnail } from '../shared/thumbnails.js';

/** What a package header says about the package: its identity and display information. */
export interface Header {
  /** The signing type the magic claims: `CON`, `LIVE` or `PIRS`. Not proof of a genuine signature. */
  declaredSigning: DeclaredSigning;
  /** The content ID at 0x32C, as 40 hex digits. */
  contentId: string;
  /** The header's length in bytes: 0x971A, or 0xAD0E with installer metadata. */
  headerSize: HeaderSize;
  /** The content type the header claims. The directory a package is in decides the real one. */
  declaredContentType: number;
  metadataVersion: MetadataVersion;
  contentSize: number;
  /** 8 hex digits. */
  mediaId: string;
  version: number;
  baseVersion: number;
  /** The Title ID the header claims, as 8 hex digits. The directory a package is in decides the real one. */
  declaredTitleId: string;
  platform: number;
  executableType: number;
  discNumber: number;
  discCount: number;
  /** 8 hex digits. */
  saveGameId: string;
  /** How many Data#### files an SVOD package has; 0 for STFS. */
  dataFileCount: number;
  /** The combined size of an SVOD package's data files. */
  dataFilesSize: number;
  format: Format;
  /** 16 hex digits. */
  onlineCreator: string;
  category: number;
  /** The 0x24 bytes at 0x3D9 in metadata version 2 (media or avatar data), or null in version 1. */
  mediaOrAvatarData: Uint8Array | null;
  /** One display name per language slot (9, or 12 in version 2). Index with `LanguageSlot`. */
  displayNames: (string | null)[];
  /** One description per language slot (9, or 12 in version 2). Index with `LanguageSlot`. */
  descriptions: (string | null)[];
  publisherName: string | null;
  titleName: string | null;
  /** The thumbnail's image bytes (PNG, unchecked), or null when there's none. */
  thumbnail: Uint8Array | null;
  /** The title thumbnail's image bytes (PNG, unchecked), or null when there's none. */
  titleThumbnail: Uint8Array | null;
  /** The installer metadata of a 0xAD0E header, raw, or null for a 0x971A header. */
  installerMetadata: Uint8Array | null;
}

/** Why parseHeader failed: a pre-check, or a field that has no truthful value. */
export type ParseHeaderFailureReason =
  | PrecheckFailureReason
  | { kind: 'value-exceeds-max-safe-integer'; field: 'contentSize' | 'dataFilesSize'; raw: string }
  | { kind: 'value-out-of-range'; field: 'thumbnail' | 'titleThumbnail'; declaredSize: number; availableSpace: number };

/** The header, or every reason it couldn't be parsed. */
export type ParseHeaderResult = [true, Header] | [false, ParseHeaderFailureReason[]];

/** Converts an 8-byte size to a number, or describes why it doesn't fit exactly. */
const sizeOrReason = (field: 'contentSize' | 'dataFilesSize', value: bigint): number | ParseHeaderFailureReason =>
  value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : { kind: 'value-exceeds-max-safe-integer', field, raw: `0x${value.toString(16).toUpperCase().padStart(16, '0')}` };

/**
 * Reads a package header: what the package is, and how it's displayed.
 *
 * Needs bytes from 0x000 up to the header size stored at 0x340: 0x971A bytes when
 * that value is 0x971A, and 0xAD0E bytes when it is 0xAD0E. Reading 0xB000 bytes
 * always suffices. Bytes beyond the header are ignored.
 *
 * Returns `[true, header]`, or `[false, reasons]`. It never throws on bad input,
 * and never returns a partial header. It fails when a pre-check fails (with that
 * one reason), or when a field has no truthful value: such as an 8-byte size above
 * Number.MAX_SAFE_INTEGER, or a thumbnail larger than its space (with every such
 * field). Unusual but representable values, such as an unknown content type or
 * volume type, are returned as they are; verifyHeaderAsync judges them.
 *
 * Values named `declared...` are claims: the magic doesn't prove a signature is
 * genuine, and a package's directory decides its real Title ID and content type.
 *
 * The result doesn't depend on `bytes` after the call returns.
 */
export function parseHeader(bytes: Uint8Array): ParseHeaderResult {
  const [ok, precheck] = precheckHeader(bytes);
  if (!ok) return [false, precheck];

  const reasons: ParseHeaderFailureReason[] = [];

  const contentSize = sizeOrReason('contentSize', parseContentSize(bytes));
  if (typeof contentSize !== 'number') reasons.push(contentSize);

  const dataFilesSize = sizeOrReason('dataFilesSize', parseDataFilesSize(bytes));
  if (typeof dataFilesSize !== 'number') reasons.push(dataFilesSize);

  const { thumbnail, titleThumbnail, availableSpace } = parseThumbnailSizes(bytes);
  if (thumbnail > availableSpace) {
    reasons.push({ kind: 'value-out-of-range', field: 'thumbnail', declaredSize: thumbnail, availableSpace });
  }
  if (titleThumbnail > availableSpace) {
    reasons.push({ kind: 'value-out-of-range', field: 'titleThumbnail', declaredSize: titleThumbnail, availableSpace });
  }

  // The `typeof` checks on the following line are redundant, but TypeScript needs them to narrow the types to `number`.
  if (reasons.length > 0 || typeof contentSize !== 'number' || typeof dataFilesSize !== 'number') {
    return [false, reasons];
  }

  return [
    true,
    {
      declaredSigning: precheck.declaredSigning,
      contentId: parseContentId(bytes),
      headerSize: precheck.headerSize,
      declaredContentType: parseDeclaredContentType(bytes),
      metadataVersion: parseMetadataVersion(bytes),
      contentSize,
      mediaId: parseMediaId(bytes),
      version: parseVersion(bytes),
      baseVersion: parseBaseVersion(bytes),
      declaredTitleId: parseDeclaredTitleId(bytes),
      platform: parsePlatform(bytes),
      executableType: parseExecutableType(bytes),
      discNumber: parseDiscNumber(bytes),
      discCount: parseDiscCount(bytes),
      saveGameId: parseSaveGameId(bytes),
      dataFileCount: parseDataFileCount(bytes),
      dataFilesSize,
      format: parseFormat(bytes),
      onlineCreator: parseOnlineCreator(bytes),
      category: parseCategory(bytes),
      mediaOrAvatarData: parseMediaOrAvatarData(bytes),
      displayNames: parseDisplayNames(bytes),
      descriptions: parseDescriptions(bytes),
      publisherName: parsePublisherName(bytes),
      titleName: parseTitleName(bytes),
      thumbnail: parseThumbnail(bytes),
      titleThumbnail: parseTitleThumbnail(bytes),
      installerMetadata: parseInstallerMetadata(bytes),
    },
  ];
}
