// Getting the apply report out of the browser (docs/lib-design.md, RF1).

import { reportFileName, reportJson, type ApplyReport } from './report.js';

/** Saves the report to the downloads folder. No permission needed (RF1.5). */
export function downloadReport(report: ApplyReport): void {
  const url = URL.createObjectURL(new Blob([reportJson(report)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = reportFileName(report);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export type SaveToDriveResult =
  { status: 'saved'; fileName: string } | { status: 'cancelled' } | { status: 'inside-partition-root' };

/** `window.showSaveFilePicker`, which TypeScript's `dom` lib doesn't declare. */
export type SaveFilePicker = (options: {
  suggestedName: string;
  startIn: FileSystemHandle;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

/**
 * Asks where to save the report, starting at the drive, then writes it (RF1.1).
 * The file handle lives only in this call and is never stored, so the
 * permission is one-off. A location inside the drive's partition root is refused,
 * because that folder may only hold partitions (RF1.3).
 */
export async function saveReportToDrive(
  report: ApplyReport,
  drive: FileSystemDirectoryHandle,
  picker: SaveFilePicker,
): Promise<SaveToDriveResult> {
  let file: FileSystemFileHandle;
  try {
    file = await picker({
      suggestedName: reportFileName(report),
      startIn: drive,
      types: [{ description: 'Loadout report', accept: { 'application/json': ['.json'] } }],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { status: 'cancelled' };
    throw error;
  }

  const inside = await drive.resolve(file);
  if (inside !== null) {
    // Chromium may already have made an empty file there: remove it if it's empty,
    // best-effort. (An empty file the user picked on purpose goes too.)
    try {
      let parent = drive;
      for (const name of inside.slice(0, -1)) parent = await parent.getDirectoryHandle(name);
      if ((await file.getFile()).size === 0) await parent.removeEntry(file.name);
    } catch {
      // Nothing to tidy up, or it can't be: the refusal stands either way.
    }
    return { status: 'inside-partition-root' };
  }

  const writable = await file.createWritable();
  try {
    await writable.write(reportJson(report));
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
  return { status: 'saved', fileName: file.name };
}
