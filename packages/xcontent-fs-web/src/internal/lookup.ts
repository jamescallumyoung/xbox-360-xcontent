import type { AbortedReason, EntryPath, IoErrorReason, PermissionDeniedReason, WrongCaseReason } from '../types.js';
import { failureFrom } from './errors.js';

/** A directory's entries, by their names on disk, in a stable (sorted) order. */
export type Listing = ReadonlyMap<string, FileSystemDirectoryHandle | FileSystemFileHandle>;

/**
 * Lists a directory once, for exact-case lookups.
 *
 * Function design doc, rule 8: on FAT32, `getFileHandle('ABC')` also finds
 * `abc`, and `handle.name` reports the spelling asked for (record §2.4). Only a
 * listing shows the names as they are on disk. Entries are sorted, so results
 * built from them are deterministic (rule 3). `path` is the directory's path,
 * for error reasons. With a `signal` that has been aborted, a failed listing
 * gives `aborted` (rule 10).
 */
export async function listDirectory(
  dir: FileSystemDirectoryHandle,
  path: EntryPath,
): Promise<[true, Listing] | [false, [PermissionDeniedReason | IoErrorReason]]>;
export async function listDirectory(
  dir: FileSystemDirectoryHandle,
  path: EntryPath,
  signal: AbortSignal | undefined,
): Promise<[true, Listing] | [false, [PermissionDeniedReason | IoErrorReason | AbortedReason]]>;
export async function listDirectory(
  dir: FileSystemDirectoryHandle,
  path: EntryPath,
  signal?: AbortSignal,
): Promise<[true, Listing] | [false, [PermissionDeniedReason | IoErrorReason | AbortedReason]]> {
  try {
    const entries: [string, FileSystemDirectoryHandle | FileSystemFileHandle][] = [];
    for await (const entry of dir.entries()) entries.push(entry);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return [true, new Map(entries)];
  } catch (error) {
    return [false, [failureFrom(error, 'list', path, signal)]];
  }
}

/**
 * The entry named exactly `name`, `undefined` if there's none in any case, or
 * `wrong-case` if one exists only in another case (rule 8). `dirPath` is the
 * listed directory's path.
 */
export function lookupExact(
  listing: Listing,
  name: string,
  dirPath: EntryPath,
): [true, FileSystemDirectoryHandle | FileSystemFileHandle | undefined] | [false, [WrongCaseReason]] {
  const exact = listing.get(name);
  if (exact !== undefined) return [true, exact];
  const found = findIgnoringCase(listing, name);
  if (found !== undefined) return [false, [{ kind: 'wrong-case', path: [...dirPath, name], found }]];
  return [true, undefined];
}

/**
 * The on-disk name of the entry matching `name` without regard to case: the
 * exact name if it exists, otherwise the first match. `undefined` if none.
 *
 * Used where any case counts, such as a copy's target (C1.14): on FAT32,
 * creating `ABC` would write into an existing `abc`.
 */
export function findIgnoringCase(listing: Listing, name: string): string | undefined {
  if (listing.has(name)) return name;
  const folded = name.toLowerCase();
  for (const candidate of listing.keys()) {
    if (candidate.toLowerCase() === folded) return candidate;
  }
  return undefined;
}
