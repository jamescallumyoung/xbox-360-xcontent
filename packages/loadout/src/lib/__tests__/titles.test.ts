import { describe, expect, it } from 'vitest';
import type { Change, LibraryTitle, Title } from '../types.js';
import {
  applyFilters,
  canAdd,
  canRemove,
  changeKey,
  coverPalette,
  describeEmpty,
  driveSummary,
  formatSize,
  gameType,
  libraryTitles,
  packageBytes,
  packageKey,
  packageRows,
  resolveAppStatus,
  searchTitles,
  sortTitles,
  titleBytes,
  titleFlags,
  titleStatus,
} from '../titles.js';
import { pkg, title } from './helpers/builders.js';

const MB = 2 ** 20;
const GB = 2 ** 30;

describe('keys', () => {
  it('key a package by Title ID, content type and name', () => {
    expect(packageKey(pkg({ packageName: 'ABC' }).location)).toBe('4D5307E6/00007000/ABC');
  });

  it('key a change by its op and package', () => {
    const location = pkg().location;
    expect(changeKey({ op: 'add', location })).toBe('add|4D5307E6/00007000/PKG');
  });
});

describe('sizes', () => {
  it('count the header file plus the data files (T1.1)', () => {
    expect(packageBytes(pkg({ headerFileBytes: 45056, dataFilesBytes: 3 * GB }))).toBe(45056 + 3 * GB);
  });

  it('add up a title (T1.2)', () => {
    const t = title('4D5307E6', {}, [pkg({ headerFileBytes: 10 }), pkg({ packageName: 'B', headerFileBytes: 5 })]);
    expect(titleBytes(t)).toBe(15);
  });

  it('format as MB below 1 GB, and GB from there (T1.3)', () => {
    expect(formatSize(0)).toBe('0 MB');
    expect(formatSize(10)).toBe('1 MB');
    expect(formatSize(300 * MB)).toBe('300 MB');
    expect(formatSize(1023 * MB)).toBe('1023 MB');
    expect(formatSize(1.5 * GB)).toBe('1.5 GB');
    expect(formatSize(150 * GB)).toBe('150 GB');
  });

  it('choose the unit after rounding (T1.3)', () => {
    expect(formatSize(1023.6 * MB)).toBe('1.0 GB');
    expect(formatSize(99.96 * GB)).toBe('100 GB');
  });
});

describe('title kinds', () => {
  it('flag game, title update, DLC and other packages, never saves (T1.4)', () => {
    const t = title('4D5307E6', {}, [
      pkg({ kind: 'title-update', packageName: 'TU' }),
      pkg({ kind: 'save', packageName: 'SAVE' }),
    ]);
    expect(titleFlags(t)).toEqual({ playable: false, hasTitleUpdate: true, hasDlc: false, hasOtherContent: false });
  });

  it('flag every kind present (T1.4)', () => {
    const t = title('4D5307E6', {}, [
      pkg({ packageName: 'G' }),
      pkg({ packageName: 'D', kind: 'dlc' }),
      pkg({ packageName: 'O', kind: 'other' }),
    ]);
    expect(titleFlags(t)).toEqual({ playable: true, hasTitleUpdate: false, hasDlc: true, hasOtherContent: true });
  });

  it('call a title GOD only when it has a 00007000 package (T1.5)', () => {
    expect(gameType(title('A', {}, [pkg({ contentType: '00007000' })]))).toBe('GOD');
    expect(gameType(title('A', {}, [pkg({ contentType: '000D0000' })]))).toBe('Other');
  });
});

