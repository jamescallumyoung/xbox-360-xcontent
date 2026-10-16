import { checkAborted } from './internal/abort.js';
import { deleteAppleDoubleFiles } from './internal/delete-apple-double-files.js';
import { deleteCrswapFiles } from './internal/delete-crswap-files.js';
import type { StepFailure, StepOptions, StepProgress } from './internal/delete-entries.js';
import { deleteParentAppleDoubleFiles } from './internal/delete-parent-apple-double-files.js';
import { deleteSvodJunkFiles } from './internal/delete-svod-junk-files.js';
import { checkLocation } from './internal/location.js';
import { listDirectory, lookupExact } from './internal/lookup.js';
import { checkPermission } from './internal/permission.js';
import { openLocationDirectories } from './internal/walk.js';
import type {
  AbortedReason,
  ContentRoot,
  InvalidLocationReason,
  IoErrorReason,
  NotFoundReason,
  PackageLocation,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
  WrongCaseReason,
} from './types.js';

/** One of `clean`'s four steps. */
export type CleanStep = 'svod-junk' | 'crswap' | 'apple-double' | 'parent-apple-double';

/** Progress reported by `clean`, within each step. */
export interface CleanProgress {
  step: CleanStep;
  /** Entries deleted so far in this step. */
  deletedFiles: number;
  /** Entries this step will delete. */
  totalFiles: number;
  /** The entry just deleted. */
  fileName: string;
}

export interface CleanOptions {
  /** Also delete the AppleDouble files of the package's parent directories. Default `true`. */
  includeParents?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: CleanProgress) => void;
}

/** Why `clean` failed. */
export type CleanFailureReason =
  | InvalidLocationReason
  | PermissionDeniedReason
  | WrongCaseReason
  | NotFoundReason
  | UnexpectedEntryTypeReason
  | AbortedReason
  | IoErrorReason;

/**
 * Removes junk files from one package: Chromium swap files, macOS AppleDouble
 * files, and anything in `name.data/` that isn't a data file. It never touches
 * another package's files (only, with `includeParents`, the AppleDouble files of
 * the directories above it, which the packages under them share).
 *
 * Function design doc, J1. It runs four steps in order (J1.5-J1.8), each
 * listing what it will delete before deleting it:
 * 1. `svod-junk`: everything in `name.data/` but files named exactly
 *    `DataNNNN`, subdirectories included. No magic is checked there: nothing
 *    else belongs in `name.data/`.
 * 2. `crswap`: the package's swap files beside its header (`NAME.crswap`,
 *    `NAME.N.crswap`). Swap files are trusted by name.
 * 3. `apple-double`: the package's AppleDouble files beside its header
 *    (`._NAME`, `._NAME.data`, `._NAME.crswap`, `._NAME.N.crswap`), only if they
 *    start with the AppleDouble magic `00 05 16 07`.
 * 4. `parent-apple-double`, with `includeParents` (default `true`): the
 *    AppleDouble files of the content-type, Title ID and partition directories.
 *
 * Patterns are anchored and case-sensitive, with the name escaped. Names that may
 * belong to another package are kept: `NAME.N.crswap` if a package `NAME.N`
 * exists, and `._NAME.data` if `NAME.data` is a file (J1.13-J1.16). The header
 * and `name.data/` needn't exist, so it cleans up after an interrupted copy
 * (J1.4), but if they exist they must match the name exactly, or it fails with
 * `wrong-case` (J1.3). The root needs `readwrite` permission (J1.2).
 *
 * Progress restarts at each step (J1.9). An abort stops between deletions; what's
 * already deleted stays deleted (J1.19). So does an error: a failure in a later
 * step leaves the earlier steps' deletions in place. An entry that has vanished
 * since it was listed counts as deleted (macOS removes AppleDouble files itself).
 */
export async function clean(
  root: ContentRoot,
  location: PackageLocation,
  options: CleanOptions = {},
): Promise<[true] | [false, CleanFailureReason[]]> {
  const { includeParents = true, signal, onProgress } = options;
  const aborted = checkAborted(signal);
  if (aborted !== undefined) return [false, [aborted]];

  const [valid, checked] = checkLocation(location);
  if (!valid) return [false, checked];
  const { partition, titleId, contentType, packageName } = checked;

  const [permitted, denied] = await checkPermission(root.handle, 'readwrite');
  if (!permitted) return [false, denied];

  const [opened, dirs] = await openLocationDirectories(root.handle, checked);
  if (!opened) return [false, dirs];
  const contentTypeDir = dirs[2];
  const dirPath = [partition, titleId, contentType];

  // Rule 8: the package's own entries, if they exist, must match its name exactly
  // too. An entry differing only in case may be another package's, so fail
  // rather than clean nothing.
  const [listed, listing] = await listDirectory(contentTypeDir, dirPath, signal);
  if (!listed) return [false, listing];
  for (const name of [packageName, `${packageName}.data`]) {
    const [exact, entry] = lookupExact(listing, name, dirPath);
    if (!exact) return [false, entry];
  }

  const steps: [CleanStep, (stepOptions: StepOptions) => Promise<[true] | [false, [StepFailure]]>][] = [
    ['svod-junk', (stepOptions) => deleteSvodJunkFiles(contentTypeDir, dirPath, packageName, stepOptions)],
    ['crswap', (stepOptions) => deleteCrswapFiles(contentTypeDir, dirPath, packageName, stepOptions)],
    ['apple-double', (stepOptions) => deleteAppleDoubleFiles(contentTypeDir, dirPath, packageName, stepOptions)],
  ];
  if (includeParents) {
    steps.push([
      'parent-apple-double',
      (stepOptions) => deleteParentAppleDoubleFiles(root.handle, dirs, checked, stepOptions),
    ]);
  }

  for (const [step, run] of steps) {
    const abortedBetween = checkAborted(signal);
    if (abortedBetween !== undefined) return [false, [abortedBetween]];
    // Each step reports its own progress; this adds the step's name (J1.9).
    const stepOptions: StepOptions = signal === undefined ? {} : { signal };
    if (onProgress !== undefined) {
      stepOptions.onProgress = (progress: StepProgress) => {
        onProgress({ step, ...progress });
      };
    }
    const [done, failure] = await run(stepOptions);
    if (!done) return [false, failure];
  }

  // An abort during the last step's listing or magic checks, with nothing left to
  // delete, is still an abort (rule 10).
  const abortedAtEnd = checkAborted(signal);
  if (abortedAtEnd !== undefined) return [false, [abortedAtEnd]];
  return [true];
}
