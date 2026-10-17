import { describe, expect, it, vi } from 'vitest';
import { openContentRoot, type ContentRoot } from 'xcontent-fs-web';
import { runApply } from '../apply.js';
import type { ApplyProgress, Change } from '../types.js';
import { faulty, folder, type Entry } from './helpers/drive.js';
import { header } from './helpers/header.js';

const PUB = '0000000000000000';
const DIR = `${PUB}/4D5307E6/00007000`;
const MiB = 2 ** 20;

async function open(handle: FileSystemDirectoryHandle, mode: 'read' | 'readwrite'): Promise<ContentRoot> {
  const [ok, root] = await openContentRoot(handle, { mode });
  if (!ok) throw new Error(JSON.stringify(root));
  return root;
}

const at = (packageName: string) => ({ partition: PUB, titleId: '4D5307E6', contentType: '00007000', packageName });
const add = (name: string): Change => ({ op: 'add', location: at(name) });
const remove = (name: string): Change => ({ op: 'remove', location: at(name) });

async function setup(vaultTree: Record<string, Entry>, driveTree: Record<string, Entry> = {}) {
  // A different name: memfs's isSameEntry compares paths only, not volumes.
  const vault = folder(vaultTree, { mode: 'read', name: 'Vault' });
  const drive = folder(driveTree);
  return {
    vault,
    drive,
    vaultRoot: await open(vault.handle, 'read'),
    driveRoot: await open(drive.handle, 'readwrite'),
  };
}

