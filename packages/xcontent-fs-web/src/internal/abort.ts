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
