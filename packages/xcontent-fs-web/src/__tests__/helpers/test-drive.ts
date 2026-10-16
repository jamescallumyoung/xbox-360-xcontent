// An in-memory drive with Chromium's File System Access behaviour, for tests.
//
// The files live in a memfs volume. memfs's own File System Access adapter
// (nodeToFsa) provides the writable streams, which already behave like
// Chromium's: writes go to a `<name>.crswap` swap file (or `<name>.1.crswap` if
// that's taken), which `close()` renames over the target and `abort()` deletes.
//
// The handles here wrap the volume to add what memfs lacks, all taken from the
// real-drive probe (design record §2.4):
// - FAT32's case behaviour: lookups ignore case, but `name` and `resolve()`
//   report the spelling asked for, and `isSameEntry` compares those spellings
// - permission states, as `queryPermission` reports them and as operations
//   enforce them
// - injected faults, and a pulled drive, on which everything fails
// - macOS's AppleDouble files, created beside new entries and removed with them

// Handle methods are `async` even where nothing is awaited, so that, as with the
// real API, every failure is a rejected promise rather than a synchronous throw.
/* eslint-disable @typescript-eslint/require-await */

import { memfs, type IFs } from 'memfs';
import { NodeFileSystemFileHandle } from 'memfs/lib/node-to-fsa/index.js';
import { appleDouble } from './junk.js';
import { joinPath, snapshotTree, writeTree, type TreeSpec } from './tree.js';

/** The file system operations a test can watch or make fail. */
export type DriveOperation = 'list' | 'open' | 'create' | 'read' | 'write' | 'close' | 'remove';

/** Each call to a handle method, as a listener sees it. */
export interface OperationEvent {
  operation: DriveOperation;
  /** The entry's path from the root, in the spelling it was asked for. */
  path: readonly string[];
}

/**
 * Makes matching operations throw.
 *
 * Operations are: `list` (iterating a directory), `open` (getting a handle to an
 * existing entry), `create` (getting a handle with `create: true` when the entry
 * is missing), `read` (`getFile()`), `write` (`createWritable()`, and each chunk
 * written), `close` (closing a writable) and `remove` (`removeEntry()`).
 */
export interface Fault {
  operation: DriveOperation;
  /** Only this entry, in the spelling asked for. Any entry when left out. */
  path?: readonly string[];
  /** A `DOMException`, or the name of one to create. Default `NotReadableError`. */
  error?: DOMException | string;
  /** Let this many matching operations succeed first. Default 0. */
  after?: number;
  /** Fail this many times, then succeed again. Default 1. */
  times?: number;
}

type Mode = 'read' | 'readwrite';

export interface TestDriveOptions {
  /** The tree to start with. */
  tree?: TreeSpec;
  /** The root directory's name. Default `Content`. */
  name?: string;
  /** Behave like FAT32 seen from Chromium on macOS (see the file comment). Default `false`: case-sensitive. */
  fat32?: boolean;
  /** Create and remove AppleDouble files as macOS does on FAT32. Default `false`. */
  macos?: boolean;
  /** What `queryPermission` answers, per mode. Default `granted` for both. */
  permissions?: Partial<Record<Mode, PermissionState>>;
}

export interface TestDrive {
  /** The drive's root directory, as a page would get it from `showDirectoryPicker`. */
  readonly root: FileSystemDirectoryHandle;
  /** The memfs volume, for setting things up directly. */
  readonly fs: IFs;
  /** The root's absolute path in the volume. */
  readonly base: string;
  /** Adds entries to the drive, without going through the handles. */
  write(spec: TreeSpec): void;
  /** Every entry on the drive (see `snapshotTree`). */
  snapshot(): string[];
  setPermission(mode: Mode, state: PermissionState): void;
  fail(fault: Fault): void;
  /** Pulls the drive out: from now on, every operation throws `NotFoundError`. */
  pull(): void;
  /** Calls `listener` at the start of each operation. Returns a function that stops it. */
  onOperation(listener: (event: OperationEvent) => void): () => void;
  /** How many times `requestPermission` was called on any handle. */
  readonly requestPermissionCalls: number;
}

