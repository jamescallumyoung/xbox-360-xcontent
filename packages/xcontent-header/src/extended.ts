// `xcontent-header/extended`: the pre-check and the single-purpose field parsers.
//
// Callers who compose their own parsing should check their header bytes pass
// `precheckHeader` first: every field parser assumes it passed.

export { precheckHeader } from './shared/precheck-header.js';
export type { DeclaredSigning, HeaderSize, PrecheckFailureReason, PrecheckResult } from './shared/precheck-header.js';

// Field parsers. Each assumes precheckHeader passed.
export { parseDeclaredSigning } from './shared/signing.js';
export { parseContentId, parseHeaderSize } from './shared/header-info.js';
export { parseDeclaredContentType } from './shared/content-type.js';
export { parseMetadataVersion } from './shared/metadata-version.js';
export type { MetadataVersion } from './shared/metadata-version.js';
export { parseContentSize, parseDataFileCount, parseDataFilesSize } from './shared/sizes.js';
export {
  parseBaseVersion,
  parseDeclaredTitleId,
  parseDiscCount,
  parseDiscNumber,
  parseExecutableType,
  parseMediaId,
  parsePlatform,
  parseSaveGameId,
  parseVersion,
} from './shared/execution-info.js';
export { parseFormat } from './shared/format.js';
export type { Format } from './shared/format.js';
export { parseCategory, parseOnlineCreator } from './shared/creator-and-category.js';
export { parseInstallerMetadata, parseMediaOrAvatarData } from './shared/extension-data.js';
export { parseDescriptions, parseDisplayNames, parsePublisherName, parseTitleName } from './shared/display-strings.js';
export { parseThumbnail, parseThumbnailSizes, parseTitleThumbnail } from './shared/thumbnails.js';
export type { ThumbnailSizes } from './shared/thumbnails.js';
export { parseLicences } from './shared/licences.js';
export type { Licence, LicenseeTypeName } from './shared/licences.js';
export { parseTransferFlags } from './shared/transfer-flags.js';
export type { TransferFlags } from './shared/transfer-flags.js';
export { parseCreatorConsoleId, parseDeviceId, parseProfileId } from './shared/ownership-ids.js';

// The slot index of each language in parseDisplayNames' and parseDescriptions' results.
export { LanguageSlot } from './parse/language-slot.js';
