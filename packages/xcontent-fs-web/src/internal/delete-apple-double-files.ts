import type { EntryPath } from '../types.js';
import { deleteEntries, type EntryToDelete, type StepFailure, type StepOptions } from './delete-entries.js';
import { findJunkBesideHeader } from './junk.js';
import { listDirectory } from './lookup.js';

/**
 * Deletes a package's own macOS AppleDouble files beside its header: `clean`'s
 * `apple-double` step.
 *
 * Function design doc, J1.14-J1.16. A file is deleted if its name matches
 * `^\._NAME(\.data|(\.\d+)?\.crswap)?$` (`._NAME`, `._NAME.data`,
 * `._NAME.crswap`, `._NAME.N.crswap`), with the package name escaped, anchored
 * and case-sensitive, **and** it starts with the AppleDouble magic `00 05 16 07`.
 * Unlike swap files, which are trusted by name, AppleDouble files are checked:
 * a file with the name but other bytes, or shorter than 4 bytes, is kept.
 *
 * `._NAME.N.crswap` is kept if an entry named exactly `NAME.N` exists, and
 * `._NAME.data` if `NAME.data` is a file: another package's header (J1.15).
 * Every candidate's magic is read before anything is deleted, and a candidate
 * that has vanished meanwhile is skipped. Only files are deleted.
 */
export async function deleteAppleDoubleFiles(
  contentTypeDir: FileSystemDirectoryHandle,
  dirPath: EntryPath,
  packageName: string,
  options: StepOptions,
): Promise<[true] | [false, [StepFailure]]> {
  const [listed, listing] = await listDirectory(contentTypeDir, dirPath, options.signal);
  if (!listed) return [false, listing];
  const kinds = new Set(['apple-double'] as const);
  const [found, junk] = await findJunkBesideHeader(listing, packageName, dirPath, kinds, options.signal);
  if (!found) return [false, junk];
  const appleDoubleFiles: EntryToDelete[] = junk.map(({ name }) => ({
    dir: contentTypeDir,
    dirPath,
    name,
    kind: 'file',
  }));
  return deleteEntries(appleDoubleFiles, options);
}