/** Creates a test drive. See {@link TestDriveOptions}. */
export function createTestDrive(options: TestDriveOptions = {}): TestDrive {
  const { fs } = memfs();
  const name = options.name ?? 'Content';
  const base = `/${name}`;
  fs.mkdirSync(base);
  if (options.tree) writeTree(fs, base, options.tree);

  const state = new DriveState(fs, options.fat32 ?? false, options.macos ?? false, {
    read: 'granted',
    readwrite: 'granted',
    ...options.permissions,
  });

  return {
    root: new TestDirectoryHandle(state, [], base, name),
    fs,
    base,
    write: (spec) => {
      writeTree(fs, base, spec);
    },
    snapshot: () => snapshotTree(fs, base),
    setPermission: (mode, permission) => {
      state.permissions[mode] = permission;
    },
    fail: (fault) => {
      state.faults.push({ fault, seen: 0, hits: 0 });
    },
    pull: () => {
      state.pulled = true;
    },
    onOperation: (listener) => {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
    get requestPermissionCalls() {
      return state.requestPermissionCalls;
    },
  };
}

const WRITE_OPERATIONS: ReadonlySet<DriveOperation> = new Set(['create', 'write', 'close', 'remove']);

class DriveState {
  pulled = false;
  requestPermissionCalls = 0;
  readonly faults: { fault: Fault; seen: number; hits: number }[] = [];
  readonly listeners = new Set<(event: OperationEvent) => void>();

  readonly fs: IFs;
  readonly fat32: boolean;
  readonly macos: boolean;
  readonly permissions: Record<Mode, PermissionState>;

  constructor(fs: IFs, fat32: boolean, macos: boolean, permissions: Record<Mode, PermissionState>) {
    this.fs = fs;
    this.fat32 = fat32;
    this.macos = macos;
    this.permissions = permissions;
  }

  permission(mode: Mode): PermissionState {
    if (mode === 'read' && this.permissions.readwrite === 'granted') return 'granted';
    return this.permissions[mode];
  }

  /** Runs before every operation: a pulled drive, listeners, permission, then faults. */
  check(operation: DriveOperation, path: readonly string[]): void {
    if (this.pulled) throw domError('NotFoundError');
    for (const listener of this.listeners) listener({ operation, path });
    const mode = WRITE_OPERATIONS.has(operation) ? 'readwrite' : 'read';
    if (this.permission(mode) !== 'granted') throw domError('NotAllowedError');
    for (const entry of this.faults) {
      const { fault } = entry;
      if (fault.operation !== operation) continue;
      if (fault.path !== undefined && fault.path.join('/') !== path.join('/')) continue;
      entry.seen++;
      if (entry.seen <= (fault.after ?? 0)) continue;
      if (entry.hits >= (fault.times ?? 1)) continue;
      entry.hits++;
      throw typeof fault.error === 'object' ? fault.error : domError(fault.error ?? 'NotReadableError');
    }
  }

  /** The name of the entry in `dir` that `name` refers to, or `undefined`. */
  find(dir: string, name: string): string | undefined {
    const names = this.fs.readdirSync(dir).map(String);
    if (names.includes(name)) return name;
    if (!this.fat32) return undefined;
    const folded = name.toLowerCase();
    return names.find((candidate) => candidate.toLowerCase() === folded);
  }

  isDirectory(path: string): boolean {
    return this.fs.statSync(path).isDirectory();
  }

  /** As macOS does on FAT32: an AppleDouble file beside each new entry. */
  addAppleDouble(dir: string, name: string): void {
    if (this.macos) this.fs.writeFileSync(joinPath(dir, `._${name}`), appleDouble());
  }

  /** As macOS does: removing an entry also removes its AppleDouble file. */
  removeAppleDouble(dir: string, name: string): void {
    const path = joinPath(dir, `._${name}`);
    if (this.macos && this.fs.existsSync(path)) this.fs.unlinkSync(path);
  }
}

const MESSAGES: Record<string, string> = {
  NotFoundError: 'A requested file or directory could not be found at the time an operation was processed.',
  NotAllowedError: 'The request is not allowed by the user agent or the platform in the current context.',
  TypeMismatchError: 'The path supplied exists, but was not an entry of requested type.',
  InvalidModificationError: 'The object can not be modified in this way.',
};

function domError(name: string): DOMException {
  return new DOMException(MESSAGES[name] ?? `Injected ${name}.`, name);
}

/** Rejects names the File System Access API rejects. */
function assertValidName(name: string): void {
  if (name === '' || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    throw new TypeError(`Name is not allowed: ${JSON.stringify(name)}`);
  }
}

abstract class TestHandle {
  abstract readonly kind: FileSystemHandleKind;
  protected readonly state: DriveState;
  /** The path from the root, in the spelling it was asked for. */
  readonly path: readonly string[];
  /** The entry's real path in the volume. */
  protected readonly innerPath: string;
  readonly name: string;

  constructor(state: DriveState, path: readonly string[], innerPath: string, name: string) {
    this.state = state;
    this.path = path;
    this.innerPath = innerPath;
    this.name = name;
  }

  /** Like Chromium: the same entry only if reached by the same spelling (record §2.4). */
  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return Promise.resolve(
      other instanceof TestHandle &&
        other.state === this.state &&
        other.kind === this.kind &&
        other.path.join('/') === this.path.join('/'),
    );
  }

  queryPermission(descriptor?: { mode?: Mode }): Promise<PermissionState> {
    return Promise.resolve(this.state.permission(descriptor?.mode ?? 'read'));
  }

  requestPermission(descriptor?: { mode?: Mode }): Promise<PermissionState> {
    this.state.requestPermissionCalls++;
    return this.queryPermission(descriptor);
  }

  /**
   * `other`'s path below this entry, in the spelling `other` was obtained with
   * (as Chromium reports it), or `null` if it isn't this entry or below it.
   */
  protected relativePath(other: FileSystemHandle): string[] | null {
    if (!(other instanceof TestHandle) || other.state !== this.state) return null;
    const own = this.innerPath;
    if (other.innerPath !== own && !other.innerPath.startsWith(`${own}/`)) return null;
    return other.path.slice(this.path.length);
  }
}

