import { describe, expect, it, vi } from 'vitest';
import { scanContentRoot } from '../scan.js';
import type { Title } from '../types.js';
import { fakeFolder, folder, pulled, type Entry } from './helpers/drive.js';
import { header, type HeaderOptions } from './helpers/header.js';

const PUB = '0000000000000000';
const GOD = `${PUB}/4D5307E6/00007000`;

async function scan(tree: Record<string, Entry>, touch: Record<string, number> = {}): Promise<Title[]> {
  const f = folder(tree);
  for (const [path, ms] of Object.entries(touch)) f.touch(path, ms);
  const [ok, result] = await scanContentRoot(f.handle);
  if (!ok) throw new Error(`scan failed: ${JSON.stringify(result)}`);
  return result;
}

const h = (options: HeaderOptions = {}) => header(options);

describe('walking', () => {
  it('reads only the public partition (S1.1)', async () => {
    const titles = await scan({
      [`${GOD}/GAME`]: h(),
      'E812CECF9EA2AF5F/4D5307E6/00000001/SAVE': h({ contentType: 1 }),
      'notes.txt': 'x',
    });
    expect(titles.map((t) => t.titleId)).toEqual(['4D5307E6']);
    expect(titles[0]?.packages.map((p) => p.location)).toEqual([
      { partition: PUB, titleId: '4D5307E6', contentType: '00007000', packageName: 'GAME' },
    ]);
  });

  it('gives no titles without a public partition (S1.1)', async () => {
    expect(await scan({ 'E812CECF9EA2AF5F/4D5307E6/00000001/SAVE': h() })).toEqual([]);
  });

  it('passes over badly named directories and stray files (S1.2)', async () => {
    const titles = await scan({
      [`${GOD}/GAME`]: h(),
      [`${PUB}/4d5307e6/00007000/LOWER`]: h(),
      [`${PUB}/4D5307E6/0000700/SHORT`]: h(),
      [`${PUB}/4D5307E6/7000_BACKUP/OLD`]: h(),
      [`${PUB}/4D5307E6/stray.txt`]: 'x',
      [`${PUB}/stray.txt`]: 'x',
    });
    expect(titles.flatMap((t) => t.packages.map((p) => p.location.packageName))).toEqual(['GAME']);
  });

  it('passes over files that are not packages (S1.3, spec §7.2)', async () => {
    const titles = await scan({ [`${GOD}/GAME`]: h(), [`${GOD}/Thumbs.db`]: 'not a package at all' });
    expect(titles.flatMap((t) => t.packages.map((p) => p.location.packageName))).toEqual(['GAME']);
  });

  it('passes over hidden files and swap files (S1.3)', async () => {
    const titles = await scan({
      [`${GOD}/GAME`]: h(),
      [`${GOD}/._GAME`]: 'apple double',
      [`${GOD}/.DS_Store`]: 'finder',
      [`${GOD}/GAME2.crswap`]: 'swap',
      [`${PUB}/._4D5307E6`]: 'x',
    });
    expect(titles.flatMap((t) => t.packages.map((p) => p.location.packageName))).toEqual(['GAME']);
  });

  it('treats NAME.data as part of NAME, and passes over other directories (S1.4)', async () => {
    const titles = await scan({
      [`${GOD}/GAME`]: h({ format: 1, dataFilesSize: 3000 }),
      [`${GOD}/GAME.data/Data0000`]: 'x',
      [`${GOD}/BACKUP/GAME`]: h(),
    });
    expect(titles[0]?.packages.map((p) => p.location.packageName)).toEqual(['GAME']);
  });

  it('takes the Title ID and content type from the directories, not the header (S1.5)', async () => {
    const titles = await scan({ [`${PUB}/58410A1F/000D0000/ARCADE`]: h({ titleId: '00000000', contentType: 1 }) });
    expect(titles[0]?.titleId).toBe('58410A1F');
    expect(titles[0]?.packages[0]).toMatchObject({
      kind: 'game',
      location: { titleId: '58410A1F', contentType: '000D0000' },
    });
  });
});