describe('drive status', () => {
  const a = pkg({ packageName: 'A' });
  const b = pkg({ packageName: 'B' });
  const vault = title('4D5307E6', {}, [a, b]);

  it('is on-drive when every vault package is on the drive (T1.6a)', () => {
    expect(titleStatus(vault, title('4D5307E6', {}, [a, b]), false)).toBe('on-drive');
  });

  it('is partial when some are, and not-on-drive when none are (T1.6a)', () => {
    expect(titleStatus(vault, title('4D5307E6', {}, [a]), false)).toBe('partial');
    expect(titleStatus(vault, undefined, false)).toBe('not-on-drive');
  });

  it('does not count a corrupt drive copy as on the drive (T1.6)', () => {
    expect(titleStatus(vault, title('4D5307E6', {}, [a, { ...b, corrupt: true }]), false)).toBe('partial');
  });

  it('ignores saves, which Loadout never copies (T1.6a)', () => {
    const withSave = title('4D5307E6', {}, [a, pkg({ packageName: 'S', kind: 'save', contentType: '00000001' })]);
    expect(titleStatus(withSave, title('4D5307E6', {}, [a]), false)).toBe('on-drive');
  });

  it('is queued whenever the title has queued changes (T1.6a)', () => {
    expect(titleStatus(vault, title('4D5307E6', {}, [a, b]), true)).toBe('queued');
  });
});

describe('packageRows', () => {
  it('lists each package once, with its vault and drive copies (T1.6b)', () => {
    const inBoth = pkg({ packageName: 'BOTH' });
    const vaultOnly = pkg({ packageName: 'VAULT', kind: 'dlc', contentType: '00000002' });
    const driveOnly = pkg({ packageName: 'DRIVE', kind: 'title-update', contentType: '000B0000' });
    const rows = packageRows(title('T', {}, [inBoth, vaultOnly]), title('T', {}, [inBoth, driveOnly]));
    expect(rows.map((r) => [r.vault?.location.packageName, r.drive?.location.packageName])).toEqual([
      ['BOTH', 'BOTH'],
      [undefined, 'DRIVE'],
      ['VAULT', undefined],
    ]);
  });

  it('sorts by kind, then name, and leaves saves out (T1.6b)', () => {
    const rows = packageRows(
      title('T', {}, [
        pkg({ packageName: 'Z', kind: 'other', contentType: '00009000' }),
        pkg({ packageName: 'S', kind: 'save', contentType: '00000001' }),
        pkg({ packageName: 'D2', name: 'Pack b', kind: 'dlc', contentType: '00000002' }),
        pkg({ packageName: 'D1', name: 'Pack a', kind: 'dlc', contentType: '00000002' }),
        pkg({ packageName: 'G', kind: 'game' }),
      ]),
      undefined,
    );
    expect(rows.map((r) => r.vault?.location.packageName)).toEqual(['G', 'D1', 'D2', 'Z']);
  });

  it('allows an add only from a sound vault copy to an empty drive location (T1.6c)', () => {
    const p = pkg();
    expect(canAdd({ key: 'k', vault: p, drive: undefined })).toBe(true);
    expect(canAdd({ key: 'k', vault: { ...p, corrupt: true }, drive: undefined })).toBe(false);
    expect(canAdd({ key: 'k', vault: p, drive: p })).toBe(false);
    expect(canAdd({ key: 'k', vault: p, drive: { ...p, corrupt: true } })).toBe(false);
    expect(canAdd({ key: 'k', vault: undefined, drive: undefined })).toBe(false);
  });

  it('allows a removal of anything on the drive (T1.6c)', () => {
    expect(canRemove({ key: 'k', vault: undefined, drive: pkg({ corrupt: true }) })).toBe(true);
    expect(canRemove({ key: 'k', vault: pkg(), drive: undefined })).toBe(false);
  });
});

describe('libraryTitles', () => {
  it('gives each vault title its status and corrupt flag (T1.6d)', () => {
    const sound = title('AAAAAAAA', {}, [pkg()]);
    const broken = title('BBBBBBBB', {}, [pkg({ corrupt: true })]);
    const queue: Change[] = [{ op: 'add', location: { ...pkg().location, titleId: 'BBBBBBBB' } }];
    expect(libraryTitles([sound, broken], [sound], queue).map((l) => [l.title.titleId, l.status, l.corrupt])).toEqual([
      ['AAAAAAAA', 'on-drive', false],
      ['BBBBBBBB', 'queued', true],
    ]);
  });
});

