// Describing a directory tree for a test drive, writing it, and taking snapshots
// of it for assertions.

import { createHash } from 'node:crypto';
import type { IFs } from 'memfs';

/** Marks a directory in a {@link TreeSpec}. */
export const DIR = Symbol('directory');

/**
 * A tree, as paths relative to the drive's root, separated by `/`.
 *
 * A value is a file's exact contents, a file size (the contents are then made up
 * from the path, see {@link contentFor}), or {@link DIR} for a directory. Parent
 * directories are created as needed.
 */
export type TreeSpec = Record<string, Uint8Array | number | typeof DIR>;

/**
 * Deterministic file contents of the given size, different for every path, so a
 * snapshot can tell files apart and spot a file copied to the wrong place.
 */
export function contentFor(path: string, size: number): Uint8Array {
  const seed = createHash('sha1').update(path).digest();
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    bytes[i] = (seed[i % seed.length] ?? 0) ^ (i & 0xff);
  }
  return bytes;
}

/** Writes `spec` into `fs` under `base`, an absolute path in the volume. */
export function writeTree(fs: IFs, base: string, spec: TreeSpec): void {
  for (const [path, value] of Object.entries(spec)) {
    const full = joinPath(base, path);
    if (value === DIR) {
      fs.mkdirSync(full, { recursive: true });
      continue;
    }
    fs.mkdirSync(parentOf(full), { recursive: true });
    fs.writeFileSync(full, typeof value === 'number' ? contentFor(path, value) : value);
  }
}

/**
 * Lists every entry under `base`, sorted by path. Directories end in `/`; files
 * show their size and the first 12 hex digits of their SHA-1, for example
 * `0000000000000000/4D5307E6/00007000/ABC 64 3f2a...`.
 *
 * Reads the volume directly, so it never goes through a test drive's faults or
 * permissions.
 */
export function snapshotTree(fs: IFs, base: string): string[] {
  const lines: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const name of fs.readdirSync(dir).map(String)) {
      const full = joinPath(dir, name);
      const path = prefix === '' ? name : `${prefix}/${name}`;
      if (fs.statSync(full).isDirectory()) {
        lines.push(`${path}/`);
        walk(full, path);
      } else {
        const bytes = fs.readFileSync(full) as Uint8Array;
        const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
        lines.push(`${path} ${String(bytes.length)} ${hash}`);
      }
    }
  };
  walk(base, '');
  return lines.sort();
}

export function joinPath(base: string, path: string): string {
  if (path === '') return base;
  return base.endsWith('/') ? base + path : `${base}/${path}`;
}

function parentOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/')) || '/';
}
