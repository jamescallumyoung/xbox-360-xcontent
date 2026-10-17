import { clean } from './clean.js';
import { abortedOr, checkAborted } from './internal/abort.js';
import { failureFrom } from './internal/errors.js';
import { inspectPackage } from './internal/inspect.js';
import { checkLocation } from './internal/location.js';
import { findIgnoringCase, listDirectory } from './internal/lookup.js';
import { checkPermission } from './internal/permission.js';
import { reportProgress } from './internal/progress.js';
import { openContentTypeDirectory, openLocationDirectories } from './internal/walk.js';
import type {
  AbortedReason,
  ContentRoot,
  EntryPath,
  InvalidLocationReason,
  IoErrorReason,
  JunkReason,
  NotFoundReason,
  OrphanedDataReason,
  PackageLocation,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
  WrongCaseReason,
} from './types.js';

/**
 * The longest `packageName` a copy accepts. Chromium writes each file through a
 * swap file named `<name>.crswap`, 7 characters longer, and FAT32 allows 255
 * (design record §4.3).
 */
const MAX_NAME_LENGTH = 248;

/** Progress reported by `copyTo`. */
export interface CopyProgress {
  /** Bytes copied so far, across every file. */
  copiedBytes: number;
  /** The package's size: the header plus every data file. */
  totalBytes: number;
  /** Files copied so far, each counted once it's closed and its size checked. */
  copiedFiles: number;
  totalFiles: number;
  /** The file being copied. */
  fileName: string;
}

export interface CopyToOptions {
  /** Fail if the source has junk, rather than ignore it. Default `false`. */
  failOnJunk?: boolean;
  /** Run `clean` on the copy afterwards, as a silent best-effort step. Default `true`. */
  cleanOutput?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: CopyProgress) => void;
}

/** The package's name is too long to write (see `MAX_NAME_LENGTH`). */
export interface NameTooLongReason {
  kind: 'name-too-long';
  length: number;
  max: typeof MAX_NAME_LENGTH;
}

/** The target is the source root. */
export interface SameRootReason {
  kind: 'same-root';
}

/** The package, or an entry with its name in another case, already exists at the target. */
export interface TargetExistsReason {
  kind: 'target-exists';
  /** The existing entry, in its spelling on disk. */
  path: EntryPath;
}

type RootReason =
  | PermissionDeniedReason
  | WrongCaseReason
  | NotFoundReason
  | OrphanedDataReason
  | UnexpectedEntryTypeReason
  | JunkReason
  | TargetExistsReason
  | IoErrorReason;

/** A reason about one of the two roots, saying which. */
export type OnRoot<T> = T & { root: 'source' | 'target' };

/** Why `copyTo` failed. */
export type CopyToFailureReason =
  InvalidLocationReason | NameTooLongReason | SameRootReason | OnRoot<RootReason> | AbortedReason;

type Failure = [false, CopyToFailureReason[]];

/** Says which root `reasons` are about. An `aborted` reason is about neither. */
function onRoot(root: 'source' | 'target', reasons: (RootReason | AbortedReason)[]): Failure {
  return [false, reasons.map((reason) => (reason.kind === 'aborted' ? reason : { ...reason, root }))];
}

/**
 * Copies one package from this root to the same location in another root. Bound
 * onto the root as `root.copyTo`.
 *
 * Function design doc, C1. It copies the header and, for an SVOD package, its
 * `.data/` directory and the files in it named `DataNNNN`; nothing else, ever
 * (C1.10). It never reads the header or verifies the package: a broken package is
 * copied as it is (C1.9). Junk in the source is ignored, or with `failOnJunk`
 * fails the copy (C1.11, C1.12). Every check runs before anything is written:
 * the location, a name of at most 248 characters, a different target root,
 * permission (`read` on this root, `readwrite` on the target), the source in
 * exact case (C1.6-C1.8), and the target: existing directories in exact case, and
 * no `name` or `name.data` there in any case (C1.13, C1.14). That last check is
 * repeated just before `name.data/` and the header are created, as the browser
 * has no "create only if new".
 *
 * It writes data files from the highest number down to `Data0000`, then the
 * header last, each in one write session through Chromium's swap file, read and
 * written chunk by chunk, checking each copy's size after closing it
 * (C1.18-C1.20). So an interrupted copy always
 * leaves something detectable: a swap file, an empty file, a `.data/` without
 * `Data0000`, or a `.data/` without its header. Nothing is rolled back (C1.21-C1.23).
 *
 * With `cleanOutput` (default `true`) it then runs `clean` on the copy, silently
 * and best-effort: its result, progress and any abort during it don't change
 * the copy's result, which is `[true]` once the header is copied (C1.24-C1.28).
 *
 * The browser can't read a drive's free space, so a full drive shows up as an
 * `io-error` part-way (C1.16).
 */
