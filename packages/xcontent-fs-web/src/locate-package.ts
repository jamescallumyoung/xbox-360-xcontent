import { failureFrom } from './internal/errors.js';
import { inspectPackage } from './internal/inspect.js';
import { hasAppleDoubleMagic, junkKindOfName } from './internal/junk.js';
import { checkLocation } from './internal/location.js';
import { checkPermission } from './internal/permission.js';
import { openContentTypeDirectory } from './internal/walk.js';
import type {
  ContentRoot,
  EntryPath,
  InvalidLocationReason,
  IoErrorReason,
  JunkReason,
  NotFoundReason,
  PackageLocation,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
  WrongCaseReason,
} from './types.js';

/** The handle isn't inside this root. */
export interface NotInRootReason {
  kind: 'not-in-root';
}

/** The handle isn't a package's header file or `.data` directory. */
export interface NotAPackagePathReason {
  kind: 'not-a-package-path';
  path: EntryPath;
}

/** Why `locatePackage` failed. */
export type LocatePackageFailureReason =
  | NotInRootReason
  | NotAPackagePathReason
  | InvalidLocationReason
  | PermissionDeniedReason
  | WrongCaseReason
  | NotFoundReason
  | UnexpectedEntryTypeReason
  | JunkReason
  | IoErrorReason;

/**
 * Turns a handle to a package's header file, or to its `.data` directory, into
 * that package's location. Bound onto the root as `root.locatePackage`.
 *
 * Function design doc, L1. The handle must be inside the root (L1.1), exactly 4
 * names down: partition, Title ID, content type, then the entry (L1.2). A file
 * there is a header; a directory there must end in `.data`, and gives the
 * package named without it, whether or not the header exists (L1.3, L1.4). So
 * an orphan `.data` directory gives a location that can go straight to
 * `deletePackage`.
 *
 * `resolve()` repeats the spelling the handle was obtained with, so every name
 * is checked against the disk (L1.7), and a header and data directory differing
 * in case fail rather than guess (L1.8). A junk file (a swap file, or an
 * AppleDouble file with its magic) is never a header (L1.9). The header itself
 * is never read (L1.10). An entry removed since the handle was obtained gives
 * `not-found`.
 */
export async function locatePackage(
  root: ContentRoot,
  handle: FileSystemHandle,
): Promise<[true, PackageLocation] | [false, LocatePackageFailureReason[]]> {
  let path: string[] | null;
  try {
    path = await root.handle.resolve(handle);
  } catch (error) {
    return [false, [failureFrom(error, 'open', [])]];
  }
  if (path === null) return [false, [{ kind: 'not-in-root' }]];

  if (path.length !== 4) return [false, [{ kind: 'not-a-package-path', path }]];
  const [partition = '', titleId = '', contentType = '', entryName = ''] = path;

  let packageName: string;
  if (handle.kind === 'file') packageName = entryName;
  else if (entryName.endsWith('.data')) packageName = entryName.slice(0, -'.data'.length);
  else return [false, [{ kind: 'not-a-package-path', path }]];

  const [valid, location] = checkLocation({ partition, titleId, contentType, packageName });
  if (!valid) return [false, location];

  const [permitted, denied] = await checkPermission(root.handle, 'read');
  if (!permitted) return [false, denied];

  const [opened, dir] = await openContentTypeDirectory(root.handle, location);
  if (!opened) return [false, dir];
  const dirPath = [partition, titleId, contentType];
  const [inspected, entries] = await inspectPackage(dir, dirPath, packageName);
  if (!inspected) return [false, entries];

  const entry = handle.kind === 'file' ? entries.header : entries.dataDirectory;
  if (entry === undefined) return [false, [{ kind: 'not-found', path }]];

  if (entry.kind === 'file') {
    const junk = junkKindOfName(entryName);
    if (junk === 'crswap') return [false, [{ kind: 'junk', path }]];
    if (junk === 'apple-double') {
      try {
        if (await hasAppleDoubleMagic(entry)) return [false, [{ kind: 'junk', path }]];
      } catch (error) {
        return [false, [failureFrom(error, 'read', path)]];
      }
    }
  }

  return [true, location];
}
