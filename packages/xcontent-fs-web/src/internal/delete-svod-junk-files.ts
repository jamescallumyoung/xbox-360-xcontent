import type { EntryPath } from '../types.js';
import { deleteEntries, type EntryToDelete, type StepFailure, type StepOptions } from './delete-entries.js';
import { splitDataEntries } from './junk.js';
import { listDirectory, lookupExact } from './lookup.js';

/**
 * Deletes everything in a package's `name.data/` directory that isn't a file
 * named exactly `DataNNNN`: `clean`'s `svod-junk` step.
 *
 * Function design doc, J1.10-J1.12. That includes swap files, AppleDouble files
 * and anything else; subdirectories are deleted with everything in them. No
 * AppleDouble magic is checked here, unlike beside the header: nothing but data
 * files belongs in `name.data/`, so whatever else is there is junk.
 *
 * Without a `name.data/` directory there's nothing to do (J1.4). When
 * `name.data` is a file, it's another package's header, so there's nothing to do
 * either: unlike `deletePackage` and `copyTo`, which refuse such a package
 * (`unexpected-entry-type`), `clean` only cleans what is certainly this
 * package's. A `name.data/` in another case gives `wrong-case`.
 */
export async function deleteSvodJunkFiles(
  contentTypeDir: FileSystemDirectoryHandle,
  dirPath: EntryPath,
  packageName: string,
  options: StepOptions,
): Promise<[true] | [false, [StepFailure]]> {
  const dataName = `${packageName}.data`;
  const { signal } = options;
  const [listed, listing] = await listDirectory(contentTypeDir, dirPath, signal);
  if (!listed) return [false, listing];
  const [found, dataDir] = lookupExact(listing, dataName, dirPath);
  if (!found) return [false, dataDir];
  if (dataDir?.kind !== 'directory') return [true];

  const dataPath = [...dirPath, dataName];
  const [dataListed, dataListing] = await listDirectory(dataDir, dataPath, signal);
  if (!dataListed) return [false, dataListing];

  const junk: EntryToDelete[] = splitDataEntries(dataListing).junk.map(({ name, kind }) => ({
    dir: dataDir,
    dirPath: dataPath,
    name,
    kind,
  }));
  return deleteEntries(junk, options);
}
