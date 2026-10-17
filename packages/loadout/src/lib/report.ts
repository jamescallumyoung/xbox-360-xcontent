// The apply report (docs/lib-design.md, RP1; docs/features.md, section 7a).

import { contentTypeName } from './content-types.js';
import { packageBytes } from './titles.js';
import type { ChangeOp, Package } from './types.js';

/** One applied change, as recorded in the report. */
export interface ReportChange {
  op: ChangeOp;
  titleId: string;
  titleName: string;
  package: {
    name: string;
    contentType: string;
    contentTypeName: string;
    file: string;
    svod: boolean;
    bytes: number;
  };
  /** Path inside the partition root: `<partition>/<TitleID>/<ContentType>/<file>`. */
  path: string;
}

/** The JSON file offered after a successful apply. */
export interface ApplyReport {
  format: 'loadout.apply-report';
  version: 1;
  appliedAt: string;
  durationSeconds: number;
  /** True when the user stopped the apply part-way: the changes listed are the ones applied. */
  stopped: boolean;
  /** Folder names only: the browser never reveals absolute paths. */
  vault: { folderName: string };
  drive: { folderName: string };
  summary: {
    changes: number;
    titles: number;
    added: { count: number; bytes: number };
    removed: { count: number; bytes: number };
  };
  changes: ReportChange[];
}

/** Records one applied change (RP1.1). */
export function reportChange(op: ChangeOp, titleName: string, p: Package): ReportChange {
  const { partition, titleId, contentType, packageName } = p.location;
  return {
    op,
    titleId,
    titleName,
    package: {
      name: p.name,
      contentType,
      contentTypeName: contentTypeName(contentType),
      file: packageName,
      svod: p.format === 'svod',
      bytes: packageBytes(p),
    },
    path: `${partition}/${titleId}/${contentType}/${packageName}`,
  };
}

/** Builds the report of a finished apply (RP1.2). */
export function buildApplyReport(input: {
  changes: ReportChange[];
  startedAt: Date;
  finishedAt: Date;
  vaultFolderName: string;
  driveFolderName: string;
  stopped?: boolean;
}): ApplyReport {
  const { changes } = input;
  const ofOp = (op: ChangeOp) => changes.filter((c) => c.op === op);
  const total = (cs: ReportChange[]) => ({ count: cs.length, bytes: cs.reduce((s, c) => s + c.package.bytes, 0) });
  return {
    format: 'loadout.apply-report',
    version: 1,
    appliedAt: input.finishedAt.toISOString(),
    stopped: input.stopped ?? false,
    durationSeconds: Math.max(0, Math.round((input.finishedAt.getTime() - input.startedAt.getTime()) / 1000)),
    vault: { folderName: input.vaultFolderName },
    drive: { folderName: input.driveFolderName },
    summary: {
      changes: changes.length,
      titles: new Set(changes.map((c) => c.titleId)).size,
      added: total(ofOp('add')),
      removed: total(ofOp('remove')),
    },
    changes,
  };
}

/** `loadout-report-YYYY-MM-DD-HHMM.json`, in local time (RP1.3). */
export function reportFileName(report: ApplyReport): string {
  const d = new Date(report.appliedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return `loadout-report-${date}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/** The report as the JSON text that is saved. */
export function reportJson(report: ApplyReport): string {
  return JSON.stringify(report, null, 2);
}