describe('driveSummary', () => {
  it('counts playable and other titles, and their bytes (T1.6e)', () => {
    const game = title('AAAAAAAA', { name: 'Halo' }, [pkg({ headerFileBytes: 100 })]);
    const dlcOnly = title('BBBBBBBB', { name: 'Pack' }, [pkg({ kind: 'dlc', headerFileBytes: 20 })]);
    expect(driveSummary([game, dlcOnly])).toEqual({
      playable: 1,
      other: 1,
      bytes: 120,
      entries: [
        { titleId: 'AAAAAAAA', name: 'Halo', playable: true },
        { titleId: 'BBBBBBBB', name: 'Pack', playable: false },
      ],
    });
  });
});

function lib(t: Title, status: LibraryTitle['status'] = 'not-on-drive'): LibraryTitle {
  return { title: t, status, corrupt: false };
}

describe('applyFilters', () => {
  const god = lib(title('A', { name: 'God' }, [pkg(), pkg({ packageName: 'TU', kind: 'title-update' })]), 'on-drive');
  const arcade = lib(title('B', { name: 'Arcade' }, [pkg({ contentType: '000D0000' })]), 'partial');
  const dlc = lib(title('C', { name: 'Dlc' }, [pkg({ kind: 'dlc', contentType: '00000002' })]));
  const other = lib(title('D', { name: 'Other' }, [pkg({ kind: 'other', contentType: '00009000' })]), 'queued');
  const all = [god, arcade, dlc, other];
  const names = (items: LibraryTitle[]) => items.map((i) => i.title.name);

  it('matches everything with no filters (T1.7)', () => {
    expect(names(applyFilters(all, {}))).toEqual(['God', 'Arcade', 'Dlc', 'Other']);
  });

  it('counts partial as on-drive (T1.7)', () => {
    expect(names(applyFilters(all, { status: 'on-drive' }))).toEqual(['God', 'Arcade']);
    expect(names(applyFilters(all, { status: 'not-on-drive' }))).toEqual(['Dlc']);
    expect(names(applyFilters(all, { status: 'queued' }))).toEqual(['Other']);
  });

  it('applies each "has" filter on its own (T1.7)', () => {
    const saveOnly = lib(title('E', { name: 'Saves' }, [pkg({ kind: 'save', contentType: '00000001' })]));
    expect(names(applyFilters(all, { hasTitleUpdate: true }))).toEqual(['God']);
    expect(names(applyFilters(all, { hasDlc: true }))).toEqual(['Dlc']);
    expect(names(applyFilters([...all, saveOnly], { hasOtherContent: true }))).toEqual(['Other']);
  });

  it('combines filters with AND (T1.7)', () => {
    expect(names(applyFilters(all, { gameType: 'GOD', hasTitleUpdate: true }))).toEqual(['God']);
    expect(names(applyFilters(all, { gameType: 'Other', hasDlc: true }))).toEqual(['Dlc']);
    expect(names(applyFilters(all, { hasOtherContent: true }))).toEqual(['Other']);
    expect(names(applyFilters(all, { status: 'on-drive', hasDlc: true }))).toEqual([]);
  });
});

describe('sortTitles', () => {
  const a = lib(title('A', { name: 'beta', addedAt: 3 }, [pkg({ headerFileBytes: 5 })]));
  const b = lib(title('B', { name: 'Alpha', addedAt: 1 }, [pkg({ headerFileBytes: 5 })]));
  const c = lib(title('C', { name: 'gamma', addedAt: 2 }, [pkg({ headerFileBytes: 9 })]));
  const names = (items: LibraryTitle[]) => items.map((i) => i.title.name);

  it('sorts a copy by name, case-insensitively (T1.8)', () => {
    const items = [a, b, c];
    expect(names(sortTitles(items, 'name'))).toEqual(['Alpha', 'beta', 'gamma']);
    expect(names(items)).toEqual(['beta', 'Alpha', 'gamma']);
  });

  it('breaks date ties by name (T1.8)', () => {
    const d = lib(title('D', { name: 'delta', addedAt: 3 }));
    expect(names(sortTitles([d, a], 'added-desc'))).toEqual(['beta', 'delta']);
  });

  it('sorts by size and date added, ties by name (T1.8)', () => {
    expect(names(sortTitles([a, b, c], 'size-desc'))).toEqual(['gamma', 'Alpha', 'beta']);
    expect(names(sortTitles([a, b, c], 'size-asc'))).toEqual(['Alpha', 'beta', 'gamma']);
    expect(names(sortTitles([a, b, c], 'added-desc'))).toEqual(['beta', 'gamma', 'Alpha']);
    expect(names(sortTitles([a, b, c], 'added-asc'))).toEqual(['Alpha', 'gamma', 'beta']);
  });
});

