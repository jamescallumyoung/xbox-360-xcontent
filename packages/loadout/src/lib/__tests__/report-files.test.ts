import { describe, expect, it } from 'vitest';
import { buildApplyReport, reportJson } from '../report.js';
import { saveReportToDrive, type SaveFilePicker } from '../report-files.js';
import { folder, type TestFolder } from './helpers/drive.js';

const finishedAt = new Date(2026, 9, 17, 9, 5);
const report = buildApplyReport({
  changes: [],
  startedAt: finishedAt,
  finishedAt,
  vaultFolderName: 'v',
  driveFolderName: 'd',
});
const FILE = 'loadout-report-2026-10-17-0905.json';

/** A picker that "chooses" `path` in `where`, recording the options it was given. */
function pickerAt(where: TestFolder, path: string[]) {
  const calls: Parameters<SaveFilePicker>[0][] = [];
  const picker: SaveFilePicker = async (options) => {
    calls.push(options);
    let dir = where.handle;
    for (const part of path.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
    // Chromium may create the file as soon as it's picked.
    return dir.getFileHandle(path.at(-1) ?? '', { create: true });
  };
  return { picker, calls };
}

async function read(where: TestFolder, path: string): Promise<string> {
  let dir = where.handle;
  const parts = path.split('/');
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  return (await (await dir.getFileHandle(parts.at(-1) ?? '')).getFile()).text();
}

describe('saveReportToDrive', () => {
  it('opens the dialog at the drive with the report file name (RF1.1)', async () => {
    const drive = folder();
    const outside = folder({}, { name: 'USB' });
    const { picker, calls } = pickerAt(outside, [FILE]);
    await saveReportToDrive(report, drive.handle, picker);
    expect(calls[0]).toMatchObject({ suggestedName: FILE, startIn: drive.handle });
  });

  it('returns cancelled when the dialog is dismissed (RF1.2)', async () => {
    const picker: SaveFilePicker = () => Promise.reject(new DOMException('Cancelled', 'AbortError'));
    expect(await saveReportToDrive(report, folder().handle, picker)).toEqual({ status: 'cancelled' });
  });

  it('refuses a file inside the partition root, removing the empty file (RF1.3)', async () => {
    const drive = folder({ '0000000000000000/': null });
    const { picker } = pickerAt(drive, ['0000000000000000', FILE]);
    expect(await saveReportToDrive(report, drive.handle, picker)).toEqual({ status: 'inside-partition-root' });
    expect(drive.list()).toEqual(['0000000000000000/']);
  });

  it('keeps a file with contents when refusing (RF1.3)', async () => {
    const drive = folder({ [`0000000000000000/${FILE}`]: 'keep me' });
    const { picker } = pickerAt(drive, ['0000000000000000', FILE]);
    expect(await saveReportToDrive(report, drive.handle, picker)).toEqual({ status: 'inside-partition-root' });
    expect(await read(drive, `0000000000000000/${FILE}`)).toBe('keep me');
  });

  it('writes the report anywhere else (RF1.4)', async () => {
    const outside = folder({}, { name: 'USB' });
    const { picker } = pickerAt(outside, [FILE]);
    expect(await saveReportToDrive(report, folder().handle, picker)).toEqual({ status: 'saved', fileName: FILE });
    expect(await read(outside, FILE)).toBe(reportJson(report));
  });
});
