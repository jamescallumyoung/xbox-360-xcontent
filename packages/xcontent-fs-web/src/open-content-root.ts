import { deletePackage, type DeletePackageOptions } from './delete-package.js';
import { failureFrom } from './internal/errors.js';
import { checkPermission } from './internal/permission.js';
import { locatePackage } from './locate-package.js';
import { readHeaderBytes, type ReadHeaderBytesOptions } from './read-header-bytes.js';
import type {
  ContentRoot,
  IoErrorReason,
  PackageLocation,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
} from './types.js';

/** Why `openContentRoot` failed. */
export type OpenContentRootFailureReason = UnexpectedEntryTypeReason | PermissionDeniedReason | IoErrorReason;

/**
 * Opens a `Content/` tree from a directory handle, such as one from
 * `showDirectoryPicker()`. Every other function works through the root it returns.
 *
 * Function design doc, O1. It checks that the handle is a directory (O1.1), that
 * the page has permission in `mode` (`read` by default, O1.3-O1.4), and that the
 * drive is still there, by reading its first entry (O1.6). It never asks for
 * permission: prompting needs a user gesture, so call `requestPermission`
 * yourself first if `queryPermission` says `prompt` (O1.5). It doesn't check what
 * the directory holds, and the directory can have any name (O1.2, O1.7).
 *
 * The root is a frozen object holding the handle, the mode and the methods, which
 * are bound to it (O1.8). It caches
 * nothing: every call reads the drive afresh (O1.9).
 */
export async function openContentRoot(
  handle: FileSystemDirectoryHandle,
  options: { mode?: 'read' | 'readwrite' } = {},
): Promise<[true, ContentRoot] | [false, OpenContentRootFailureReason[]]> {
  // JavaScript callers can pass anything, so check what the handle really is.
  const kind: unknown = (handle as { kind?: unknown } | null | undefined)?.kind;
  if (kind !== 'directory') {
    return [false, [{ kind: 'unexpected-entry-type', path: [], expected: 'directory' }]];
  }
  const mode = options.mode ?? 'read';

  const [permitted, denied] = await checkPermission(handle, mode);
  if (!permitted) return [false, denied];

  try {
    // Reading one entry is enough to show the drive is still there.
    await handle.keys().next();
  } catch (error) {
    return [false, [failureFrom(error, 'list', [])]];
  }

  const root: ContentRoot = Object.freeze({
    handle,
    mode,
    readHeaderBytes: (location: PackageLocation, readOptions?: ReadHeaderBytesOptions) =>
      readHeaderBytes(root, location, readOptions),
    locatePackage: (entry: FileSystemHandle) => locatePackage(root, entry),
    deletePackage: (location: PackageLocation, deleteOptions?: DeletePackageOptions) =>
      deletePackage(root, location, deleteOptions),
  });
  return [true, root];
}
