// In-memory folders for tests, through memfs's File System Access adapter, which
// handles `queryPermission`, `isSameEntry`, `resolve`, swap files and file times
// as Chromium does.

import { memfs } from 'memfs';
import { nodeToFsa } from 'memfs/lib/node-to-fsa/index.js';

/** A file's contents, or `null` for an empty directory. */
export type Entry = Uint8Array | string | null;

export interface TestFolder {
  /** The folder, opened in `mode`. */
  handle: FileSystemDirectoryHandle;
  /** Sets a file's last-modified time, in milliseconds. */
  touch: (path: string, ms: number) => void;
  /** The folder's entries, as sorted paths; directories end with `/`. */
  list: () => string[];
}

/**
 * A folder named `name` holding `tree`, keyed by path relative to the folder,
 * such as `0000000000000000/4D5307E6/00007000/GAME`.
 */
export function folder(
  tree: Record<string, Entry> = {},
  options: { name?: string; mode?: 'read' | 'readwrite' } = {},
): TestFolder {
  const { name = 'Content', mode = 'readwrite' } = options;
  const base = `/${name}`;
  const { fs } = memfs();
  fs.mkdirSync(base, { recursive: true });
  for (const [path, entry] of Object.entries(tree)) {
    const full = `${base}/${path}`;
    if (entry === null) {
      fs.mkdirSync(full, { recursive: true });
    } else {
      fs.mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
      fs.writeFileSync(full, entry);
    }
  }
  const list = (dir: string): string[] =>
    fs
      .readdirSync(dir)
      .map(String)
      .sort()
      .flatMap((entry) => {
        const full = `${dir}/${entry}`;
        const relative = full.slice(base.length + 1);
        return fs.statSync(full).isDirectory() ? [`${relative}/`, ...list(full)] : [relative];
      });
  return {
    handle: nodeToFsa(fs, base, { mode }) as unknown as FileSystemDirectoryHandle,
    touch: (path, ms) => {
      fs.utimesSync(`${base}/${path}`, ms / 1000, ms / 1000);
    },
    list: () => list(base),
  };
}

/**
 * A handle whose drive has been pulled out: as in Chromium, every method rejects
 * with `error` (`NotFoundError` by default), except `queryPermission`.
 */
export function pulled(handle: FileSystemDirectoryHandle, error = 'NotFoundError'): FileSystemDirectoryHandle {
  const fail = () => {
    throw new DOMException('The drive is gone.', error);
  };
  return new Proxy(handle, {
    get(target, property, receiver): unknown {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (property === 'queryPermission') return (value as (...args: unknown[]) => unknown).bind(target);
      return property === 'keys' || property === 'entries' || property === 'values'
        ? () => ({
            next: () => Promise.reject(new DOMException('The drive is gone.', error)),
            [Symbol.asyncIterator]() {
              return this;
            },
          })
        : () => Promise.resolve().then(fail);
    },
  });
}

/**
 * A folder built from plain objects, for faults memfs can't make: each file is a
 * function giving what `getFile()` resolves to, or throwing what it rejects with.
 */
export function fakeFolder(files: Record<string, () => File>): FileSystemDirectoryHandle {
  interface Dir {
    kind: 'directory';
    name: string;
    children: Map<string, Dir | { kind: 'file'; name: string; getFile: () => Promise<File> }>;
    entries: () => AsyncGenerator<[string, unknown]>;
  }
  const makeDir = (name: string): Dir => {
    const children: Dir['children'] = new Map();
    return {
      kind: 'directory',
      name,
      children,
      async *entries() {
        for (const entry of children) yield await Promise.resolve(entry);
      },
    };
  };
  const root = makeDir('Content');
  for (const [path, getFile] of Object.entries(files)) {
    const parts = path.split('/');
    const fileName = parts.pop() ?? '';
    let dir = root;
    for (const part of parts) {
      let next = dir.children.get(part);
      if (next === undefined) {
        next = makeDir(part);
        dir.children.set(part, next);
      }
      dir = next as Dir;
    }
    dir.children.set(fileName, { kind: 'file', name: fileName, getFile: () => Promise.resolve().then(getFile) });
  }
  return root as unknown as FileSystemDirectoryHandle;
}
