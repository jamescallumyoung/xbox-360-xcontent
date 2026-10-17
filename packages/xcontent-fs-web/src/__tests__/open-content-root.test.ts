// Tests for openContentRoot.
// Function design doc, O1 `openContentRoot`: statements O1.1-O1.10.

import { describe, expect, it } from 'vitest';
import { stfsPackage } from './helpers/packages.js';
import { createTestDrive } from './helpers/test-drive.js';
import { DIR } from './helpers/tree.js';
import { openContentRoot } from '../open-content-root.js';

describe('openContentRoot', () => {
  describe('the handle', () => {
    it('O1.1: rejects a file handle', async () => {
      const drive = createTestDrive({ tree: { file: 1 } });
      const file = await drive.root.getFileHandle('file');
      expect(await openContentRoot(file as unknown as FileSystemDirectoryHandle)).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: [], expected: 'directory' }],
      ]);
    });

    it.each([null, undefined, {}, 'Content'])('O1.1: rejects %j from a JavaScript caller', async (value) => {
      expect(await openContentRoot(value as FileSystemDirectoryHandle)).toEqual([
        false,
        [{ kind: 'unexpected-entry-type', path: [], expected: 'directory' }],
      ]);
    });

    it.each(['Content', 'Vault', 'anything'])('O1.2: opens a directory named %j', async (name) => {
      const [ok] = await openContentRoot(createTestDrive({ name }).root);
      expect(ok).toBe(true);
    });
  });

  describe('permission', () => {
    it('O1.3: opens in read mode by default, needing only read permission', async () => {
      const drive = createTestDrive({ permissions: { read: 'granted', readwrite: 'denied' } });
      const [ok, root] = await openContentRoot(drive.root);
      expect(ok).toBe(true);
      expect(root).toMatchObject({ mode: 'read' });
    });

    it.each(['read', 'readwrite'] as const)('O1.4: opens in %s mode when granted', async (mode) => {
      const [ok, root] = await openContentRoot(createTestDrive().root, { mode });
      expect(ok).toBe(true);
      expect(root).toMatchObject({ mode });
    });

    it.each([
      ['read', 'prompt'],
      ['read', 'denied'],
      ['readwrite', 'prompt'],
      ['readwrite', 'denied'],
    ] as const)('O1.4: fails in %s mode when permission is %s', async (mode, state) => {
      const drive = createTestDrive({ permissions: { read: state, readwrite: state } });
      expect(await openContentRoot(drive.root, { mode })).toEqual([
        false,
        [{ kind: 'permission-denied', mode, state }],
      ]);
    });

    it("O1.4: read permission alone isn't enough for readwrite mode", async () => {
      const drive = createTestDrive({ permissions: { read: 'granted', readwrite: 'prompt' } });
      expect(await openContentRoot(drive.root, { mode: 'readwrite' })).toEqual([
        false,
        [{ kind: 'permission-denied', mode: 'readwrite', state: 'prompt' }],
      ]);
    });

    it('O1.5: never calls requestPermission, even when the browser would prompt', async () => {
      const drive = createTestDrive({ permissions: { read: 'prompt', readwrite: 'prompt' } });
      await openContentRoot(drive.root);
      await openContentRoot(drive.root, { mode: 'readwrite' });
      expect(drive.requestPermissionCalls).toBe(0);
    });
  });

  describe('the drive', () => {
    it('O1.6: fails with io-error when the drive has been pulled out', async () => {
      const drive = createTestDrive({ tree: stfsPackage('ABC') });
      drive.pull();
      expect(await openContentRoot(drive.root)).toEqual([
        false,
        [
          {
            kind: 'io-error',
            operation: 'list',
            path: [],
            error: {
              name: 'NotFoundError',
              message: 'A requested file or directory could not be found at the time an operation was processed.',
            },
          },
        ],
      ]);
    });

    it("O1.6: fails with io-error when the directory can't be read", async () => {
      const drive = createTestDrive();
      drive.fail({ operation: 'list', error: 'NotReadableError' });
      expect(await openContentRoot(drive.root)).toMatchObject([
        false,
        [{ kind: 'io-error', operation: 'list', path: [], error: { name: 'NotReadableError' } }],
      ]);
    });

    it('O1.7: opens an empty directory', async () => {
      const [ok] = await openContentRoot(createTestDrive().root);
      expect(ok).toBe(true);
    });

    it('O1.7: opens a directory holding things other than partitions', async () => {
      const drive = createTestDrive({ tree: { 'notes.txt': 1, '._0000000000000000': 1, SomeOtherDir: DIR } });
      const [ok] = await openContentRoot(drive.root);
      expect(ok).toBe(true);
    });

    it('O1.6: reads no more than it needs: one listing, and nothing else', async () => {
      const drive = createTestDrive({ tree: stfsPackage('ABC') });
      const operations: string[] = [];
      drive.onOperation(({ operation }) => operations.push(operation));
      await openContentRoot(drive.root);
      expect(operations).toEqual(['list']);
    });
  });

  describe('the root object', () => {
    it('O1.8: is frozen, with the handle and mode it was opened with', async () => {
      const drive = createTestDrive();
      const [ok, root] = await openContentRoot(drive.root, { mode: 'readwrite' });
      expect(ok).toBe(true);
      if (!ok) return;
      expect(Object.isFrozen(root)).toBe(true);
      expect(root.handle).toBe(drive.root);
      expect(root.mode).toBe('readwrite');
    });

    it('O1.9: opening one handle twice gives two independent, equivalent roots', async () => {
      const drive = createTestDrive();
      const [, first] = await openContentRoot(drive.root);
      const [, second] = await openContentRoot(drive.root);
      expect(first).not.toBe(second);
      // Equivalent: the same handle and mode. (Each root has its own bound methods.)
      expect(first).toMatchObject({ handle: drive.root, mode: 'read' });
      expect(second).toMatchObject({ handle: drive.root, mode: 'read' });
    });

    // O1.10 (no signal and no onProgress) is a property of the signature, which
    // the type checker enforces; there's nothing to observe at run time.
  });
});
