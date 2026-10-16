import type { EntryPath } from '../types.js';
import { deleteEntries, type EntryToDelete, type StepFailure, type StepOptions } from './delete-entries.js';
import { findJunkBesideHeader } from './junk.js';
import { listDirectory } from './lookup.js';

/**
 * Deletes a package's own Chromium swap files beside its header: `clean`'s
 * `crswap` step.
 *
 * Function design doc, J1.13, J1.15 and J1.16. A file is deleted if its name
 * matches `^NAME(\.\d+)?\.crswap$`, with the package name escaped, anchored and
 * case-sensitive, so another package's swap files are never touched. Swap files
 * are trusted by name: they have no magic to check.
 *
 * `NAME.N.crswap` is kept if an entry named exactly `NAME.N` exists, because it
 * may be that package's swap file. The pattern starts at the name, so
 * `._NAME.crswap` is left to `deleteAppleDoubleFiles` and its magic check. Only
 * files are deleted.
 */
export async function deleteCrswapFiles(
  contentTypeDir: FileSystemDirectoryHandle,
  dirPath: EntryPath,
  packageName: string,
  options: StepOptions,
): Promise<[true] | [false, [StepFailure]]> {
  const [listed, listing] = await listDirectory(contentTypeDir, dirPath, options.signal);
  if (!listed) return [false, listing];
  const [found, junk] = await findJunkBesideHeader(listing, packageName, dirPath, new Set(['crswap']), options.signal);
  if (!found) return [false, junk];
  const swapFiles: EntryToDelete[] = junk.map(({ name }) => ({ dir: contentTypeDir, dirPath, name, kind: 'file' }));
  return deleteEntries(swapFiles, options);
}
