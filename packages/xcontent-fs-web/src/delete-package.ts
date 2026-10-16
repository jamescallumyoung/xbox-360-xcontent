import { abortedOr, checkAborted } from './internal/abort.js';
import { deleteEntries, type EntryToDelete, type StepOptions } from './internal/delete-entries.js';
import { failureFrom, isNotFoundError } from './internal/errors.js';
import { inspectPackage } from './internal/inspect.js';
import { checkLocation } from './internal/location.js';
import { checkPermission } from './internal/permission.js';
import { openContentTypeDirectory } from './internal/walk.js';
import type {
  AbortedReason,
  ContentRoot,
  InvalidLocationReason,
  IoErrorReason,
  JunkReason,
  NotFoundReason,
  PackageLocation,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
  WrongCaseReason,
} from './types.js';

/** Progress reported by `deletePackage`. */
export interface DeleteProgress {
  /** Files deleted so far: the header, then data files. */
  deletedFiles: number;
  /** Files this delete will delete: the header, if it exists, plus every data file. */
  totalFiles: number;
  /** The file just deleted. */
  fileName: string;
}

export interface DeletePackageOptions {
  signal?: AbortSignal;
  onProgress?: (progress: DeleteProgress) => void;
}

/** Why `deletePackage` failed. */
export type DeletePackageFailureReason =
  | InvalidLocationReason
  | PermissionDeniedReason
  | WrongCaseReason
  | NotFoundReason
  | UnexpectedEntryTypeReason
  | JunkReason
  | AbortedReason
  | IoErrorReason;

/**
 * Deletes one package: the header first, then the data files from `Data0000`
 * upwards, then the empty `.data/` directory. Bound onto the root as
 * `root.deletePackage`.
 *
 * Function design doc, D1. It deletes whatever exists of the package, so an
 * orphan header or `.data/` directory is deleted too (D1.5). It never reads the
 * header (D1.9). It assumes the package is clean: junk in `name.data/`, or the
 * package's swap or AppleDouble files beside the header, make it fail with one
 * `junk` reason per entry and delete nothing; run `clean` first (D1.10-D1.12).
 * Every check runs before anything is deleted (D1.13).
 *
 * Deleting the header first means the console never lists a half-deleted
 * package: an interrupted delete leaves a `.data/` without its header and its
 * lowest data files, detectable from names alone (D1.14, D1.16). The `.data/`
 * directory is removed without `recursive`, so anything that appeared in it
 * meanwhile makes the delete fail rather than be wiped (D1.15). Empty parent
 * directories stay (D1.17).
 *
 * The signal is checked before each deletion, and progress counts files: the
 * header plus each data file (D1.19, D1.20). A file that has vanished since it
 * was listed counts as deleted.
 */
export async function deletePackage(
  root: ContentRoot,
  location: PackageLocation,
  options: DeletePackageOptions = {},
): Promise<[true] | [false, DeletePackageFailureReason[]]> {
  const { signal, onProgress } = options;
  const aborted = checkAborted(signal);
  if (aborted !== undefined) return [false, [aborted]];

  const [valid, checked] = checkLocation(location);
  if (!valid) return [false, checked];
  const { partition, titleId, contentType, packageName } = checked;

  const [permitted, denied] = await checkPermission(root.handle, 'readwrite');
  if (!permitted) return [false, denied];

  const [opened, dir] = await openContentTypeDirectory(root.handle, checked);
  if (!opened) return [false, abortedOr(signal, dir)];
  const dirPath = [partition, titleId, contentType];
  const dataName = `${packageName}.data`;
  const dataPath = [...dirPath, dataName];

  const [inspected, entries] = await inspectPackage(dir, dirPath, packageName, {
    dataContents: true,
    besideHeaderJunk: true,
  });
  if (!inspected) return [false, abortedOr(signal, entries)];
  const { header, dataDirectory, dataFiles, dataJunk, junkBesideHeader } = entries;
  if (header === undefined && dataDirectory === undefined) {
    return [false, abortedOr(signal, [{ kind: 'not-found', path: [...dirPath, packageName] }])];
  }

  const junk: JunkReason[] = [
    ...dataJunk.map((name): JunkReason => ({ kind: 'junk', path: [...dataPath, name] })),
    ...junkBesideHeader.map((name): JunkReason => ({ kind: 'junk', path: [...dirPath, name] })),
  ];
  // An abort during the checks is reported as such, not as what they found (rule 10).
  if (junk.length > 0) return [false, abortedOr(signal, junk)];

  const files: EntryToDelete[] = [];
  if (header !== undefined) files.push({ dir, dirPath, name: packageName, kind: 'file' });
  if (dataDirectory !== undefined) {
    for (const { name } of dataFiles) files.push({ dir: dataDirectory, dirPath: dataPath, name, kind: 'file' });
  }
  // deleteEntries checks the signal before each file, so before the first too.
  const stepOptions: StepOptions = signal === undefined ? {} : { signal };
  if (onProgress !== undefined) stepOptions.onProgress = onProgress;
  const [deleted, failure] = await deleteEntries(files, stepOptions);
  if (!deleted) return [false, failure];

  if (dataDirectory !== undefined) {
    const abortedBeforeDirectory = checkAborted(signal);
    if (abortedBeforeDirectory !== undefined) return [false, [abortedBeforeDirectory]];
    try {
      // Not recursive: anything that appeared in it meanwhile stays, and the delete fails (D1.15).
      await dir.removeEntry(dataName);
    } catch (error) {
      if (!isNotFoundError(error)) return [false, [failureFrom(error, 'remove', dataPath, signal)]];
    }
  }
  return [true];
}