describe('describeEmpty', () => {
  it('describes the filters in a sentence (T1.9)', () => {
    expect(describeEmpty({})).toBe('There are no titles to show.');
    expect(describeEmpty({ status: 'queued', gameType: 'GOD', hasDlc: true, hasTitleUpdate: true })).toBe(
      'There are no queued Games on Demand titles with title updates and DLC.',
    );
    expect(describeEmpty({ status: 'on-drive', gameType: 'Other' })).toBe(
      'There are no titles other than Games on Demand on the drive.',
    );
    expect(describeEmpty({ status: 'not-on-drive', hasOtherContent: true })).toBe(
      'There are no titles with other content that are not on the drive.',
    );
  });
});

describe('resolveAppStatus', () => {
  const base = { errorCount: 0, vaultReady: true, driveReady: true, copying: null, queuedCount: 0 };

  it('shows one status, highest priority first (T1.11)', () => {
    const copying = {
      change: { op: 'add', location: pkg().location },
      index: 0,
      total: 1,
      changeFraction: 0,
      fraction: 0,
    } as const;
    expect(resolveAppStatus({ ...base, errorCount: 1, vaultReady: false })).toBe('error');
    expect(resolveAppStatus({ ...base, vaultReady: false, driveReady: false })).toBe('no-vault');
    expect(resolveAppStatus({ ...base, driveReady: false, copying })).toBe('no-drive');
    expect(resolveAppStatus({ ...base, copying, queuedCount: 2 })).toBe('copying');
    expect(resolveAppStatus({ ...base, queuedCount: 2 })).toBe('ready');
    expect(resolveAppStatus(base)).toBe('ok');
  });
});

describe('searchTitles', () => {
  const titles = [
    title('4D5307E6', { name: 'Halo 3' }),
    title('41560818', { name: 'A Halo Story' }),
    title('4D530877', { name: 'Fable II' }),
    title('41560817', { name: 'The Halo Collection' }),
    title('58410A1F', { name: 'Banjo' }),
  ];
  const names = (ts: Title[]) => ts.map((t) => t.name);

  it('matches names case-insensitively, prefix matches first (T1.12)', () => {
    expect(names(searchTitles(titles, 'halo'))).toEqual(['Halo 3', 'A Halo Story', 'The Halo Collection']);
  });

  it('matches a Title ID prefix (T1.12)', () => {
    expect(names(searchTitles(titles, '4d53'))).toEqual(['Fable II', 'Halo 3']);
    expect(searchTitles(titles, '5307')).toEqual([]);
  });

  it('returns nothing for a blank query, and at most 8 (T1.12)', () => {
    expect(searchTitles(titles, '  ')).toEqual([]);
    const many = Array.from({ length: 12 }, (_, i) =>
      title(`0000000${(i % 10).toString()}`, { name: `Game ${String(i)}` }),
    );
    expect(searchTitles(many, 'game')).toHaveLength(8);
  });
});

describe('coverPalette', () => {
  it('is deterministic per Title ID (T1.13)', () => {
    expect(coverPalette('4D5307E6')).toEqual(coverPalette('4D5307E6'));
    expect(coverPalette('4D5307E6')).not.toEqual(coverPalette('4D530877'));
  });
});
