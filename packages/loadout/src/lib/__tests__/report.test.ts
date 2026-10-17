import { describe, expect, it } from 'vitest';
import { buildApplyReport, reportChange, reportFileName } from '../report.js';
import { pkg } from './helpers/builders.js';

describe('reportChange', () => {
  it('records the change, the package and its path (RP1.1)', () => {
    const p = pkg({ packageName: 'GAME', name: 'Halo 3', format: 'svod', headerFileBytes: 100, dataFilesBytes: 900 });
    expect(reportChange('add', 'Halo 3', p)).toEqual({
      op: 'add',
      titleId: '4D5307E6',
      titleName: 'Halo 3',
      package: {
        name: 'Halo 3',
        contentType: '00007000',
        contentTypeName: 'GameOnDemand',
        file: 'GAME',
        svod: true,
        bytes: 1000,
      },
      path: '0000000000000000/4D5307E6/00007000/GAME',
    });
  });
});

describe('buildApplyReport', () => {
  const add = reportChange('add', 'A', pkg({ titleId: 'AAAAAAAA', headerFileBytes: 10 }));
  const add2 = reportChange('add', 'B', pkg({ titleId: 'BBBBBBBB', headerFileBytes: 5 }));
  const remove = reportChange('remove', 'A', pkg({ titleId: 'AAAAAAAA', packageName: 'X', headerFileBytes: 3 }));

  it('summarises the changes (RP1.2)', () => {
    const report = buildApplyReport({
      changes: [remove, add, add2],
      startedAt: new Date('2026-10-17T10:00:00Z'),
      finishedAt: new Date('2026-10-17T10:01:30.400Z'),
      vaultFolderName: 'Content',
      driveFolderName: 'Content',
    });
    expect(report).toEqual({
      format: 'loadout.apply-report',
      version: 1,
      appliedAt: '2026-10-17T10:01:30.400Z',
      durationSeconds: 90,
      stopped: false,
      vault: { folderName: 'Content' },
      drive: { folderName: 'Content' },
      summary: {
        changes: 3,
        titles: 2,
        added: { count: 2, bytes: 15 },
        removed: { count: 1, bytes: 3 },
      },
      changes: [remove, add, add2],
    });
  });

  it('records a stopped apply (RP1.2)', () => {
    const at = new Date(0);
    const report = buildApplyReport({
      changes: [],
      startedAt: at,
      finishedAt: at,
      vaultFolderName: 'v',
      driveFolderName: 'd',
      stopped: true,
    });
    expect(report.stopped).toBe(true);
  });

  it('never gives a negative duration (RP1.2)', () => {
    const report = buildApplyReport({
      changes: [],
      startedAt: new Date(2000),
      finishedAt: new Date(1000),
      vaultFolderName: 'v',
      driveFolderName: 'd',
    });
    expect(report.durationSeconds).toBe(0);
  });
});

describe('reportFileName', () => {
  it('uses the local date and time (RP1.3)', () => {
    const finishedAt = new Date(2026, 9, 7, 4, 8);
    const report = buildApplyReport({
      changes: [],
      startedAt: finishedAt,
      finishedAt,
      vaultFolderName: 'v',
      driveFolderName: 'd',
    });
    expect(reportFileName(report)).toBe('loadout-report-2026-10-07-0408.json');
  });
});
