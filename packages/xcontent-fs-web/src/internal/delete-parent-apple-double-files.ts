import type { PackageLocation } from '../types.js';
import { deleteEntries, type EntryToDelete, type StepFailure, type StepOptions } from './delete-entries.js';
import { readAppleDoubleMagic } from './junk.js';
import { listDirectory } from './lookup.js';

/**
 * Deletes the macOS AppleDouble files of a package's parent directories:
 * `clean`'s `parent-apple-double` step, run when `includeParents` is set.
 *
 * Function design doc, J1.17 and J1.18. It deletes exactly `._<contentType>` in
 * the Title ID directory, `._<titleId>` in the partition directory and
 * `._<partition>` in the root, deepest first, each only if it is a file starting
 * with the AppleDouble magic `00 05 16 07`. Names must match exactly, so a
 * sibling directory's AppleDouble file is never touched. The root's own
 * AppleDouble file (such as `._Content`) is outside the root, out of reach.
 *
 * `dirs` are the partition, Title ID and content-type directories, from
 * `openLocationDirectories`.
 */
export async function deleteParentAppleDoubleFiles(
  root: FileSystemDirectoryHandle,
  dirs: readonly [FileSystemDirectoryHandle, FileSystemDirectoryHandle, FileSystemDirectoryHandle],
  location: PackageLocation,
  options: StepOptions,
): Promise<[true] | [false, [StepFailure]]> {
  const { partition, titleId, contentType } = location;
  const [partitionDir, titleDir] = dirs;
  const parents = [
    { dir: titleDir, dirPath: [partition, titleId], child: contentType },
    { dir: partitionDir, dirPath: [partition], child: titleId },
    { dir: root, dirPath: [], child: partition },
  ];

  const appleDoubleFiles: EntryToDelete[] = [];
  for (const { dir, dirPath, child } of parents) {
    const name = `._${child}`;
    const [listed, listing] = await listDirectory(dir, dirPath, options.signal);
    if (!listed) return [false, listing];
    const handle = listing.get(name);
    if (handle?.kind !== 'file') continue;
    const [read, isAppleDouble] = await readAppleDoubleMagic(handle, [...dirPath, name], options.signal);
    if (!read) return [false, isAppleDouble];
    if (!isAppleDouble) continue;
    appleDoubleFiles.push({ dir, dirPath, name, kind: 'file' });
  }
  return deleteEntries(appleDoubleFiles, options);
}
