// Tests for root.readHeaderBytes.
// Function design doc, H1 `root.readHeaderBytes`: statements H1.1-H1.10, and
// package-wide rules 7, 11, 12 and 13 where they apply.

import { describe, expect, it } from 'vitest';
import { abortAfterCalls, abortOnOperation } from './helpers/abort.js';
import { recordCalls, stubReportError } from './helpers/callbacks.js';
import { appleDouble, swapFile } from './helpers/junk.js';
import {
  DEFAULT_AT,
  contentTypePath,
  dataOnly,
  locationOf,
  packagePath,
  stfsPackage,
  svodPackage,
} from './helpers/packages.js';
import { createTestDrive, type TestDrive, type TestDriveOptions } from './helpers/test-drive.js';
import { DIR, contentFor } from './helpers/tree.js';
import { openContentRoot } from '../open-content-root.js';
import type { ContentRoot } from '../types.js';

const HEADER_PATH = [DEFAULT_AT.partition, DEFAULT_AT.titleId, DEFAULT_AT.contentType, 'ABC'];

async function setup(options: TestDriveOptions): Promise<{ drive: TestDrive; root: ContentRoot }> {
  const drive = createTestDrive(options);
  const [ok, root] = await openContentRoot(drive.root);
  if (!ok) throw new Error(`setup: ${JSON.stringify(root)}`);
  return { drive, root };
}

