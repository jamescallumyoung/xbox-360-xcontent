/**
 * Calls the caller's `onProgress`, if there is one, without letting it break the
 * operation.
 *
 * Function design doc, rule 11. The callback runs synchronously, so its numbers
 * match the current state. If it throws, the exception goes to
 * `globalThis.reportError()`, which reports it as a throwing event listener is
 * reported (the page's `error` event and the console), and the operation
 * carries on: progress is something the caller watches, not controls.
 */
export function reportProgress<T>(onProgress: ((progress: T) => void) | undefined, progress: T): void {
  if (onProgress === undefined) return;
  try {
    onProgress(progress);
  } catch (error) {
    reportError(error);
  }
}
