import { describe, expect, it } from 'vitest';
import type { IoErrorReason } from 'xcontent-fs-web';
import { describeFailure } from '../messages.js';

const io = (name: string, message = 'boom'): IoErrorReason => ({
  kind: 'io-error',
  operation: 'write',
  path: [],
  error: { name, message },
});

describe('describeFailure', () => {
  it('explains a package already on the drive (M1.1)', () => {
    expect(describeFailure('add', [{ kind: 'target-exists', path: ['X'], root: 'target' }])).toBe(
      'The package is already on the drive. Remove it first, then add it again.',
    );
  });

  it('reports a disconnected vault or drive (M1.2)', () => {
    expect(describeFailure('add', [{ ...io('InvalidStateError'), root: 'target' }])).toBe(
      'The drive was disconnected.',
    );
    expect(describeFailure('add', [{ ...io('NotFoundError'), root: 'source' }])).toBe('The vault was disconnected.');
    expect(describeFailure('remove', [io('NotFoundError')])).toBe('The drive was disconnected.');
  });

  it('names the vault only for an add whose reason is about the source (M1.2)', () => {
    expect(describeFailure('add', [io('NotFoundError')])).toBe('The drive was disconnected.');
    expect(describeFailure('remove', [{ ...io('NotFoundError'), root: 'source' } as never])).toBe(
      'The drive was disconnected.',
    );
    expect(describeFailure('add', [{ kind: 'permission-denied', mode: 'read', state: 'denied', root: 'source' }])).toBe(
      'Loadout no longer has permission to use the vault.',
    );
  });

  it('reports lost permission (M1.3)', () => {
    expect(describeFailure('remove', [{ kind: 'permission-denied', mode: 'readwrite', state: 'prompt' }])).toBe(
      'Loadout no longer has permission to use the drive.',
    );
  });

  it('asks for a rescan when the package changed (M1.4)', () => {
    expect(describeFailure('add', [{ kind: 'not-found', path: ['X'], root: 'source' }])).toBe(
      'The package has changed on the vault since it was scanned. Rescan and try again.',
    );
    expect(describeFailure('add', [{ kind: 'orphaned-data', path: ['X.data'], root: 'target' }])).toBe(
      'The package has changed on the drive since it was scanned. Rescan and try again.',
    );
  });

  it('names a folder in the wrong case (M1.4a)', () => {
    expect(
      describeFailure('add', [
        { kind: 'wrong-case', path: ['0000000000000000', '4D5307E6'], found: '4d5307e6', root: 'target' },
      ]),
    ).toBe('A folder on the drive has the same name in different letter case ("4d5307e6").');
  });

  it('reports junk that clean left behind (M1.4b)', () => {
    expect(describeFailure('remove', [{ kind: 'junk', path: ['._X'] }])).toBe(
      "The package has leftover files on the drive that Loadout can't remove.",
    );
  });

  it('reports a name too long to write (M1.5)', () => {
    expect(describeFailure('add', [{ kind: 'name-too-long', length: 300, max: 248 }])).toBe(
      "The package's name is too long for the browser to write.",
    );
  });

  it('gives the browser message for other I/O errors, and the kind otherwise (M1.6)', () => {
    expect(describeFailure('add', [{ ...io('NotReadableError', 'Media unreadable'), root: 'source' }])).toBe(
      'The vault reported an error: Media unreadable.',
    );
    expect(describeFailure('add', [{ ...io('NotReadableError', ''), root: 'target' }])).toBe(
      'The drive reported an error: NotReadableError.',
    );
    expect(describeFailure('add', [{ kind: 'same-root' }])).toBe('The copy failed (same-root).');
    expect(describeFailure('remove', [])).toBe('The removal failed.');
  });

  it('describes only the first reason (M1.7)', () => {
    expect(describeFailure('remove', [io('NotFoundError'), { kind: 'junk', path: ['._X'] }])).toBe(
      'The drive was disconnected.',
    );
  });
});
