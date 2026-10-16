// The package's public types. See the function design doc, "Shared types".

import type { LocatePackageFailureReason } from './locate-package.js';
import type { ReadHeaderBytesFailureReason, ReadHeaderBytesOptions } from './read-header-bytes.js';

/**
 * Where a package is, in a `Content/` tree: its partition, Title ID and content
 * type directories, and its header's name.
 *
 * It's plain data, so it can be stored (in IndexedDB, or as JSON) and built by
 * hand. Every function checks it when called (function design doc, rule 7).
 */
export interface PackageLocation {
  /** `0000000000000000` for the public partition, or a profile ID: 16 uppercase hex digits. */
  partition: string;
  /** 8 uppercase hex digits, such as `4D5307E6`. */
  titleId: string;
  /** 8 uppercase hex digits, such as `00007000`. */
  contentType: string;
  /** The header's file name, exactly as stored. Case matters. */
  packageName: string;
}

/** Names from a root down to an entry, as `FileSystemDirectoryHandle.resolve()` returns them. */
export type EntryPath = string[];

/** What a function was doing when the browser reported an error. */
export type IoOperation = 'list' | 'open' | 'create' | 'read' | 'write' | 'close' | 'remove' | 'verify-size';

/** A `PackageLocation` field that isn't valid (rule 7). */
export interface InvalidLocationReason {
  kind: 'invalid-location';
  field: keyof PackageLocation;
  value: string;
}

/** The page doesn't have permission to use a root in the mode needed. */
export interface PermissionDeniedReason {
  kind: 'permission-denied';
  mode: 'read' | 'readwrite';
  state: 'prompt' | 'denied';
}

/** An entry exists, but with different case from the one asked for (rule 8). */
export interface WrongCaseReason {
  kind: 'wrong-case';
  /** The path asked for, down to the entry with the wrong case. */
  path: EntryPath;
  /** The entry's name as it is on disk. */
  found: string;
}

export interface NotFoundReason {
  kind: 'not-found';
  path: EntryPath;
}

/** A `.data` directory was found, but not its header. */
export interface OrphanedDataReason {
  kind: 'orphaned-data';
  /** The `.data` directory's path. */
  path: EntryPath;
}

/** A file where a directory was expected, or the reverse. */
export interface UnexpectedEntryTypeReason {
  kind: 'unexpected-entry-type';
  path: EntryPath;
  expected: 'file' | 'directory';
}

/** A junk file in a package (see `clean`). */
export interface JunkReason {
  kind: 'junk';
  path: EntryPath;
}

/** The caller's `signal` was aborted. */
export interface AbortedReason {
  kind: 'aborted';
  /** The signal's `reason`. */
  reason: unknown;
}

/** The browser reported an error, other than a permission error. */
export interface IoErrorReason {
  kind: 'io-error';
  operation: IoOperation;
  path: EntryPath;
  /** The exception's `name` (such as `NotFoundError`) and `message`. */
  error: { name: string; message: string };
}

/**
 * A `Content/` tree, opened with `openContentRoot`. Every function works
 * through one.
 */
export interface ContentRoot {
  /** The directory handle the root was opened with. */
  readonly handle: FileSystemDirectoryHandle;
  /** The permission mode the root was opened with. */
  readonly mode: 'read' | 'readwrite';
  /**
   * Reads the first `0xB000` bytes of a package's header file, for
   * `xcontent-header`'s functions. See `readHeaderBytes` (function design doc, H1).
   */
  readHeaderBytes(
    location: PackageLocation,
    options?: ReadHeaderBytesOptions,
  ): Promise<[true, Uint8Array] | [false, ReadHeaderBytesFailureReason[]]>;
  /**
   * Turns a handle to a package's header file, or to its `.data` directory, into
   * that package's location. See `locatePackage` (function design doc, L1).
   */
  locatePackage(handle: FileSystemHandle): Promise<[true, PackageLocation] | [false, LocatePackageFailureReason[]]>;
}
