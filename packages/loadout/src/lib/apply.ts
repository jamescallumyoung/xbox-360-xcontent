// Running the queue (docs/lib-design.md, A1).

import type { ContentRoot, CopyToFailureReason } from 'xcontent-fs-web';
import { clean } from 'xcontent-fs-web/extended';
import type { ChangeFailureReason } from './messages.js';
import type { ApplyProgress, Change, PackageLocation } from './types.js';

/** How an apply ended. */
export interface ApplyResult {
  /** The changes applied, in the order they ran (A1.6). */
  applied: Change[];
  /** The change that failed, if one did; nothing after it ran (A1.5). */
  failed?: { change: Change; reasons: ChangeFailureReason[] };
  /** True when `shouldStop` ended the run with changes left (A1.4). */
  stopped: boolean;
}

export interface ApplyOptions {
  vault: ContentRoot;
  drive: ContentRoot;
  /** A package's size, to weigh an add's share of the progress (A1.7). */
  bytesOf: (change: Change) => number;
  /** Checked after each change; `true` stops the run (A1.4). */
  shouldStop?: () => boolean;
  onProgress?: (progress: ApplyProgress) => void;
}

/** What a removal weighs in the overall progress (A1.7). */
const REMOVAL_WEIGHT = 2 ** 20;

/**
 * Target operations `copyTo` only does once it has checked the target was free
 * (A1.9). The one gap is a race: another tab creating the same package between
 * that check and the copy's first write. Two tabs on one drive isn't supported.
 */
const WRITING = new Set(['create', 'write', 'close', 'verify-size']);

async function removePackage(
  drive: ContentRoot,
  location: PackageLocation,
  report: (fraction: number) => void,
): Promise<ChangeFailureReason[] | undefined> {
  const [cleaned, cleanFailure] = await clean(drive, location);
  if (!cleaned) return cleanFailure;
  const [deleted, deleteFailure] = await drive.deletePackage(location, {
    onProgress: ({ deletedFiles, totalFiles }) => {
      report(totalFiles === 0 ? 1 : deletedFiles / totalFiles);
    },
  });
  return deleted ? undefined : deleteFailure;
}

async function addPackage(
  { vault, drive }: ApplyOptions,
  location: PackageLocation,
  report: (fraction: number) => void,
): Promise<ChangeFailureReason[] | undefined> {
  const [copied, reasons] = await vault.copyTo(drive, location, {
    onProgress: ({ copiedBytes, totalBytes }) => {
      report(totalBytes === 0 ? 1 : copiedBytes / totalBytes);
    },
  });
  if (copied) return undefined;
  if (wroteToTarget(reasons[0])) {
    // Everything at the location was written by this copy, so remove it (A1.9).
    await clean(drive, location);
    await drive.deletePackage(location);
  }
  return reasons;
}

function wroteToTarget(reason: CopyToFailureReason | undefined): boolean {
  return reason?.kind === 'io-error' && reason.root === 'target' && WRITING.has(reason.operation);
}

/** The order changes are applied in: every removal, then every add, each in queue order (A1.1). */
export function applyOrder(changes: readonly Change[]): Change[] {
  return [...changes.filter((c) => c.op === 'remove'), ...changes.filter((c) => c.op === 'add')];
}

/**
 * Applies the queue: every removal, then every add, each in queue order (A1.1).
 * It stops at the first failure (A1.5), or between changes when `shouldStop`
 * says so (A1.4). There's no abort: a change in progress always finishes.
 */
export async function runApply(changes: readonly Change[], options: ApplyOptions): Promise<ApplyResult> {
  const order = applyOrder(changes).map((change) => ({
    change,
    weight: change.op === 'add' ? options.bytesOf(change) : REMOVAL_WEIGHT,
  }));
  const totalWeight = order.reduce((sum, { weight }) => sum + weight, 0);
  const applied: Change[] = [];
  let doneWeight = 0;

  for (const [index, { change, weight }] of order.entries()) {
    const report = (changeFraction: number) => {
      try {
        options.onProgress?.({
          change,
          index,
          total: order.length,
          changeFraction,
          fraction: totalWeight === 0 ? changeFraction : (doneWeight + weight * changeFraction) / totalWeight,
        });
      } catch (error) {
        // Progress is watched, not controlled: a throwing callback mustn't lose the apply.
        console.error(error);
      }
    };
    report(0);
    const reasons =
      change.op === 'remove'
        ? await removePackage(options.drive, change.location, report)
        : await addPackage(options, change.location, report);
    if (reasons !== undefined) return { applied, failed: { change, reasons }, stopped: false };
    report(1);
    doneWeight += weight;
    applied.push(change);
    if (index < order.length - 1 && options.shouldStop?.() === true) return { applied, stopped: true };
  }
  return { applied, stopped: false };
}
