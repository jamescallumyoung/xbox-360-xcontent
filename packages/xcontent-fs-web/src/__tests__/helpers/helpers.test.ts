// Tests for the smaller test helpers: trees, package and junk builders,
// recording callbacks and abort helpers.

import { describe, expect, it } from 'vitest';
import { abortAfterCalls, abortOnOperation } from './abort.js';
import { recordCalls, stubReportError } from './callbacks.js';
import { APPLE_DOUBLE_MAGIC, appleDouble, fakeAppleDouble, truncatedAppleDouble } from './junk.js';
import {
  DEFAULT_AT,
  SVOD_HEADER_SIZE,
  contentTypePath,
  dataOnly,
  headerOnly,
  locationOf,
  packagePath,
  stfsPackage,
  svodPackage,
} from './packages.js';
import { createTestDrive } from './test-drive.js';
import { DIR, contentFor } from './tree.js';

describe('contentFor', () => {
  it('is deterministic, the requested size, and different per path', () => {
    expect(contentFor('a', 32)).toEqual(contentFor('a', 32));
    expect(contentFor('a', 32)).toHaveLength(32);
    expect(contentFor('a', 32)).not.toEqual(contentFor('b', 32));
  });
});

describe('snapshotTree', () => {
  it('sorts entries, marks directories, and tells files apart by content', () => {
    const drive = createTestDrive({ tree: { 'b/x': new Uint8Array([1]), 'a/x': new Uint8Array([2]), c: DIR } });
    const [a, ax, b, bx, c] = drive.snapshot();
    expect([a, b, c]).toEqual(['a/', 'b/', 'c/']);
    expect(ax?.slice(0, 6)).toBe('a/x 1 ');
    expect(bx?.slice(0, 6)).toBe('b/x 1 ');
    expect(ax?.slice(6)).not.toBe(bx?.slice(6));
  });
});

describe('package builders', () => {
  it('put packages in the default content-type directory', () => {
    expect(contentTypePath()).toBe('0000000000000000/4D5307E6/00007000');
    expect(packagePath('ABC')).toBe('0000000000000000/4D5307E6/00007000/ABC');
    expect(locationOf('ABC')).toEqual({ ...DEFAULT_AT, packageName: 'ABC' });
  });

  it('build an STFS package as one file', () => {
    expect(stfsPackage('ABC')).toEqual({ [packagePath('ABC')]: 0x2000 });
    expect(stfsPackage('ABC', { headerSize: 5 })).toEqual({ [packagePath('ABC')]: 5 });
  });

  it('build an SVOD package as a header plus Data0000 onwards, each a different size', () => {
    const drive = createTestDrive({ tree: svodPackage('ABC', { dataFiles: 2 }) });
    const dir = contentTypePath();
    expect(drive.snapshot().filter((line) => line.startsWith(`${dir}/`) && line !== `${dir}/`)).toEqual([
      expect.stringMatching(new RegExp(`^${dir}/ABC ${String(SVOD_HEADER_SIZE)} `)),
      `${dir}/ABC.data/`,
      expect.stringMatching(new RegExp(`^${dir}/ABC.data/Data0000 1024 `)),
      expect.stringMatching(new RegExp(`^${dir}/ABC.data/Data0001 1040 `)),
    ]);
  });

  it('leave gaps when given indices, and an empty .data with none', () => {
    expect(Object.keys(dataOnly('ABC', { dataFiles: [0, 1, 3] }))).toEqual([
      `${packagePath('ABC.data')}/Data0000`,
      `${packagePath('ABC.data')}/Data0001`,
      `${packagePath('ABC.data')}/Data0003`,
    ]);
    expect(dataOnly('ABC', { dataFiles: 0 })).toEqual({ [packagePath('ABC.data')]: DIR });
  });

  it('build orphans: a header alone, and a .data alone', () => {
    expect(Object.keys(headerOnly('ABC'))).toEqual([packagePath('ABC')]);
    expect(Object.keys(dataOnly('ABC'))).toHaveLength(3);
  });

  it('use another location when given one', () => {
    const at = { partition: 'E812CECF9EA2AF5F', titleId: '584E07D2', contentType: '000E0000' };
    expect(Object.keys(stfsPackage('save', { at }))).toEqual(['E812CECF9EA2AF5F/584E07D2/000E0000/save']);
  });
});

describe('junk builders', () => {
  it('build AppleDouble files with the magic, and look-alikes without it', () => {
    expect(appleDouble()).toHaveLength(4096);
    expect(appleDouble().subarray(0, 4)).toEqual(APPLE_DOUBLE_MAGIC);
    expect(fakeAppleDouble().subarray(0, 4)).not.toEqual(APPLE_DOUBLE_MAGIC);
    expect(truncatedAppleDouble()).toHaveLength(3);
  });
});

describe('recordCalls', () => {
  it('records each call in order', () => {
    const { fn, calls } = recordCalls<number>();
    fn(1);
    fn(2);
    expect(calls).toEqual([1, 2]);
  });
});

describe('stubReportError', () => {
  it('collects what reportError receives', () => {
    const reported = stubReportError();
    const error = new Error('from a callback');
    reportError(error);
    expect(reported).toEqual([error]);
  });

  it('is removed after each test', () => {
    expect(typeof (globalThis as { reportError?: unknown }).reportError).toBe('undefined');
  });
});

describe('abortAfterCalls', () => {
  it('aborts during the nth call, with the given reason', () => {
    const { signal, fn, calls } = abortAfterCalls<string>(2, 'stop');
    fn('a');
    expect(signal.aborted).toBe(false);
    fn('b');
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('stop');
    expect(calls).toEqual(['a', 'b']);
  });
});

describe('abortOnOperation', () => {
  it('aborts as a matching operation starts, after letting some through', async () => {
    const drive = createTestDrive({ tree: { a: 1, b: 1, c: 1 } });
    const signal = abortOnOperation(drive, { operation: 'open', after: 1 });
    await drive.root.getFileHandle('a');
    expect(signal.aborted).toBe(false);
    // The operation itself still runs.
    expect((await drive.root.getFileHandle('b')).name).toBe('b');
    expect(signal.aborted).toBe(true);
  });

  it('matches by path', async () => {
    const drive = createTestDrive({ tree: { a: 1, b: 1 } });
    const signal = abortOnOperation(drive, { operation: 'open', path: ['b'] });
    await drive.root.getFileHandle('a');
    expect(signal.aborted).toBe(false);
    await drive.root.getFileHandle('b');
    expect(signal.aborted).toBe(true);
  });
});
