// The package's API. Functions are added as each one is built.
export { openContentRoot, type OpenContentRootFailureReason } from './open-content-root.js';
export type {
  AbortedReason,
  ContentRoot,
  EntryPath,
  InvalidLocationReason,
  IoErrorReason,
  IoOperation,
  JunkReason,
  NotFoundReason,
  OrphanedDataReason,
  PackageLocation,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
  WrongCaseReason,
} from './types.js';