describe('reading each package', () => {
  it('records an STFS header file and its parsed fields (S1.6, S1.7)', async () => {
    const titles = await scan(
      { [`${PUB}/4D5307E6/00000002/DLC`]: h({ contentId: '12'.repeat(20) }) },
      {
        [`${PUB}/4D5307E6/00000002/DLC`]: 5_000_000,
      },
    );
    expect(titles[0]?.packages[0]).toEqual({
      location: { partition: PUB, titleId: '4D5307E6', contentType: '00000002', packageName: 'DLC' },
      kind: 'dlc',
      name: 'DLC',
      contentId: '12'.repeat(20),
      format: 'stfs',
      headerFileBytes: 0xb000,
      dataFilesBytes: 0,
      lastModified: 5_000_000,
      corrupt: false,
    });
  });

  it('takes an SVOD package data size from its header (S1.7)', async () => {
    const titles = await scan({
      [`${GOD}/GAME`]: h({ format: 1, dataFilesSize: 3_000_000_000 }),
      [`${GOD}/GAME.data/Data0000`]: 'x',
    });
    expect(titles[0]?.packages[0]).toMatchObject({ format: 'svod', dataFilesBytes: 3_000_000_000 });
  });

  it('names a package by display name, then title name, then file name (S1.8)', async () => {
    const titles = await scan({
      [`${PUB}/4D5307E6/00000002/A`]: h({ displayName: 'Map Pack', titleName: 'Halo 3' }),
      [`${PUB}/4D5307E6/00000002/B`]: h({ titleName: 'Halo 3' }),
      [`${PUB}/4D5307E6/00000002/C`]: h(),
    });
    expect(titles[0]?.packages.map((p) => p.name)).toEqual(['Map Pack', 'Halo 3', 'C']);
  });

  it('keeps a package whose header fails to parse, marked corrupt (S1.9)', async () => {
    const broken = new Uint8Array(0x400);
    broken.set([0x4c, 0x49, 0x56, 0x45]); // LIVE, with no valid header size
    const titles = await scan({ [`${GOD}/BROKEN`]: broken, [`${GOD}/EMPTY`]: '' });
    expect(titles[0]?.packages).toEqual([
      expect.objectContaining({
        name: 'BROKEN',
        corrupt: true,
        contentId: null,
        format: 'unknown',
        headerFileBytes: 0x400,
        dataFilesBytes: 0,
      }),
      expect.objectContaining({ name: 'EMPTY', corrupt: true, headerFileBytes: 0 }),
    ]);
  });

  it('keeps a .data directory without its header as a corrupt package (S1.10)', async () => {
    const titles = await scan({ [`${GOD}/GAME.data/Data0001`]: 'x' });
    expect(titles[0]?.packages).toEqual([
      {
        location: { partition: PUB, titleId: '4D5307E6', contentType: '00007000', packageName: 'GAME' },
        kind: 'game',
        name: 'GAME',
        contentId: null,
        format: 'unknown',
        headerFileBytes: 0,
        dataFilesBytes: 0,
        lastModified: 0,
        corrupt: true,
      },
    ]);
  });

  it('passes over a download in progress, and its .data directory (S1.11)', async () => {
    // As on real drives (spec §4.4): CON, metadata version 1, and a 0xAD0E header.
    const placeholder = h({
      magic: 'CON ',
      titleId: 'FFFE07D1',
      contentType: 0xb0000,
      headerSize: 0xad0e,
      metadataVersion: 0,
    });
    const titles = await scan({
      [`${GOD}/GAME`]: h(),
      [`${GOD}/DOWNLOADING`]: placeholder,
      [`${GOD}/DOWNLOADING.data/Data0000`]: 'x',
    });
    expect(titles[0]?.packages.map((p) => p.location.packageName)).toEqual(['GAME']);
  });

  it('keeps a package that only resembles a download in progress (S1.11)', async () => {
    const titles = await scan({
      [`${GOD}/LIVE`]: h({ magic: 'LIVE', titleId: 'FFFE07D1', contentType: 0xb0000 }),
      [`${GOD}/OTHERTYPE`]: h({ magic: 'CON ', titleId: 'FFFE07D1', contentType: 0x2 }),
      [`${GOD}/OTHERTITLE`]: h({ magic: 'CON ', titleId: '4D5307E6', contentType: 0xb0000 }),
    });
    expect(titles[0]?.packages.map((p) => p.location.packageName)).toEqual(['LIVE', 'OTHERTITLE', 'OTHERTYPE']);
  });

  it('keeps a real title update under FFFE07D1/000B0000 (S1.11)', async () => {
    const tu = h({ magic: 'CON ', titleId: 'FFFE07D1', contentType: 0xb0000 });
    const titles = await scan({ [`${PUB}/FFFE07D1/000B0000/TU`]: tu });
    expect(titles[0]?.packages.map((p) => p.location.packageName)).toEqual(['TU']);
  });
});

