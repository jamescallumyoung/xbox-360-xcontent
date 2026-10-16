// Signals that abort part-way through an operation.

import type { DriveOperation, TestDrive } from './test-drive.js';

/**
 * A callback, such as an `onProgress`, that records its calls and aborts the
 * returned signal during the `n`th call (counting from 1).
 */
export function abortAfterCalls<T>(
  n: number,
  reason?: unknown,
): { signal: AbortSignal; fn: (arg: T) => void; calls: T[] } {
  const controller = new AbortController();
  const calls: T[] = [];
  return {
    signal: controller.signal,
    fn: (arg) => {
      calls.push(arg);
      if (calls.length === n) controller.abort(reason);
    },
    calls,
  };
}

/**
 * Returns a signal that is aborted when a given operation starts on `drive`.
 *
 * Matching operations are counted, and the signal is aborted at the start of
 * match number `after + 1` (the first match, by default). That operation is not
 * stopped: it still completes. The code under test only sees the abort when it
 * next checks the signal, just as when a user presses Stop part-way through.
 */
export function abortOnOperation(
  drive: TestDrive,
  match: { operation: DriveOperation; path?: readonly string[]; after?: number },
  reason?: unknown,
): AbortSignal {
  const controller = new AbortController();
  let seen = 0;
  const stop = drive.onOperation(({ operation, path }) => {
    if (operation !== match.operation) return;
    if (match.path !== undefined && match.path.join('/') !== path.join('/')) return;
    seen++;
    if (seen > (match.after ?? 0)) {
      controller.abort(reason);
      stop();
    }
  });
  return controller.signal;
}
