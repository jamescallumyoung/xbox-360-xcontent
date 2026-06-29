import type { XContentHeader } from '../types.js'
import { parseMagic } from './magic.js'
import { parseContentType } from './content-type.js'
export { CONTENT_TYPE_HEX } from './content-type.js'
import { parseTitleId } from './title-id.js'
import { parseMetadataVersion } from './metadata-version.js'
import { parseDisplayNames } from './display-names.js'
import { parseDisplayDescriptions } from './display-descriptions.js'
import { parsePublisherName } from './publisher-name.js'
import { parseTitleName } from './title-name.js'
import { parseTransferFlags } from './transfer-flags.js'
import { parseConsoleId } from './console-id.js'
import { parseConsoleType } from './console-type.js'
import { parseThumbnail } from './thumbnail.js'
import { parseSecondaryThumbnail } from './secondary-thumbnail.js'

export type ParseHeaderResult =
  | { success: true; header: XContentHeader }
  | { success: false; header: Partial<XContentHeader> }

export function parseHeader(bytes: Uint8Array): ParseHeaderResult {
  const magic = parseMagic(bytes)
  const titleId = parseTitleId(bytes)
  const contentTypeResult = parseContentType(bytes)
  const metadataVersion = parseMetadataVersion(bytes)
  const displayNames = parseDisplayNames(bytes)
  const displayDescriptions = parseDisplayDescriptions(bytes)
  const publisherName = parsePublisherName(bytes)
  const titleName = parseTitleName(bytes)
  const transferFlags = parseTransferFlags(bytes)

  if (
    magic === null || titleId === null || contentTypeResult === null ||
    metadataVersion === null || displayNames === null || displayDescriptions === null ||
    publisherName === null || titleName === null || transferFlags === null
  ) {
    return {
      success: false,
      header: {
        ...(magic !== null && { magic }),
        ...(titleId !== null && { titleId, titleIdHex: titleId.toString(16).toUpperCase().padStart(8, '0') }),
        ...(contentTypeResult !== null && { contentType: contentTypeResult.value, contentTypeName: contentTypeResult.name }),
        ...(metadataVersion !== null && { metadataVersion }),
        ...(displayNames !== null && { displayNames }),
        ...(displayDescriptions !== null && { displayDescriptions }),
        ...(publisherName !== null && { publisherName }),
        ...(titleName !== null && { titleName }),
        ...(transferFlags !== null && { transferFlags }),
      },
    }
  }

  return {
    success: true,
    header: {
      magic,
      contentType: contentTypeResult.value,
      contentTypeName: contentTypeResult.name,
      titleId,
      titleIdHex: titleId.toString(16).toUpperCase().padStart(8, '0'),
      metadataVersion,
      displayNames,
      displayDescriptions,
      publisherName,
      titleName,
      transferFlags,
      consoleId: parseConsoleId(bytes, magic),
      consoleType: parseConsoleType(bytes, magic),
      thumbnail: parseThumbnail(bytes, metadataVersion),
      secondaryThumbnail: parseSecondaryThumbnail(bytes, metadataVersion),
    },
  }
}
