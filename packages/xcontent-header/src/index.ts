// xcontent-header: read, compare and verify Xbox 360 package headers.
// The main API is here. The single-purpose field parsers are in `xcontent-header/extended`.

export {
  parseHeader,
  type Header,
  type ParseHeaderFailureReason,
  type ParseHeaderResult,
} from './parse/parse-header.js';
export { LanguageSlot } from './parse/language-slot.js';
export {
  parseRestrictions,
  type ParseRestrictionsFailureReason,
  type ParseRestrictionsResult,
  type Restrictions,
} from './parse/parse-restrictions.js';
export {
  hasEmptySignature,
  type HasEmptySignatureFailureReason,
  type HasEmptySignatureResult,
} from './parse/has-empty-signature.js';

export type { DeclaredSigning, HeaderSize, PrecheckFailureReason } from './shared/precheck-header.js';
export type { MetadataVersion } from './shared/metadata-version.js';
export type { Format } from './shared/format.js';
export type { Licence, LicenseeTypeName } from './shared/licences.js';
export type { TransferFlags } from './shared/transfer-flags.js';
