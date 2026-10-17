// Can a folder be used right now? (docs/lib-design.md, F1)

import { openContentRoot, type ContentRoot, type OpenContentRootFailureReason } from 'xcontent-fs-web';
import type { FolderHealth } from './types.js';

const NO_PERMISSION = 'Loadout no longer has permission to use this folder.';

/** The health a browser error name means (F1.2-F1.4). */
function healthFromName(name: string, message: string): FolderHealth {
  switch (name) {
    case 'NotFoundError':
      return { state: 'disconnected', message: "The folder can't be found. Is the drive plugged in?" };
    case 'NotAllowedError':
    case 'SecurityError':
      return { state: 'error', message: NO_PERMISSION };
    case 'NotReadableError':
      return {
        state: 'error',
        message: "The folder can't be read. The drive may be faulty or in use by another program.",
      };
    case 'InvalidStateError':
      return { state: 'error', message: 'The folder changed while Loadout was reading it. Try again.' };
    default:
      return { state: 'error', message: message || 'Unknown error reading the folder.' };
  }
}

/** The health a caught exception means, for code that reads a folder itself (F1.5). */
export function healthFromError(error: unknown): FolderHealth {
  if (typeof error !== 'object' || error === null) return healthFromName('', '');
  const { name, message } = error as { name?: unknown; message?: unknown };
  return healthFromName(typeof name === 'string' ? name : '', typeof message === 'string' ? message : '');
}

function healthFromReason(reason: OpenContentRootFailureReason | undefined): FolderHealth {
  switch (reason?.kind) {
    case 'permission-denied':
      return { state: 'error', message: NO_PERMISSION };
    case 'io-error':
      return healthFromName(reason.error.name, reason.error.message);
    default:
      return { state: 'error', message: "This isn't a folder Loadout can open." };
  }
}

/** Opens a folder as a root, or says why it can't be used (F1.6). */
export async function openFolder(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite',
): Promise<[true, ContentRoot] | [false, FolderHealth]> {
  const [ok, result] = await openContentRoot(handle, { mode });
  return ok ? [true, result] : [false, healthFromReason(result[0])];
}

/**
 * Checks a folder by opening it with `openContentRoot`, which checks permission
 * in `mode` and reads one entry (F1.1-F1.4).
 */
export async function checkFolder(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite',
): Promise<FolderHealth> {
  const [ok, result] = await openFolder(handle, mode);
  return ok ? { state: 'connected' } : result;
}
