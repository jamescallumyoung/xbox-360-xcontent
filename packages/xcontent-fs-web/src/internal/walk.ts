import type {
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
  NotFoundReason | WrongCaseReason | UnexpectedEntryTypeReason | PermissionDeniedReason | IoErrorReason;

/**
 * Opens a location's content-type directory, going down from the root through
 * its partition and Title ID directories. See {@link openLocationDirectories},
 * which it uses.
 */
export async function openContentTypeDirectory(
  root: FileSystemDirectoryHandle,
  location: PackageLocation,
  options: { create?: boolean } = {},
): Promise<[true, FileSystemDirectoryHandle] | [false, [WalkFailure]]> {
  const [opened, dirs] = await openLocationDirectories(root, location, options);
  if (!opened) return [false, dirs];
  return [true, dirs[2]];
}

/**
 * Opens every directory on a location's path: its partition, Title ID and
 * content-type directories, in that order.
 *
 * Every directory must match the location's spelling exactly (function design
 * doc, rule 8), checked by listing its parent: one in another case gives
 * `wrong-case`. A file where a directory belongs gives `unexpected-entry-type`.
 *
 * Without `create`, a missing directory gives `not-found`, with the path down to
 * it. With `create` (a copy's target, C1.17), missing directories are created in
 * the location's spelling, but a directory in another case still fails (C1.13).
 */
export async function openLocationDirectories(
  root: FileSystemDirectoryHandle,
  location: PackageLocation,
  options: { create?: boolean } = {},
): Promise<
  [true, [FileSystemDirectoryHandle, FileSystemDirectoryHandle, FileSystemDirectoryHandle]] | [false, [WalkFailure]]
> {
  const [partitionOpened, partitionDir] = await openChild(root, [], location.partition, options);
  if (!partitionOpened) return [false, partitionDir];
  const [titleOpened, titleDir] = await openChild(partitionDir, [location.partition], location.titleId, options);
  if (!titleOpened) return [false, titleDir];
  const titlePath = [location.partition, location.titleId];
  const [typeOpened, contentTypeDir] = await openChild(titleDir, titlePath, location.contentType, options);
  if (!typeOpened) return [false, contentTypeDir];
  return [true, [partitionDir, titleDir, contentTypeDir]];
}

/** Opens (or creates) the directory `name` in `dir`, whose path is `path`, in exact case. */
async function openChild(
  dir: FileSystemDirectoryHandle,
  path: string[],
  name: string,
  options: { create?: boolean },
): Promise<[true, FileSystemDirectoryHandle] | [false, [WalkFailure]]> {
  const [listed, listing] = await listDirectory(dir, path);
  if (!listed) return [false, listing];
  const [found, entry] = lookupExact(listing, name, path);
  if (!found) return [false, entry];
  const entryPath = [...path, name];
  if (entry?.kind === 'directory') return [true, entry];
  if (entry !== undefined) return [false, [{ kind: 'unexpected-entry-type', path: entryPath, expected: 'directory' }]];
  if (options.create !== true) return [false, [{ kind: 'not-found', path: entryPath }]];
  try {
    return [true, await dir.getDirectoryHandle(name, { create: true })];
  } catch (error) {
    return [false, [failureFrom(error, 'create', entryPath)]];
  }
}