export async function copyTo(
  source: ContentRoot,
  target: ContentRoot,
  location: PackageLocation,
  options: CopyToOptions = {},
): Promise<[true] | Failure> {
  const { failOnJunk = false, cleanOutput = true, signal, onProgress } = options;
  const aborted = checkAborted(signal);
  if (aborted !== undefined) return [false, [aborted]];

  const [valid, checked] = checkLocation(location);
  if (!valid) return [false, checked];
  const { partition, titleId, contentType, packageName } = checked;
  if (packageName.length > MAX_NAME_LENGTH) {
    return [false, [{ kind: 'name-too-long', length: packageName.length, max: MAX_NAME_LENGTH }]];
  }

  // isSameEntry can return false for one directory reached by two spellings
  // (design record §2.4); roots from the folder picker are never affected. If it
  // throws, either handle may be at fault; the failure is reported for the source,
  // the root whose method was called.
  try {
    if (await source.handle.isSameEntry(target.handle)) return [false, [{ kind: 'same-root' }]];
  } catch (error) {
    return onRoot('source', [failureFrom(error, 'open', [])]);
  }

  const [readable, notReadable] = await checkPermission(source.handle, 'read');
  if (!readable) return onRoot('source', notReadable);
  const [writable, notWritable] = await checkPermission(target.handle, 'readwrite');
  if (!writable) return onRoot('target', notWritable);

  const dirPath = [partition, titleId, contentType];
  const dataName = `${packageName}.data`;
  const dataPath = [...dirPath, dataName];

  // The source.
  const [opened, sourceDir] = await openContentTypeDirectory(source.handle, checked);
  if (!opened) return onRoot('source', abortedOr(signal, sourceDir));
  const [inspected, entries] = await inspectPackage(sourceDir, dirPath, packageName, {
    dataContents: true,
    besideHeaderJunk: failOnJunk,
  });
  if (!inspected) return onRoot('source', abortedOr(signal, entries));
  const { header, dataDirectory, dataFiles } = entries;
  if (header === undefined) {
    const missing: OrphanedDataReason | NotFoundReason =
      dataDirectory === undefined
        ? { kind: 'not-found', path: [...dirPath, packageName] }
        : { kind: 'orphaned-data', path: dataPath };
    return onRoot('source', abortedOr(signal, [missing]));
  }
  if (failOnJunk) {
    const junk: JunkReason[] = [
      ...entries.dataJunk.map((name): JunkReason => ({ kind: 'junk', path: [...dataPath, name] })),
      ...entries.junkBesideHeader.map((name): JunkReason => ({ kind: 'junk', path: [...dirPath, name] })),
    ];
    if (junk.length > 0) return onRoot('source', abortedOr(signal, junk));
  }

  // The target, checked without creating anything yet.
  const [targetFound, targetDirs] = await openLocationDirectories(target.handle, checked);
  if (targetFound) {
    const [listed, listing] = await listDirectory(targetDirs[2], dirPath, signal);
    if (!listed) return onRoot('target', listing);
    for (const name of [packageName, dataName]) {
      const existing = findIgnoringCase(listing, name);
      if (existing !== undefined) {
        return onRoot('target', abortedOr(signal, [{ kind: 'target-exists', path: [...dirPath, existing] }]));
      }
    }
  } else if (targetDirs[0].kind !== 'not-found') {
    return onRoot('target', abortedOr(signal, targetDirs));
  }

  // What to copy. Every source file is opened before anything is written, so the
  // totals are known; data files go from the highest number down (C1.18).
  const dataToCopy: { name: string; file: File }[] = [];
  for (const { name, handle } of dataFiles.slice().reverse()) {
    try {
      dataToCopy.push({ name, file: await handle.getFile() });
    } catch (error) {
      return onRoot('source', [failureFrom(error, 'read', [...dataPath, name], signal)]);
    }
  }
  let headerFile: File;
  try {
    headerFile = await header.getFile();
  } catch (error) {
    return onRoot('source', [failureFrom(error, 'read', [...dirPath, packageName], signal)]);
  }
  const progress: CopyProgress = {
    copiedBytes: 0,
    totalBytes: dataToCopy.reduce((sum, { file }) => sum + file.size, headerFile.size),
    copiedFiles: 0,
    totalFiles: dataToCopy.length + 1,
    fileName: '',
  };

  const abortedBeforeWriting = checkAborted(signal);
  if (abortedBeforeWriting !== undefined) return [false, [abortedBeforeWriting]];

  // Writing. Directories first, created in the location's spelling (C1.17).
  const [created, targetDir] = await openContentTypeDirectory(target.handle, checked, { create: true });
  if (!created) return onRoot('target', abortedOr(signal, targetDir));

  // The browser has no "create only if new", so check again just before each
  // entry is created: something may have appeared since the first check, such as
  // another copy of the same package (C1.14). A gap remains between this check and
  // the creation itself.
  const recheck = async (names: string[]): Promise<Failure | undefined> => {
    const [listed, listing] = await listDirectory(targetDir, dirPath, signal);
    if (!listed) return onRoot('target', listing);
    for (const name of names) {
      const existing = findIgnoringCase(listing, name);
      if (existing !== undefined) {
        return onRoot('target', abortedOr(signal, [{ kind: 'target-exists', path: [...dirPath, existing] }]));
      }
    }
    return undefined;
  };

  if (dataDirectory !== undefined) {
    const appeared = await recheck([packageName, dataName]);
    if (appeared !== undefined) return appeared;
    let targetData: FileSystemDirectoryHandle;
    try {
      targetData = await targetDir.getDirectoryHandle(dataName, { create: true });
    } catch (error) {
      return onRoot('target', [failureFrom(error, 'create', dataPath, signal)]);
    }
    for (const { name, file } of dataToCopy) {
      const failure = await copyFile(file, targetData, [...dataPath, name], progress, signal, onProgress);
      if (failure !== undefined) return failure;
    }
  }

  const appeared = await recheck(dataDirectory === undefined ? [packageName, dataName] : [packageName]);
  if (appeared !== undefined) return appeared;
  const headerFailure = await copyFile(headerFile, targetDir, [...dirPath, packageName], progress, signal, onProgress);
  if (headerFailure !== undefined) return headerFailure;

  if (cleanOutput) {
    // Best-effort and silent (C1.25): its result, progress and abort are ignored.
    try {
      await clean(target, checked, { includeParents: true, ...(signal === undefined ? {} : { signal }) });
    } catch {
      // A clean that throws is still only a clean that failed.
    }
  }
  return [true];
}