class TestDirectoryHandle extends TestHandle implements FileSystemDirectoryHandle {
  readonly kind = 'directory';

  async getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle> {
    assertValidName(name);
    const path = [...this.path, name];
    const actual = this.state.find(this.innerPath, name);
    if (actual === undefined) {
      if (options?.create !== true) {
        this.state.check('open', path);
        throw domError('NotFoundError');
      }
      this.state.check('create', path);
      this.state.fs.mkdirSync(joinPath(this.innerPath, name));
      this.state.addAppleDouble(this.innerPath, name);
      return new TestDirectoryHandle(this.state, path, joinPath(this.innerPath, name), name);
    }
    this.state.check('open', path);
    const inner = joinPath(this.innerPath, actual);
    if (!this.state.isDirectory(inner)) throw domError('TypeMismatchError');
    return new TestDirectoryHandle(this.state, path, inner, name);
  }

  async getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle> {
    assertValidName(name);
    const path = [...this.path, name];
    const actual = this.state.find(this.innerPath, name);
    if (actual === undefined) {
      if (options?.create !== true) {
        this.state.check('open', path);
        throw domError('NotFoundError');
      }
      this.state.check('create', path);
      // Like Chromium: creating the handle creates an empty file at once (record §2.3).
      this.state.fs.writeFileSync(joinPath(this.innerPath, name), new Uint8Array());
      this.state.addAppleDouble(this.innerPath, name);
      return new TestFileHandle(this.state, path, joinPath(this.innerPath, name), name);
    }
    this.state.check('open', path);
    const inner = joinPath(this.innerPath, actual);
    if (this.state.isDirectory(inner)) throw domError('TypeMismatchError');
    return new TestFileHandle(this.state, path, inner, name);
  }

