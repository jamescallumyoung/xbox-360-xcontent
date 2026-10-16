// Tests for abort handling, progress reporting, error mapping and permission
// checks. Function design doc: package-wide rules 9, 10, 11 and 12.

import { describe, expect, it } from 'vitest';
import { stubReportError } from '../../__tests__/helpers/callbacks.js';
import { createTestDrive } from '../../__tests__/helpers/test-drive.js';
import { abortedReason, checkAborted } from '../abort.js';
import { failureFrom } from '../errors.js';
import { checkPermission } from '../permission.js';
import { reportProgress } from '../progress.js';

describe('abort handling', () => {
  it("rule 10: an aborted signal gives `aborted` with the signal's reason", () => {
    const controller = new AbortController();
    controller.abort('stop');
    expect(abortedReason(controller.signal)).toEqual({ kind: 'aborted', reason: 'stop' });
    expect(checkAborted(controller.signal)).toEqual({ kind: 'aborted', reason: 'stop' });
  });

  it("rule 10: the default reason is the browser's AbortError", () => {
    const controller = new AbortController();
    controller.abort();
    expect(checkAborted(controller.signal)?.reason).toMatchObject({ name: 'AbortError' });
  });

  it('rule 10: no signal, or one not aborted, gives nothing', () => {
    expect(checkAborted(undefined)).toBeUndefined();
    expect(checkAborted(new AbortController().signal)).toBeUndefined();
  });
});

describe('reportProgress', () => {
  it('rule 11.1: calls the callback synchronously, with the progress', () => {
    const calls: number[] = [];
    reportProgress((value: number) => calls.push(value), 7);
    expect(calls).toEqual([7]);
  });

  it('rule 11: does nothing without a callback', () => {
    expect(() => {
      reportProgress(undefined, 7);
    }).not.toThrow();
  });

  it('rule 11.2: passes an exception from the callback to reportError, and carries on', () => {
    const reported = stubReportError();
    const error = new Error('progress UI bug');
    expect(() => {
      reportProgress(() => {
        throw error;
      }, 7);
    }).not.toThrow();
    expect(reported).toEqual([error]);
  });
});

describe('failureFrom', () => {
  it.each(['NotAllowedError', 'SecurityError'])('rule 12: %s gives permission-denied', (name) => {
    expect(failureFrom(new DOMException('no', name), 'list', ['a'])).toEqual({
      kind: 'permission-denied',
      mode: 'read',
      state: 'denied',
    });
  });

  it.each(['create', 'write', 'close', 'remove'] as const)(
    'rule 12: a permission error while %s needed readwrite',
    (operation) => {
      expect(failureFrom(new DOMException('no', 'NotAllowedError'), operation, [])).toMatchObject({
        mode: 'readwrite',
      });
    },
  );

  it.each([
    'NotFoundError',
    'TypeMismatchError',
    'InvalidModificationError',
    'NoModificationAllowedError',
    'QuotaExceededError',
    'NotReadableError',
    'InvalidStateError',
  ])('rule 12: %s gives io-error, with the operation, path, name and message', (name) => {
    expect(failureFrom(new DOMException('it broke', name), 'write', ['a', 'b'])).toEqual({
      kind: 'io-error',
      operation: 'write',
      path: ['a', 'b'],
      error: { name, message: 'it broke' },
    });
  });

  it("rule 12: an Error that isn't a DOMException gives io-error too", () => {
    expect(failureFrom(new TypeError('bad'), 'read', [])).toMatchObject({
      kind: 'io-error',
      error: { name: 'TypeError', message: 'bad' },
    });
  });

  it('rule 12: a thrown non-error gives io-error with its text', () => {
    expect(failureFrom('oops', 'read', [])).toMatchObject({
      kind: 'io-error',
      error: { name: 'Error', message: 'oops' },
    });
  });

  it('rule 10: with an aborted signal, any error gives `aborted`', () => {
    const controller = new AbortController();
    controller.abort('stop');
    expect(failureFrom(new DOMException('x', 'AbortError'), 'write', [], controller.signal)).toEqual({
      kind: 'aborted',
      reason: 'stop',
    });
  });

  it("copies the path, so the reason doesn't change if the caller's array does", () => {
    const path = ['a'];
    const reason = failureFrom(new DOMException('x', 'NotFoundError'), 'open', path);
    path.push('b');
    expect(reason).toMatchObject({ path: ['a'] });
  });
});

describe('checkPermission', () => {
  it('rule 9: passes when granted', async () => {
    const drive = createTestDrive();
    expect(await checkPermission(drive.root, 'readwrite')).toEqual([true]);
  });

  it.each(['prompt', 'denied'] as const)('rule 9: fails with permission-denied when %s', async (state) => {
    const drive = createTestDrive({ permissions: { readwrite: state } });
    expect(await checkPermission(drive.root, 'read')).toEqual([true]);
    expect(await checkPermission(drive.root, 'readwrite')).toEqual([
      false,
      [{ kind: 'permission-denied', mode: 'readwrite', state }],
    ]);
  });

  it('rule 9: never calls requestPermission', async () => {
    const drive = createTestDrive({ permissions: { read: 'prompt', readwrite: 'prompt' } });
    await checkPermission(drive.root, 'read');
    expect(drive.requestPermissionCalls).toBe(0);
  });

  it('rule 12: a queryPermission that throws gives a failure reason, not an exception', async () => {
    const handle = {
      queryPermission: () => Promise.reject(new DOMException('gone', 'NotFoundError')),
    } as unknown as FileSystemDirectoryHandle;
    expect(await checkPermission(handle, 'read')).toEqual([
      false,
      [{ kind: 'io-error', operation: 'open', path: [], error: { name: 'NotFoundError', message: 'gone' } }],
    ]);
  });
});