describe('runApply', () => {
  it('runs removals first, then adds, each in queue order (A1.1, A1.6)', async () => {
    const { drive, vaultRoot, driveRoot } = await setup(
      { [`${DIR}/A`]: header(), [`${DIR}/B`]: header() },
      { [`${DIR}/X`]: header(), [`${DIR}/Y`]: header() },
    );
    const changes = [add('A'), remove('X'), add('B'), remove('Y')];
    const result = await runApply(changes, { vault: vaultRoot, drive: driveRoot, bytesOf: () => 1 });
    expect(result).toEqual({ applied: [remove('X'), remove('Y'), add('A'), add('B')], stopped: false });
    expect(drive.list().filter((p) => p.startsWith(`${DIR}/`) && p !== `${DIR}/`)).toEqual([`${DIR}/A`, `${DIR}/B`]);
  });

  it('removes a package and its junk with clean, then deletePackage (A1.2)', async () => {
    const { drive, vaultRoot, driveRoot } = await setup(
      {},
      { [`${DIR}/G`]: header(), [`${DIR}/G.data/Data0000`]: 'x', [`${DIR}/G.crswap`]: 'swap' },
    );
    const result = await runApply([remove('G')], { vault: vaultRoot, drive: driveRoot, bytesOf: () => 0 });
    expect(result.applied).toEqual([remove('G')]);
    expect(drive.list()).toEqual([`${PUB}/`, `${PUB}/4D5307E6/`, `${DIR}/`]);
  });

  it('copies an SVOD package with its data files (A1.3)', async () => {
    const { drive, vaultRoot, driveRoot } = await setup({
      [`${DIR}/G`]: header({ format: 1 }),
      [`${DIR}/G.data/Data0000`]: 'zero',
      [`${DIR}/G.data/Data0001`]: 'one',
    });
    await runApply([add('G')], { vault: vaultRoot, drive: driveRoot, bytesOf: () => 1 });
    expect(drive.list()).toContain(`${DIR}/G.data/Data0001`);
    expect(drive.list()).toContain(`${DIR}/G`);
  });

  it('asks whether to stop only between changes (A1.4)', async () => {
    const { vaultRoot, driveRoot } = await setup({
      [`${DIR}/A`]: header(),
      [`${DIR}/B`]: header(),
      [`${DIR}/C`]: header(),
    });
    let asked = 0;
    const result = await runApply([add('A'), add('B'), add('C')], {
      vault: vaultRoot,
      drive: driveRoot,
      bytesOf: () => 1,
      shouldStop: () => ++asked === 2,
    });
    expect(result).toEqual({ applied: [add('A'), add('B')], stopped: true });
    expect(asked).toBe(2);
  });

  it('does not report a stop after the last change (A1.4)', async () => {
    const { vaultRoot, driveRoot } = await setup({ [`${DIR}/A`]: header() });
    const result = await runApply([add('A')], {
      vault: vaultRoot,
      drive: driveRoot,
      bytesOf: () => 1,
      shouldStop: () => true,
    });
    expect(result).toEqual({ applied: [add('A')], stopped: false });
  });

  it('ends at the first failure, naming the change and its reasons (A1.5)', async () => {
    const { drive, vaultRoot, driveRoot } = await setup(
      { [`${DIR}/A`]: header(), [`${DIR}/B`]: header() },
      { [`${DIR}/A`]: 'already here' },
    );
    const result = await runApply([add('A'), add('B')], { vault: vaultRoot, drive: driveRoot, bytesOf: () => 1 });
    expect(result.applied).toEqual([]);
    expect(result.stopped).toBe(false);
    expect(result.failed?.change).toEqual(add('A'));
    expect(result.failed?.reasons[0]).toMatchObject({ kind: 'target-exists', root: 'target' });
    expect(drive.list()).toEqual([`${PUB}/`, `${PUB}/4D5307E6/`, `${DIR}/`, `${DIR}/A`]);
  });

  it('keeps the changes applied before a failure, and never reports a stop (A1.5)', async () => {
    const { vaultRoot, driveRoot } = await setup({ [`${DIR}/A`]: header() }, { [`${DIR}/X`]: header() });
    const result = await runApply([add('A'), remove('X'), add('MISSING')], {
      vault: vaultRoot,
      drive: driveRoot,
      bytesOf: () => 1,
      shouldStop: () => false,
    });
    expect(result.applied).toEqual([remove('X'), add('A')]);
    expect(result.failed).toMatchObject({ change: add('MISSING'), reasons: [{ kind: 'not-found', root: 'source' }] });
    expect(result.stopped).toBe(false);
  });

  it('reports a failed removal (A1.5)', async () => {
    const { vaultRoot, driveRoot } = await setup({});
    const result = await runApply([remove('GONE')], { vault: vaultRoot, drive: driveRoot, bytesOf: () => 0 });
    expect(result.failed).toMatchObject({ change: remove('GONE'), reasons: [{ kind: 'not-found' }] });
  });

  it('reports progress per change and overall, weighted by bytes (A1.7)', async () => {
    const { vaultRoot, driveRoot } = await setup({ [`${DIR}/A`]: header() }, { [`${DIR}/X`]: header() });
    const seen: ApplyProgress[] = [];
    await runApply([add('A'), remove('X')], {
      vault: vaultRoot,
      drive: driveRoot,
      bytesOf: (c) => (c.op === 'add' ? 3 * MiB : 0),
      onProgress: (p) => seen.push(p),
    });
    expect(seen.every((p) => p.total === 2)).toBe(true);
    expect(seen.find((p) => p.index === 0 && p.changeFraction === 1)?.fraction).toBeCloseTo(0.25);
    expect(seen[0]).toEqual({ change: remove('X'), index: 0, total: 2, changeFraction: 0, fraction: 0 });
    expect(seen.at(-1)).toEqual({ change: add('A'), index: 1, total: 2, changeFraction: 1, fraction: 1 });
    expect(seen.every((p) => p.changeFraction >= 0 && p.changeFraction <= 1)).toBe(true);
    const fractions = seen.map((p) => p.fraction);
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
  });

  it('keeps going when the progress callback throws (A1.7)', async () => {
    const { vaultRoot, driveRoot } = await setup({ [`${DIR}/A`]: header() });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await runApply([add('A')], {
      vault: vaultRoot,
      drive: driveRoot,
      bytesOf: () => 1,
      onProgress: () => {
        throw new Error('bad callback');
      },
    });
    expect(result).toEqual({ applied: [add('A')], stopped: false });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('returns at once for an empty queue (A1.8)', async () => {
    const { vaultRoot, driveRoot } = await setup({});
    expect(await runApply([], { vault: vaultRoot, drive: driveRoot, bytesOf: () => 0 })).toEqual({
      applied: [],
      stopped: false,
    });
  });

  it('cleans up a copy that failed while writing (A1.9)', async () => {
    const vault = folder(
      { [`${DIR}/G`]: header({ format: 1 }), [`${DIR}/G.data/Data0000`]: 'zero', [`${DIR}/G.data/Data0001`]: 'one' },
      { mode: 'read', name: 'Vault' },
    );
    const drive = folder({});
    const driveRoot = await open(
      faulty(drive.handle, { method: 'createWritable', name: 'G', error: 'NotReadableError' }),
      'readwrite',
    );
    const result = await runApply([add('G')], {
      vault: await open(vault.handle, 'read'),
      drive: driveRoot,
      bytesOf: () => 1,
    });
    expect(result.failed?.reasons[0]).toMatchObject({ kind: 'io-error', root: 'target', operation: 'write' });
    // The data files were written before the header failed, and are gone again.
    // (memfs leaves the emptied .data directory itself: see the xcontent-fs-web test drive.)
    expect(drive.list().filter((p) => /Data000|\/G$/.test(p))).toEqual([]);
  });

  it('touches nothing but its own location when creating a folder fails (A1.9)', async () => {
    const vault = folder({ [`${DIR}/G`]: header() }, { mode: 'read', name: 'Vault' });
    const drive = folder({ [`${PUB}/4D5307E6/000B0000/OTHER`]: header() });
    const driveRoot = await open(
      faulty(drive.handle, { method: 'getDirectoryHandle', name: '00007000', error: 'NotReadableError' }),
      'readwrite',
    );
    const result = await runApply([add('G')], {
      vault: await open(vault.handle, 'read'),
      drive: driveRoot,
      bytesOf: () => 1,
    });
    expect(result.failed?.reasons[0]).toMatchObject({ kind: 'io-error', root: 'target', operation: 'create' });
    expect(drive.list()).toContain(`${PUB}/4D5307E6/000B0000/OTHER`);
  });

  it('leaves the drive alone after any other failure (A1.9)', async () => {
    const { drive, vaultRoot, driveRoot } = await setup(
      { [`${DIR}/G`]: header() },
      { [`${DIR}/g`]: 'a different package, in another case' },
    );
    const result = await runApply([add('G')], { vault: vaultRoot, drive: driveRoot, bytesOf: () => 1 });
    expect(result.failed?.reasons[0]).toMatchObject({ kind: 'target-exists' });
    expect(drive.list()).toContain(`${DIR}/g`);
  });
});
