import type { AbortedReason } from '../types.js';

/**
 * The `aborted` reason for an aborted signal, carrying the signal's own reason.
 *
 * Function design doc, rule 10.
 */
export function abortedReason(signal: AbortSignal): AbortedReason {
  return { kind: 'aborted', reason: signal.reason };
}

/**
 * The `aborted` reason if `signal` has been aborted, otherwise `undefined`.
 * Functions call it before starting, and between steps (rule 10).
 */
export function checkAborted(signal: AbortSignal | undefined): AbortedReason | undefined {
  return signal?.aborted === true ? abortedReason(signal) : undefined;
}

/**
 * `reasons`, or the `aborted` reason instead if `signal` has been aborted.
 *
 * Function design doc, rule 10. Checks that read the drive can fail, or find
 * junk or a missing entry, after the caller has aborted; the abort is what the
 * caller asked about, so it's reported instead.
 */
export function abortedOr<T>(signal: AbortSignal | undefined, reasons: T[]): T[] | [AbortedReason] {
  const aborted = checkAborted(signal);
  return aborted === undefined ? reasons : [aborted];
}