describe('titles', () => {
  it('groups packages by Title ID directory, leaving out empty ones (S1.12)', async () => {
    const titles = await scan({
      [`${GOD}/GAME`]: h(),
      [`${PUB}/4D5307E6/000B0000/TU`]: h(),
      [`${PUB}/58410A1F/000D0000/ARCADE`]: h(),
      [`${PUB}/41560817/00007000/`]: null,
    });
    expect(titles.map((t) => [t.titleId, t.packages.length])).toEqual([
      ['4D5307E6', 2],
      ['58410A1F', 1],
    ]);
  });

  it("names a title from its game's header first (S1.13)", async () => {
    const titles = await scan({
      [`${PUB}/4D5307E6/00000002/DLC`]: h({ displayName: 'Map Pack', titleName: 'Halo 3 (DLC)' }),
      [`${GOD}/GAME`]: h({ titleName: 'Halo 3' }),
    });
    expect(titles[0]?.name).toBe('Halo 3');
  });

  it("prefers the game's display name to its title name (S1.13)", async () => {
    const titles = await scan({ [`${GOD}/GAME`]: h({ displayName: 'Halo 3: ODST', titleName: 'Halo 3' }) });
    expect(titles[0]?.name).toBe('Halo 3: ODST');
  });

  it("falls back to any package's title name, then UNKNOWN (S1.13)", async () => {
    const titles = await scan({
      [`${PUB}/4D5307E6/00000002/DLC`]: h({ displayName: 'Map Pack', titleName: 'Halo 3' }),
      [`${PUB}/58410A1F/00000002/DLC`]: h({ displayName: 'Only a display name' }),
    });
    expect(titles.map((t) => t.name)).toEqual(['Halo 3', 'UNKNOWN']);
  });

  it("takes the publisher from the game's header, else any (S1.14)", async () => {
    const titles = await scan({
      [`${PUB}/4D5307E6/00000002/DLC`]: h({ publisher: 'DLC Co' }),
      [`${GOD}/GAME`]: h({ publisher: 'Microsoft' }),
      [`${PUB}/58410A1F/00000002/DLC`]: h({ publisher: 'Other' }),
      [`${PUB}/41560817/00000002/DLC`]: h(),
    });
    expect(titles.map((t) => t.publisher)).toEqual([null, 'Microsoft', 'Other']);
  });

  it("takes the thumbnail from the game's title thumbnail, then its thumbnail, then any (S1.15)", async () => {
    const one = Uint8Array.of(1);
    const two = Uint8Array.of(2);
    const three = Uint8Array.of(3);
    const titles = await scan({
      [`${PUB}/AAAAAAAA/00000002/DLC`]: h({ titleThumbnail: three }),
      [`${PUB}/AAAAAAAA/00007000/GAME`]: h({ thumbnail: two, titleThumbnail: one }),
      [`${PUB}/BBBBBBBB/00007000/GAME`]: h({ thumbnail: two }),
      [`${PUB}/CCCCCCCC/00000002/DLC`]: h({ thumbnail: three }),
      [`${PUB}/DDDDDDDD/00000002/DLC`]: h(),
    });
    expect(titles.map((t) => t.thumbnail)).toEqual([one, two, three, null]);
  });

  it('dates a title by its newest package (S1.16)', async () => {
    const titles = await scan(
      { [`${GOD}/GAME`]: h(), [`${PUB}/4D5307E6/000B0000/TU`]: h() },
      { [`${GOD}/GAME`]: 9000, [`${PUB}/4D5307E6/000B0000/TU`]: 2000 },
    );
    expect(titles[0]?.addedAt).toBe(9000);
  });

  it('sorts titles by Title ID, and packages by content type then file name (S1.17)', async () => {
    const titles = await scan({
      [`${PUB}/58410A1F/000D0000/B`]: h(),
      [`${PUB}/4D5307E6/000B0000/TU`]: h(),
      [`${GOD}/ZED`]: h(),
      [`${GOD}/ABE`]: h(),
    });
    expect(titles.map((t) => t.titleId)).toEqual(['4D5307E6', '58410A1F']);
    expect(titles[0]?.packages.map((p) => p.location.packageName)).toEqual(['ABE', 'ZED', 'TU']);
  });
});

describe('progress and failure', () => {
  it('reports progress after each package (S1.18)', async () => {
    const f = folder({ [`${GOD}/A`]: h(), [`${GOD}/B`]: h(), [`${GOD}/C.data/Data0000`]: 'x' });
    const calls: number[] = [];
    await scanContentRoot(f.handle, { onProgress: (n) => calls.push(n) });
    expect(calls).toEqual([1, 2, 3]);
  });

  it('stops with the folder health when the drive is gone (S1.19)', async () => {
    expect(await scanContentRoot(pulled(folder({ [`${GOD}/A`]: h() }).handle))).toEqual([
      false,
      { state: 'disconnected', message: "The folder can't be found. Is the drive plugged in?" },
    ]);
  });

  it('stops when a header read fails, rather than calling the package corrupt (S1.19)', async () => {
    for (const name of ['NotFoundError', 'InvalidStateError', 'NotReadableError']) {
      const handle = fakeFolder({
        [`${GOD}/GAME`]: () => {
          throw new DOMException('read failed', name);
        },
      });
      const [ok, health] = await scanContentRoot(handle);
      expect(ok).toBe(false);
      expect(health).toMatchObject({ state: name === 'NotFoundError' ? 'disconnected' : 'error' });
    }
  });
});

describe('reading only the header', () => {
  it('reads the first 0xB000 bytes of a large package (S1.6)', async () => {
    const file = new File([header(), new Uint8Array(0x100000)], 'GAME', { lastModified: 7 });
    const slice = vi.spyOn(file, 'slice');
    const arrayBuffer = vi.spyOn(file, 'arrayBuffer');
    const [ok, titles] = await scanContentRoot(fakeFolder({ [`${GOD}/GAME`]: () => file }));
    expect(ok).toBe(true);
    expect(slice).toHaveBeenCalledWith(0, 0xb000);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(titles).toMatchObject([{ packages: [{ headerFileBytes: 0xb000 + 0x100000, lastModified: 7 }] }]);
  });
});
