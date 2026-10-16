// Recording callbacks, and standing in for `reportError`, which Node lacks.

import { vi } from 'vitest';

/** A callback that records every argument it's called with, in order. */
export function recordCalls<T>(): { fn: (arg: T) => void; calls: T[] } {
  const calls: T[] = [];
  return {
    fn: (arg) => {
      calls.push(arg);
    },
    calls,
  };
}

/**
 * Replaces the global `reportError` for the current test, and returns what it
 * receives. Node doesn't provide `reportError` (function design doc, rule 11.3).
 * Vitest restores the global after each test (`unstubGlobals` in its config).
 */
export function stubReportError(): unknown[] {
  const reported: unknown[] = [];
  vi.stubGlobal('reportError', (error: unknown) => {
    reported.push(error);
  });
  return reported;
}
