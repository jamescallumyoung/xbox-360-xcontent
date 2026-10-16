import { abortedOr, checkAborted } from './internal/abort.js';
import { failureFrom } from './internal/errors.js';
import { inspectPackage } from './internal/inspect.js';
import { checkLocation } from './internal/location.js';
import { checkPermission } from './internal/permission.js';
import { reportProgress } from './internal/progress.js';
import { openContentTypeDirectory } from './internal/walk.js';
import type {
  AbortedReason,
  ContentRoot,
  InvalidLocationReason,
  IoErrorReason,
  NotFoundReason,
  OrphanedDataReason,
  PackageLocation,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
  WrongCaseReason,
} from './types.js';

/** How many bytes `readHeaderBytes` reads: always enough for `xcontent-header`. */
const HEADER_READ_SIZE = 0xb000;

/** Progress reported by `readHeaderBytes`. */
export interface ReadProgress {
  readBytes: number;
  /** The smaller of the file's size and `0xB000`. */
  totalBytes: number;
}

export interface ReadHeaderBytesOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ReadProgress) => void;
}

/** Why `readHeaderBytes` failed. */
export type ReadHeaderBytesFailureReason =
  | InvalidLocationReason
  | PermissionDeniedReason
  | WrongCaseReason
  | NotFoundReason
  | OrphanedDataReason
  | UnexpectedEntryTypeReason
  | AbortedReason
  | IoErrorReason;

/**
 * Reads the first `0xB000` bytes of a package's header file, for
 * `xcontent-header`'s functions. Bound onto the root as `root.readHeaderBytes`.
 *
 * Function design doc, H1. It only does I/O: it doesn't parse or check the
 * bytes, not even the magic, and never looks at `name.data/` (H1.8). A file
 * shorter than `0xB000` bytes gives what it has, even nothing (H1.7). The
 * location is checked first (H1.2), and every directory and the header must
 * match its case exactly (H1.3). A `name.data/` without a header is
 * `orphaned-data` (H1.4).
 *
 * The file is read as a stream, so progress is reported and an abort cancels
 * the read (H1.9). The result is always a new array, the only view of its own
 * `ArrayBuffer` (H1.10).
 */
export async function readHeaderBytes(
  root: ContentRoot,
  location: PackageLocation,
  options: ReadHeaderBytesOptions = {},
): Promise<[true, Uint8Array] | [false, ReadHeaderBytesFailureReason[]]> {
  const { signal, onProgress } = options;
  const aborted = checkAborted(signal);
  if (aborted !== undefined) return [false, [aborted]];

  const [valid, checked] = checkLocation(location);
  if (!valid) return [false, checked];
  const { partition, titleId, contentType, packageName } = checked;

  const [permitted, denied] = await checkPermission(root.handle, 'read');
  if (!permitted) return [false, denied];

  const [opened, dir] = await openContentTypeDirectory(root.handle, checked);
  if (!opened) return [false, abortedOr(signal, dir)];
  const dirPath = [partition, titleId, contentType];
  const headerPath = [...dirPath, packageName];

  const [inspected, entries] = await inspectPackage(dir, dirPath, packageName);
  if (!inspected) return [false, abortedOr(signal, entries)];
  if (entries.header === undefined) {
    if (entries.dataDirectory !== undefined) {
      return [false, [{ kind: 'orphaned-data', path: [...dirPath, `${packageName}.data`] }]];
    }
    return [false, [{ kind: 'not-found', path: headerPath }]];
  }

  return readStart(entries.header, headerPath, signal, onProgress);
}

/** Reads up to `HEADER_READ_SIZE` bytes from the start of a file, as a stream. */
async function readStart(
  header: FileSystemFileHandle,
  headerPath: string[],
  signal: AbortSignal | undefined,
  onProgress: ((progress: ReadProgress) => void) | undefined,
): Promise<[true, Uint8Array] | [false, (PermissionDeniedReason | IoErrorReason | AbortedReason)[]]> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = (): void => {
    void reader?.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', cancel);
  try {
    const file = await header.getFile();
    const totalBytes = Math.min(file.size, HEADER_READ_SIZE);
    const bytes = new Uint8Array(totalBytes);
    reader = file.slice(0, totalBytes).stream().getReader();
    let readBytes = 0;
    for (;;) {
      const abortedDuring = checkAborted(signal);
      if (abortedDuring !== undefined) {
        cancel();
        return [false, [abortedDuring]];
      }
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, totalBytes - readBytes);
      bytes.set(chunk, readBytes);
      readBytes += chunk.length;
      reportProgress(onProgress, { readBytes, totalBytes });
    }
    const abortedAfter = checkAborted(signal);
    if (abortedAfter !== undefined) return [false, [abortedAfter]];
    // If the file shrank while being read, copy the bytes into a buffer of their own.
    return [true, readBytes === totalBytes ? bytes : bytes.slice(0, readBytes)];
  } catch (error) {
    return [false, [failureFrom(error, 'read', headerPath, signal)]];
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
