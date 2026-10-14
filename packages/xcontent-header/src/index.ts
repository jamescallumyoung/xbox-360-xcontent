// xcontent-header: read, compare and verify Xbox 360 package headers.
// The main API is here. The single-purpose field parsers are in `xcontent-header/extended`.

export { parseHeader } from './parse/parse-header.js'
export type { Header, ParseHeaderFailureReason, ParseHeaderResult } from './parse/parse-header.js'
export { LanguageSlot } from './parse/language-slot.js'

export type { DeclaredSigning, HeaderSize, PrecheckFailureReason } from './shared/precheck-header.js'
export type { MetadataVersion } from './shared/metadata-version.js'
export type { Format } from './shared/format.js'
