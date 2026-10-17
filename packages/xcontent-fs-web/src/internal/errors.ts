import type { AbortedReason, EntryPath, IoErrorReason, IoOperation, PermissionDeniedReason } from '../types.js';
import { abortedReason } from './abort.js';

const WRITE_OPERATIONS: ReadonlySet<IoOperation> = new Set(['create', 'write', 'close', 'remove']);

/**
 * Turns an exception from the browser into a failure reason.
 *
 * Function design doc, rule 12: `NotAllowedError` and `SecurityError` become
 * `permission-denied`, and everything else `io-error`, carrying the operation,
 * the path and the exception's `name` and `message`. Chromium's mapping is
 * coarse (a pulled drive looks like a deleted file), so no finer reasons are
 * made from it.
 *
 * A thrown `permission-denied` doesn't say whether the browser would prompt, so
 * its `state` is `denied`. Its `mode` follows the operation: `readwrite` for
 * changes, `read` otherwise.
 *
 * If `signal` has been aborted, the result is `aborted` whatever was thrown,
 * because aborting is what makes a stream reject (rule 10).
 */
export function failureFrom(
  error: unknown,
  operation: IoOperation,
  path: EntryPath,
): PermissionDeniedReason | IoErrorReason;
export function failureFrom(
  error: unknown,
  operation: IoOperation,
  path: EntryPath,
  signal: AbortSignal | undefined,
): PermissionDeniedReason | IoErrorReason | AbortedReason;
export function failureFrom(
  error: unknown,
  operation: IoOperation,
  path: EntryPath,
  signal?: AbortSignal,
): PermissionDeniedReason | IoErrorReason | AbortedReason {
  if (signal?.aborted === true) return abortedReason(signal);
  const { name, message } = describe(error);
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { kind: 'permission-denied', mode: WRITE_OPERATIONS.has(operation) ? 'readwrite' : 'read', state: 'denied' };
  }
  return { kind: 'io-error', operation, path: [...path], error: { name, message } };
}

function describe(error: unknown): { name: string; message: string } {
  if (typeof error === 'object' && error !== null && 'name' in error && 'message' in error) {
    return { name: String(error.name), message: String(error.message) };
  }
  return { name: 'Error', message: String(error) };
}

/**
 * Whether the browser reported that an entry doesn't exist. Used where an entry
 * listed a moment ago may have gone since: on macOS, removing a file also
 * removes its AppleDouble file (design record §2.4).
 */
export function isNotFoundError(error: unknown): boolean {
  return describe(error).name === 'NotFoundError';
}
