import type { AbortedReason, EntryPath, IoErrorReason, PermissionDeniedReason, WrongCaseReason } from '../types.js';
import { checkAborted } from './abort.js';
import { failureFrom, isNotFoundError } from './errors.js';
import { reportProgress } from './progress.js';

/** Progress within one of `clean`'s steps (function design doc, J1.9). */
export interface StepProgress {
  deletedFiles: number;
  totalFiles: number;
  /** The entry just deleted. */
  fileName: string;
}

/** What each of `clean`'s steps takes. */
export interface StepOptions {
  signal?: AbortSignal;
  onProgress?: (progress: StepProgress) => void;
}

/** Why one of `clean`'s steps failed. */
export type StepFailure = WrongCaseReason | PermissionDeniedReason | IoErrorReason | AbortedReason;

/** An entry for {@link deleteEntries} to delete. */
export interface EntryToDelete {
  /** The directory the entry is in. */
  dir: FileSystemDirectoryHandle;
  /** That directory's path, for error reasons. */
  dirPath: EntryPath;
  name: string;
  /** Directories are deleted with everything in them. */
  kind: 'file' | 'directory';
}

/**
 * Deletes a list of entries in order: the deleting half of each of `clean`'s
 * steps, which first list what they will delete.
 *
 * Function design doc, J1.9 and J1.19. The signal is checked before each
 * deletion, so an abort stops between entries; what's already deleted stays
 * deleted. Progress is reported after each deletion. An entry that has gone
 * since it was listed counts as deleted; any other error stops it.
 *
 * A directory is only deleted recursively when it was listed as a directory. A
 * file replaced by a directory since then fails to delete (`recursive` isn't
 * set), so nothing is wiped by mistake.
 */
export async function deleteEntries(
  entries: readonly EntryToDelete[],
  options: StepOptions,
): Promise<[true] | [false, [StepFailure]]> {
  const { signal, onProgress } = options;
  let deletedFiles = 0;
  for (const { dir, dirPath, name, kind } of entries) {
    const aborted = checkAborted(signal);
    if (aborted !== undefined) return [false, [aborted]];
    try {
      await dir.removeEntry(name, { recursive: kind === 'directory' });
    } catch (error) {
      // Already gone counts as deleted: on macOS, removing a file also removes its
      // AppleDouble file, which may be next in the list (design record §2.4).
      if (!isNotFoundError(error)) return [false, [failureFrom(error, 'remove', [...dirPath, name], signal)]];
    }
    deletedFiles++;
    reportProgress(onProgress, { deletedFiles, totalFiles: entries.length, fileName: name });
  }
  return [true];
}
