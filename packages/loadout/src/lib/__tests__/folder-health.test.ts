import { describe, expect, it } from 'vitest';
import { checkFolder, healthFromError, openFolder } from '../folder-health.js';
import { folder, pulled } from './helpers/drive.js';

describe('checkFolder', () => {
  it('is connected when the folder opens (F1.1)', async () => {
    expect(await checkFolder(folder().handle, 'readwrite')).toEqual({ state: 'connected' });
  });

  it('is disconnected when the drive is gone (F1.2)', async () => {
    expect(await checkFolder(pulled(folder().handle), 'read')).toEqual({
      state: 'disconnected',
      message: "The folder can't be found. Is the drive plugged in?",
    });
  });

  it('is an error without permission (F1.3)', async () => {
    expect(await checkFolder(folder({}, { mode: 'read' }).handle, 'readwrite')).toEqual({
      state: 'error',
      message: 'Loadout no longer has permission to use this folder.',
    });
  });

  it('is an error, with a plain message, for other failures (F1.4)', async () => {
    expect(await checkFolder(pulled(folder().handle, 'NotReadableError'), 'read')).toEqual({
      state: 'error',
      message: "The folder can't be read. The drive may be faulty or in use by another program.",
    });
  });
});

describe('healthFromError', () => {
  it('maps a caught exception the same way (F1.5)', () => {
    expect(healthFromError(new DOMException('gone', 'NotFoundError'))).toMatchObject({ state: 'disconnected' });
    expect(healthFromError(new DOMException('no', 'NotAllowedError'))).toMatchObject({
      state: 'error',
      message: 'Loadout no longer has permission to use this folder.',
    });
    expect(healthFromError(new DOMException('moved', 'InvalidStateError'))).toEqual({
      state: 'error',
      message: 'The folder changed while Loadout was reading it. Try again.',
    });
    expect(healthFromError(new Error('Odd failure'))).toEqual({ state: 'error', message: 'Odd failure' });
    expect(healthFromError('weird')).toEqual({ state: 'error', message: 'Unknown error reading the folder.' });
  });
});

describe('openFolder', () => {
  it('opens a folder as a root in its mode, or gives its health (F1.6)', async () => {
    const [ok, root] = await openFolder(folder().handle, 'readwrite');
    expect(ok).toBe(true);
    expect(root).toMatchObject({ mode: 'readwrite' });
    expect(await openFolder(pulled(folder().handle), 'read')).toEqual([
      false,
      { state: 'disconnected', message: "The folder can't be found. Is the drive plugged in?" },
    ]);
  });
});