/**
 * Copies one file in one write session (C1.19), checking the copy's size after
 * closing it (C1.20). Reads and writes chunk by chunk, so an abort is noticed
 * between chunks, and a failure is reported against the root it came from.
 * Gives `undefined` on success.
 */
async function copyFile(
  file: File,
  dir: FileSystemDirectoryHandle,
  path: EntryPath,
  progress: CopyProgress,
  signal: AbortSignal | undefined,
  onProgress: ((progress: CopyProgress) => void) | undefined,
): Promise<Failure | undefined> {
  const name = path.at(-1) ?? '';
  progress.fileName = name;
  const aborted = checkAborted(signal);
  if (aborted !== undefined) return [false, [aborted]];

  let handle: FileSystemFileHandle;
  let stream: FileSystemWritableFileStream;
  try {
    handle = await dir.getFileHandle(name, { create: true });
  } catch (error) {
    return onRoot('target', [failureFrom(error, 'create', path, signal)]);
  }
  try {
    stream = await handle.createWritable();
  } catch (error) {
    return onRoot('target', [failureFrom(error, 'write', path, signal)]);
  }

  // Abandons the write: Chromium deletes the swap file, leaving the empty file (C1.21).
  const abandon = async (reason: unknown): Promise<void> => {
    await stream.abort(reason).catch(() => undefined);
  };
  const reader = file.stream().getReader();
  for (;;) {
    const abortedDuring = checkAborted(signal);
    if (abortedDuring !== undefined) {
      await reader.cancel().catch(() => undefined);
      await abandon(abortedDuring.reason);
      return [false, [abortedDuring]];
    }
    let chunk: Uint8Array<ArrayBuffer>;
    try {
      const { done, value } = await reader.read();
      if (done) break;
      chunk = value;
    } catch (error) {
      await abandon(error);
      return onRoot('source', [failureFrom(error, 'read', path, signal)]);
    }
    try {
      await stream.write(chunk);
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      await abandon(error);
      return onRoot('target', [failureFrom(error, 'write', path, signal)]);
    }
    progress.copiedBytes += chunk.byteLength;
    reportProgress(onProgress, { ...progress });
  }

  const abortedBeforeClose = checkAborted(signal);
  if (abortedBeforeClose !== undefined) {
    await abandon(abortedBeforeClose.reason);
    return [false, [abortedBeforeClose]];
  }
  try {
    await stream.close();
  } catch (error) {
    return onRoot('target', [failureFrom(error, 'close', path, signal)]);
  }

  let copiedSize: number;
  try {
    copiedSize = (await handle.getFile()).size;
  } catch (error) {
    return onRoot('target', [failureFrom(error, 'verify-size', path, signal)]);
  }
  if (copiedSize !== file.size) {
    return onRoot('target', [
      {
        kind: 'io-error',
        operation: 'verify-size',
        path,
        error: {
          name: 'SizeMismatchError',
          message: `Expected ${String(file.size)} bytes, but the copy has ${String(copiedSize)}.`,
        },
      },
    ]);
  }
  progress.copiedFiles++;
  reportProgress(onProgress, { ...progress });
  return undefined;
}