  async removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void> {
    assertValidName(name);
    const path = [...this.path, name];
    this.state.check('remove', path);
    const actual = this.state.find(this.innerPath, name);
    if (actual === undefined) throw domError('NotFoundError');
    const inner = joinPath(this.innerPath, actual);
    if (this.state.isDirectory(inner)) {
      if (options?.recursive !== true && this.state.fs.readdirSync(inner).length > 0) {
        throw domError('InvalidModificationError');
      }
      this.state.fs.rmSync(inner, { recursive: true });
    } else {
      this.state.fs.unlinkSync(inner);
    }
    this.state.removeAppleDouble(this.innerPath, actual);
  }

  async resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null> {
    return this.relativePath(possibleDescendant);
  }

  async *entries(): FileSystemDirectoryHandleAsyncIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]> {
    this.state.check('list', this.path);
    const names = this.state.fs.readdirSync(this.innerPath).map(String).sort();
    for (const name of names) {
      const inner = joinPath(this.innerPath, name);
      if (!this.state.fs.existsSync(inner)) continue;
      const path = [...this.path, name];
      yield [
        name,
        this.state.isDirectory(inner)
          ? new TestDirectoryHandle(this.state, path, inner, name)
          : new TestFileHandle(this.state, path, inner, name),
      ];
    }
  }

  async *keys(): FileSystemDirectoryHandleAsyncIterator<string> {
    for await (const [name] of this.entries()) yield name;
  }

  async *values(): FileSystemDirectoryHandleAsyncIterator<FileSystemDirectoryHandle | FileSystemFileHandle> {
    for await (const [, handle] of this.entries()) yield handle;
  }

  [Symbol.asyncIterator](): FileSystemDirectoryHandleAsyncIterator<
    [string, FileSystemDirectoryHandle | FileSystemFileHandle]
  > {
    return this.entries();
  }
}

class TestFileHandle extends TestHandle implements FileSystemFileHandle {
  readonly kind = 'file';

  async getFile(): Promise<File> {
    this.state.check('read', this.path);
    if (!this.state.fs.existsSync(this.innerPath)) throw domError('NotFoundError');
    // A copy, so the File owns a plain ArrayBuffer.
    const bytes = new Uint8Array(this.state.fs.readFileSync(this.innerPath) as Uint8Array);
    return new File([bytes], this.name);
  }

  async createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream> {
    this.state.check('write', this.path);
    if (!this.state.fs.existsSync(this.innerPath)) throw domError('NotFoundError');
    const inner = new NodeFileSystemFileHandle(this.state.fs, this.innerPath, { mode: 'readwrite' });
    const stream = await inner.createWritable({ keepExistingData: options?.keepExistingData ?? false });
    // memfs types its stream loosely; it accepts the same chunks as Chromium's.
    const writer = stream.getWriter() as WritableStreamDefaultWriter<FileSystemWriteChunkType>;
    // Wait for memfs to create the swap file, as Chromium has by the time this resolves.
    await writer.ready;
    return new TestWritableFileStream(this.state, this.path, writer);
  }
}

class TestWritableFileStream extends WritableStream<FileSystemWriteChunkType> implements FileSystemWritableFileStream {
  constructor(
    state: DriveState,
    path: readonly string[],
    writer: WritableStreamDefaultWriter<FileSystemWriteChunkType>,
  ) {
    // A fault abandons the write, which deletes the swap file. A pulled drive
    // can't delete anything, so its swap file stays behind (record §2.3).
    const guard = async (operation: DriveOperation): Promise<void> => {
      try {
        state.check(operation, path);
      } catch (error) {
        if (!state.pulled) await writer.abort(error).catch(() => undefined);
        throw error;
      }
    };
    super({
      write: async (chunk) => {
        await guard('write');
        await writer.write(chunk);
      },
      close: async () => {
        await guard('close');
        await writer.close();
      },
      abort: async (reason: unknown) => {
        if (!state.pulled) await writer.abort(reason);
      },
    });
  }

  async write(data: FileSystemWriteChunkType): Promise<void> {
    const writer = this.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  seek(): Promise<void> {
    return Promise.reject(new Error('The test drive does not support seek().'));
  }

  truncate(): Promise<void> {
    return Promise.reject(new Error('The test drive does not support truncate().'));
  }
}
