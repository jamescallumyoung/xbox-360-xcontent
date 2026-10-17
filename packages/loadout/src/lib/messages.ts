// Failure reasons in plain language (docs/lib-design.md, M1).

import type { CopyToFailureReason, DeletePackageFailureReason } from 'xcontent-fs-web';
import type { CleanFailureReason } from 'xcontent-fs-web/extended';
import type { ChangeOp } from './types.js';

/** Any reason a change can fail with. */
export type ChangeFailureReason = CopyToFailureReason | DeletePackageFailureReason | CleanFailureReason;

/**
 * One sentence for the UI, from the first reason (M1.7). For an add, a reason's
 * `root` says which folder it's about; a removal only touches the drive.
 */
export function describeFailure(op: ChangeOp, reasons: readonly ChangeFailureReason[]): string {
  const reason = reasons[0];
  const failed = op === 'add' ? 'The copy failed' : 'The removal failed';
  if (reason === undefined) return `${failed}.`;
  const root = op === 'add' && 'root' in reason && reason.root === 'source' ? 'vault' : 'drive';
  switch (reason.kind) {
    case 'target-exists':
      return 'The package is already on the drive. Remove it first, then add it again.';
    case 'io-error':
      if (reason.error.name === 'NotFoundError' || reason.error.name === 'InvalidStateError') {
        return `The ${root} was disconnected.`;
      }
      return `The ${root} reported an error: ${reason.error.message || reason.error.name}.`;
    case 'permission-denied':
      return `Loadout no longer has permission to use the ${root}.`;
    case 'not-found':
    case 'orphaned-data':
      return `The package has changed on the ${root} since it was scanned. Rescan and try again.`;
    case 'wrong-case':
      return `A folder on the ${root} has the same name in different letter case ("${reason.found}").`;
    case 'junk':
      return `The package has leftover files on the ${root} that Loadout can't remove.`;
    case 'name-too-long':
      return "The package's name is too long for the browser to write.";
    default:
      return `${failed} (${reason.kind}).`;
  }
}