describe('root.readHeaderBytes', () => {
  describe('input', () => {
    it('H1.1: an already-aborted signal gives `aborted` before anything is touched', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC') });
      const operations: string[] = [];
      drive.onOperation(({ operation }) => operations.push(operation));
      const controller = new AbortController();
      controller.abort('stop');
      // Even an invalid location isn't checked first.
      expect(await root.readHeaderBytes(locationOf(''), { signal: controller.signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
      expect(operations).toEqual([]);
    });

    it('H1.2: checks the location, reporting every invalid field', async () => {
      const { root } = await setup({ tree: stfsPackage('ABC') });
      const [ok, reasons] = await root.readHeaderBytes({ ...locationOf('a/b'), titleId: '4d5307e6' });
      expect(ok).toBe(false);
      expect(reasons).toEqual(
        expect.arrayContaining([
          { kind: 'invalid-location', field: 'titleId', value: '4d5307e6' },
          { kind: 'invalid-location', field: 'packageName', value: 'a/b' },
        ]),
      );
    });

    it('H1.2: needs read permission, checked on every call', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC') });
      // Withdrawn after opening. A readwrite grant would cover reads, so withdraw both.
      drive.setPermission('read', 'prompt');
      drive.setPermission('readwrite', 'prompt');
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'permission-denied', mode: 'read', state: 'prompt' }],
      ]);
    });

    it('H1.2: read permission is enough', async () => {
      const { root } = await setup({ tree: stfsPackage('ABC'), permissions: { readwrite: 'denied' } });
      expect((await root.readHeaderBytes(locationOf('ABC')))[0]).toBe(true);
    });

    it('H1.3: a missing directory gives not-found', async () => {
      const { root } = await setup({ tree: { '0000000000000000': DIR } });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'not-found', path: ['0000000000000000', '4D5307E6'] }],
      ]);
    });

    it('H1.3: a directory in another case gives wrong-case, on FAT32 too', async () => {
      const { root } = await setup({ fat32: true, tree: { '0000000000000000/4d5307e6/00007000/ABC': 1 } });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6' }],
      ]);
    });

    it('H1.3: a header in another case gives wrong-case, on FAT32 too', async () => {
      const { root } = await setup({ fat32: true, tree: stfsPackage('abc') });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'wrong-case', path: HEADER_PATH, found: 'abc' }],
      ]);
    });

    it('H1.4: a data directory without its header gives orphaned-data', async () => {
      const { root } = await setup({ tree: dataOnly('ABC') });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'orphaned-data', path: [...HEADER_PATH.slice(0, 3), 'ABC.data'] }],
      ]);
    });

    it('H1.4: neither a header nor a data directory gives not-found', async () => {
      const { root } = await setup({ tree: { [contentTypePath()]: DIR } });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'not-found', path: HEADER_PATH }],
      ]);
    });

    it('H1.5: a header that is a directory gives unexpected-entry-type', async () => {
      const { root } = await setup({ tree: { [packagePath('ABC')]: DIR } });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: HEADER_PATH, expected: 'file' }],
      ]);
    });
  });

  describe('reading', () => {
    it('H1.6: reads exactly the first 0xB000 bytes of a longer file', async () => {
      const { root } = await setup({ tree: stfsPackage('ABC', { headerSize: 0x20000 }) });
      const [ok, bytes] = await root.readHeaderBytes(locationOf('ABC'));
      expect(ok).toBe(true);
      expect(bytes).toEqual(contentFor(packagePath('ABC'), 0x20000).slice(0, 0xb000));
    });

    it('H1.6: reads a whole 0xB000-byte SVOD header', async () => {
      const { root } = await setup({ tree: svodPackage('ABC') });
      const [, bytes] = await root.readHeaderBytes(locationOf('ABC'));
      expect(bytes).toEqual(contentFor(packagePath('ABC'), 0xb000));
    });

    it.each([0x971a, 1, 0])('H1.7: a file of %i bytes gives what it has, and still succeeds', async (size) => {
      const { root } = await setup({ tree: stfsPackage('ABC', { headerSize: size }) });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([true, contentFor(packagePath('ABC'), size)]);
    });

    it("H1.8: doesn't check the bytes: anything at all is returned", async () => {
      const bytes = new TextEncoder().encode('not a package');
      const { root } = await setup({ tree: { [packagePath('ABC')]: bytes } });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([true, bytes]);
    });

    it('H1.8: never reads name.data/, and ignores junk', async () => {
      const ct = contentTypePath();
      const { drive, root } = await setup({
        tree: {
          ...svodPackage('ABC'),
          [`${ct}/ABC.crswap`]: swapFile(),
          [`${ct}/._ABC`]: appleDouble(),
          [`${ct}/ABC.data/COPYING`]: 1,
        },
      });
      drive.fail({ operation: 'list', path: [...HEADER_PATH.slice(0, 3), 'ABC.data'], times: 100 });
      expect((await root.readHeaderBytes(locationOf('ABC')))[0]).toBe(true);
    });

    it('H1.9: reports progress, ending at the number of bytes read', async () => {
      const { root } = await setup({ tree: stfsPackage('ABC', { headerSize: 0x20000 }) });
      const progress = recordCalls<{ readBytes: number; totalBytes: number }>();
      await root.readHeaderBytes(locationOf('ABC'), { onProgress: progress.fn });
      expect(progress.calls.length).toBeGreaterThan(0);
      expect(progress.calls.at(-1)).toEqual({ readBytes: 0xb000, totalBytes: 0xb000 });
      for (const [index, call] of progress.calls.entries()) {
        expect(call.totalBytes).toBe(0xb000);
        if (index > 0) expect(call.readBytes).toBeGreaterThan(progress.calls[index - 1]?.readBytes ?? 0);
      }
    });

    it("H1.9: totalBytes is the file's size when it is shorter than 0xB000", async () => {
      const { root } = await setup({ tree: stfsPackage('ABC', { headerSize: 100 }) });
      const progress = recordCalls<{ readBytes: number; totalBytes: number }>();
      await root.readHeaderBytes(locationOf('ABC'), { onProgress: progress.fn });
      expect(progress.calls.at(-1)).toEqual({ readBytes: 100, totalBytes: 100 });
    });

    it('H1.9: an abort during the read gives `aborted`', async () => {
      const { root } = await setup({ tree: svodPackage('ABC') });
      const abort = abortAfterCalls<unknown>(1, 'stop');
      expect(await root.readHeaderBytes(locationOf('ABC'), { signal: abort.signal, onProgress: abort.fn })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
    });

    it("rule 11: a progress callback that throws doesn't stop the read", async () => {
      const reported = stubReportError();
      const { root } = await setup({ tree: svodPackage('ABC') });
      const error = new Error('progress UI bug');
      const [ok] = await root.readHeaderBytes(locationOf('ABC'), {
        onProgress: () => {
          throw error;
        },
      });
      expect(ok).toBe(true);
      expect(reported).toContain(error);
    });

    it('rule 10: a listing that fails after an abort is reported as aborted, not io-error', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      const signal = abortOnOperation(drive, { operation: 'list', path: HEADER_PATH.slice(0, 3) }, 'stop');
      drive.fail({ operation: 'list', path: HEADER_PATH.slice(0, 3) });
      expect(await root.readHeaderBytes(locationOf('ABC'), { signal })).toEqual([
        false,
        [{ kind: 'aborted', reason: 'stop' }],
      ]);
    });

    it("rule 12: a read error gives io-error with the header's path", async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      drive.fail({ operation: 'read', path: HEADER_PATH, error: 'NotReadableError' });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'read', path: HEADER_PATH, error: { name: 'NotReadableError' } }],
      ]);
    });

    it('rule 12: a pulled drive gives io-error', async () => {
      const { drive, root } = await setup({ tree: svodPackage('ABC') });
      drive.pull();
      expect(await root.readHeaderBytes(locationOf('ABC'))).toMatchObject([
        false,
        [{ kind: 'io-error', error: { name: 'NotFoundError' } }],
      ]);
    });
  });

  describe('result', () => {
    it('H1.10: is the only view of its own ArrayBuffer', async () => {
      const { root } = await setup({ tree: stfsPackage('ABC', { headerSize: 0x20000 }) });
      const [, bytes] = await root.readHeaderBytes(locationOf('ABC'));
      if (!(bytes instanceof Uint8Array)) throw new Error('expected bytes');
      expect(bytes.byteOffset).toBe(0);
      expect(bytes.buffer.byteLength).toBe(bytes.length);
    });

    it('H1.10: two calls give two separate arrays', async () => {
      const { root } = await setup({ tree: svodPackage('ABC') });
      const [, first] = await root.readHeaderBytes(locationOf('ABC'));
      const [, second] = await root.readHeaderBytes(locationOf('ABC'));
      if (!(first instanceof Uint8Array) || !(second instanceof Uint8Array)) throw new Error('expected bytes');
      expect(first).not.toBe(second);
      first[0] = (first[0] ?? 0) ^ 0xff;
      expect(second[0]).not.toBe(first[0]);
    });

    it('rule 13: reads the drive afresh on every call', async () => {
      const { drive, root } = await setup({ tree: stfsPackage('ABC', { headerSize: 4 }) });
      await root.readHeaderBytes(locationOf('ABC'));
      drive.write({ [packagePath('ABC')]: Uint8Array.of(9, 9) });
      expect(await root.readHeaderBytes(locationOf('ABC'))).toEqual([true, Uint8Array.of(9, 9)]);
    });
  });
});
