import type { IoErrorReason, PermissionDeniedReason } from '../types.js';
import { failureFrom } from './errors.js';

/**
 * Checks that the page may use `handle` in `mode`, without ever asking the user.
 *
 * Function design doc, rule 9. It calls `queryPermission`, never
 * `requestPermission`: prompting needs a user gesture, and is the caller's job
 * (record §4.2). Permission can be withdrawn at any time, so every function
 * checks it again when called.
 */
export async function checkPermission(
  handle: FileSystemHandle,
  mode: 'read' | 'readwrite',
): Promise<[true] | [false, [PermissionDeniedReason | IoErrorReason]]> {
  try {
    const state = await handle.queryPermission({ mode });
    if (state === 'granted') return [true];
    return [false, [{ kind: 'permission-denied', mode, state }]];
  } catch (error) {
    return [false, [failureFrom(error, 'open', [])]];
  }
}
