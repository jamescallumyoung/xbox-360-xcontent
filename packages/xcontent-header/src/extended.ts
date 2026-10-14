// `xcontent-header/extended`: the pre-check and the single-purpose field parsers.
//
// Callers who compose their own parsing should check their header bytes pass
// `precheckHeader` first: every field parser assumes it passed.

export { precheckHeader } from './shared/precheck-header.js'
export type { DeclaredSigning, HeaderSize, PrecheckFailureReason, PrecheckResult } from './shared/precheck-header.js'
