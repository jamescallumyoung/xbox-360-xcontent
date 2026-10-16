import type {
  AbortedReason,
  IoErrorReason,
  NotFoundReason,
  PackageLocation,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
  WrongCaseReason,
} from '../types.js';
import { failureFrom } from './errors.js';
import { listDirectory, lookupExact } from './lookup.js';

type WalkFailure =
  NotFoundReason | WrongCaseReason | UnexpectedEntryTypeReason | PermissionDeniedReason | IoErrorReason | AbortedReason;

/**
 * Opens a location's content-type directory, going down from the root through
 * its partition and Title ID directories.
 *
 * Every directory must match the location's spelling exactly (function design
 * doc, rule 8), checked by listing its parent: one in another case gives
 * `wrong-case`. A file where a directory belongs gives `unexpected-entry-type`.
 *
 * Without `create`, a missing directory gives `not-found`, with the path down to
 * it. With `create` (a copy's target, C1.17), missing directories are created in
 * the location's spelling, but a directory in another case still fails (C1.13).
 */
export async function openContentTypeDirectory(
  root: FileSystemDirectoryHandle,
  location: PackageLocation,
  options: { create?: boolean } = {},
): Promise<[true, FileSystemDirectoryHandle] | [false, [WalkFailure]]> {
  let dir = root;
  const path: string[] = [];
  for (const name of [location.partition, location.titleId, location.contentType]) {
    const [listed, listing] = await listDirectory(dir, path);
    if (!listed) return [false, listing];
    const [found, entry] = lookupExact(listing, name, path);
    if (!found) return [false, entry];
    const entryPath = [...path, name];
    if (entry === undefined) {
      if (options.create !== true) return [false, [{ kind: 'not-found', path: entryPath }]];
      try {
        dir = await dir.getDirectoryHandle(name, { create: true });
      } catch (error) {
        return [false, [failureFrom(error, 'create', entryPath)]];
      }
    } else if (entry.kind === 'directory') {
      dir = entry;
    } else {
      return [false, [{ kind: 'unexpected-entry-type', path: entryPath, expected: 'directory' }]];
    }
    path.push(name);
  }
  return [true, dir];
}
