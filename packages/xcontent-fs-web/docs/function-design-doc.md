# `xcontent-fs-web`: function design

One design per public function of `xcontent-fs-web`. Each section relies on the package-wide rules below, and repeats the ones it depends on most.

- **Format reference:** [xcontent-specification.md](../../../docs/xcontent-specification.md). "§" means a section of it.
- **Decision history and rationale:** [xcontent-fs-web-design-decision-record.md](xcontent-fs-web-design-decision-record.md), cited as "record §".
- **Status:** in design, no code yet. Last updated 2026-10-16.

Every statement in this document is one of:

- **Decided:** agreed during design. No marker.
- **Inferred:** follows from decisions already made, but was never discussed on its own. Marked _(inferred)_. Confirm before implementing.
- **Open:** not decided. Marked **Open**.

| ID  | Function               | Exported from | Section                       |
| --- | ---------------------- | ------------- | ----------------------------- |
| O1  | `openContentRoot`      | root          | [O1](#o1-opencontentroot)     |
| C1  | `root.copyTo`          | root (method) | [C1](#c1-rootcopyto)          |
| D1  | `root.deletePackage`   | root (method) | [D1](#d1-rootdeletepackage)   |
| H1  | `root.readHeaderBytes` | root (method) | [H1](#h1-rootreadheaderbytes) |
| L1  | `root.locatePackage`   | root (method) | [L1](#l1-rootlocatepackage)   |
| J1  | `clean`                | `/extended`   | [J1](#j1-clean)               |

---

## Package-wide API rules

These rules apply to every function. They belong in the README as well as here.

1. **Async result tuples.** Every function returns a promise of a tuple whose first element says whether it succeeded. On success the tuple is `[true]`, or `[true, value]` for functions that produce something. On failure it is `[false, reasons]`, where `reasons` is a non-empty list.
2. **No exceptions for expected failures.** Bad input, missing or unexpected entries, permission problems, I/O errors and aborts all become reasons. An exception thrown by the caller's `onProgress` doesn't fail the function either (rule 11).
3. **The order of reasons is not part of the contract.** It's deterministic, but may change between versions.
4. **How many reasons.** A function reports every invalid field of a `PackageLocation` together, and one reason per junk entry. Every other check ends the function at the first failure.
5. **All checks run before anything is changed** on disk, so a failed check leaves the drive as it was.
6. **Locations are copied on entry.** A function copies the four strings of its `PackageLocation` when called, as `fetch` copies its options, and never reads the caller's object again.
7. **Location checks** (record §3.2, §3.3), shared by every function that takes a `PackageLocation`:
   1. `partition` must match `^[0-9A-F]{16}$`, and `titleId` and `contentType` `^[0-9A-F]{8}$`. Lowercase is rejected, not converted.
   2. `packageName` must be a valid entry name: not empty, not `.` or `..`, and without `/` or `\`. It doesn't have to follow FATX's rules.
   3. A failing field gives `{ kind: 'invalid-location', field, value }`.
8. **Exact case on disk.** Every directory on a location's path, and `packageName`, must match the entry on disk exactly. This is checked by listing each parent directory, because lookups ignore case on FAT32 and `handle.name` reports the spelling asked for (record §2.4). A mismatch gives `wrong-case`.
9. **Permission is checked on every call,** by an internal `checkPermission(handle, mode)`, using `queryPermission`. Nothing ever calls `requestPermission`.
10. **`signal`** (record §3.4): an already-aborted signal makes the function return `aborted` before it does anything, including the input checks. An abort part-way is noticed between files, or cancels the current stream. The reason is `{ kind: 'aborted', reason: signal.reason }`.
11. **`onProgress`** is a plain callback. Its fields carry their unit.
    1. It's called synchronously, so its numbers always match the current state.
    2. Each call is wrapped in `try`/`catch`. An exception is passed to `globalThis.reportError()`, which reports it as a throwing event listener is reported (the page's `error` event and the console), and the operation carries on. The result is unaffected, and there's no failure reason for it. This follows axios, which isolates its progress callbacks; ky instead lets an exception fail the download (record §3.4).
    3. Chromium has had `reportError` since version 95. Node doesn't provide it, so tests under Vitest stub it.
12. **Browser errors** become `permission-denied` (from `NotAllowedError` and `SecurityError`) or `io-error` (everything else). `io-error` carries the operation, the path and the exception's `name` and `message`.
13. **Nothing is cached.** Every call reads the drive afresh.
14. **JSDoc style.** No types (TypeScript has them). A short first paragraph, which editors show on hover; extra context in later paragraphs, only when useful.

### Shared types

```ts
type PackageLocation = {
  partition: string; // 16 uppercase hex digits
  titleId: string; // 8 uppercase hex digits
  contentType: string; // 8 uppercase hex digits
  packageName: string; // the header's file name, exactly as stored
};

/** Names from the root down, as `FileSystemDirectoryHandle.resolve()` returns them. */
type EntryPath = string[];

type InvalidLocationReason = { kind: 'invalid-location'; field: keyof PackageLocation; value: string };
type PermissionDeniedReason = { kind: 'permission-denied'; mode: 'read' | 'readwrite'; state: 'prompt' | 'denied' };
type WrongCaseReason = { kind: 'wrong-case'; path: EntryPath; found: string }; // path: the expected spelling, down to the mismatched entry
type NotFoundReason = { kind: 'not-found'; path: EntryPath };
type OrphanedDataReason = { kind: 'orphaned-data'; path: EntryPath }; // the `.data` directory found without a header
type UnexpectedEntryTypeReason = { kind: 'unexpected-entry-type'; path: EntryPath; expected: 'file' | 'directory' };
type JunkReason = { kind: 'junk'; path: EntryPath };
type AbortedReason = { kind: 'aborted'; reason: unknown };
type IoErrorReason = {
  kind: 'io-error';
  operation: IoOperation;
  path: EntryPath;
  error: { name: string; message: string };
};
type IoOperation = 'list' | 'open' | 'create' | 'read' | 'write' | 'close' | 'remove' | 'verify-size';
```

The fields beyond `kind` were confirmed by James on 2026-10-16.

---

## O1 `openContentRoot`

### Summary

Opens a `Content/` tree from a directory handle. Every other function works through the root object it returns. It checks the handle and its permission, and that the drive is still there, but not what the directory holds.

### Signature

```ts
function openContentRoot(
  handle: FileSystemDirectoryHandle,
  options?: { mode?: 'read' | 'readwrite' },
): Promise<[true, ContentRoot] | [false, OpenContentRootFailureReason[]]>;
```

### Return type

```ts
interface ContentRoot {
  readonly handle: FileSystemDirectoryHandle;
  readonly mode: 'read' | 'readwrite';
  copyTo(target: ContentRoot, location: PackageLocation, options?: CopyToOptions): Promise<CopyToResult>;
  deletePackage(location: PackageLocation, options?: DeletePackageOptions): Promise<DeletePackageResult>;
  readHeaderBytes(location: PackageLocation, options?: ReadHeaderBytesOptions): Promise<ReadHeaderBytesResult>;
  locatePackage(handle: FileSystemHandle): Promise<LocatePackageResult>;
}

type OpenContentRootFailureReason = UnexpectedEntryTypeReason | PermissionDeniedReason | IoErrorReason;
```

### Behaviour

**The handle**

1. `handle` must be a directory handle (`kind === 'directory'`). Anything else gives `unexpected-entry-type`, with an empty `path`. TypeScript prevents this; the check is for JavaScript callers.
2. The directory can have any name. It doesn't have to be called `Content`.

**Permission**

3. `mode` takes the File System Access API's own values, `'read'` or `'readwrite'`, and defaults to `'read'`, like `showDirectoryPicker`.
4. Permission is checked with `checkPermission(handle, mode)`, which calls `handle.queryPermission({ mode })`. `'granted'` passes. `'prompt'` or `'denied'` give `permission-denied` with that `state`.
5. It never calls `requestPermission`. Prompting needs a user gesture, and is the caller's job (record §4.2).

**The drive**

6. It reads the first entry of the directory (or finds it empty), so a drive that has been pulled out fails here, with `io-error` (`operation: 'list'`).
7. It doesn't check what the directory holds. An empty directory, or one with non-partition entries, opens successfully.

**The root object**

8. On success it returns a plain, frozen object with the four methods and the read-only properties `handle` and `mode`. There's no exported class.
9. The object caches nothing. Opening the same handle twice gives two independent, equivalent roots.
10. Takes no `signal` and no `onProgress`.

### Notes and references

- Record §7, §4.2. Loadout stores the **handle** in IndexedDB (the root object holds functions, so it can't be stored), and opens a new root after each reload.

---

## C1 `root.copyTo`

### Summary

Copies one package from this root to the same location in another root: the same partition, Title ID, content type and name. It copies the header and, for an SVOD package, its `.data/` directory and data files. It writes one file at a time, each all at once, in an order that makes an interrupted copy detectable. It doesn't read the header or verify the package.

### Signature

```ts
copyTo(
  target: ContentRoot,
  location: PackageLocation,
  options?: {
    failOnJunk?: boolean; // default false
    cleanOutput?: boolean; // default true
    signal?: AbortSignal;
    onProgress?: (progress: CopyProgress) => void;
  },
): Promise<[true] | [false, CopyToFailureReason[]]>;
```

### Return type

```ts
type CopyProgress = {
  copiedBytes: number;
  totalBytes: number;
  copiedFiles: number;
  totalFiles: number;
  fileName: string; // the file being copied
};

type CopyToFailureReason =
  | InvalidLocationReason
  | { kind: 'name-too-long'; length: number; max: 248 }
  | { kind: 'same-root' }
  | ((
      | PermissionDeniedReason
      | WrongCaseReason
      | NotFoundReason
      | OrphanedDataReason
      | UnexpectedEntryTypeReason
      | JunkReason
      | { kind: 'target-exists'; path: EntryPath } // path: the existing entry, in its on-disk spelling
      | IoErrorReason
    ) & { root: 'source' | 'target' })
  | AbortedReason;
```

### Behaviour

**Order of checks** _(inferred)_: the signal, the location, the name length, the roots, permission, the source, junk, the target. All of them run before anything is written.

**Input**

1. An already-aborted `signal` gives `aborted` before anything else.
2. `location` is checked by the location checks (package-wide rule 7).
3. `packageName` must be at most **248** characters, or the copy fails with `name-too-long`. Writing a file needs 7 more characters for Chromium's swap file, and FAT32 allows 255 (record §4.3). APFS, exFAT and NTFS allow about the same.
4. `target` must not be this root. If `this.handle.isSameEntry(target.handle)`, the copy fails with `same-root`. The browser's method is called directly, with a comment: it can return `false` for one directory reached by two spellings, which can't happen with roots from the picker (record §7).
5. This root needs `read` permission and `target` needs `readwrite`, checked with `checkPermission`. Otherwise `permission-denied`, with `root` saying which.

**The source**

6. Every directory on the path, and `packageName`, must exist in exactly the location's case. A missing directory gives `not-found`; a different spelling gives `wrong-case`.
7. The header must exist. If only `name.data/` exists, the copy fails with `orphaned-data`. If neither exists, `not-found`.
8. If `name` is a directory, or `name.data` is a file, the copy fails with `unexpected-entry-type`.
9. **The copy never reads the header and never verifies the package.** A broken package is copied as it is: an SVOD header without `.data/` is copied as just the header, and data files with gaps (`Data0000`, `Data0001`, `Data0003`) are copied as they are. An empty `name.data/` is copied as an empty directory _(inferred)_.
10. **What's copied:** the header, `name.data/` if it exists, and the files in it named exactly `DataNNNN` (`^Data\d{4}$`). Nothing else is ever copied.

**Junk in the source**

11. With `failOnJunk: false` (the default), junk in the source is ignored: not copied, and not a reason to fail.
12. With `failOnJunk: true`, the copy fails with one `junk` reason per entry if the source has any junk:
    1. anything in `name.data/` that isn't a file named `DataNNNN`, including subdirectories
    2. the package's swap or AppleDouble files beside the header, by `clean`'s rules (J1.13–J1.16), including the AppleDouble magic check and the `NAME.N` rule _(inferred)_

**The target**

13. Each directory on the path that already exists on the target must match the location's segment exactly, or the copy fails with `wrong-case`.
14. The copy fails with `target-exists` if an entry named `name` or `name.data` exists in the target's content-type directory **in any case**, found by listing and comparing names case-insensitively. On FAT32, creating `ABC` would write into an existing `abc`.
15. Junk already at the target (such as `._ABC` or `ABC.crswap`) doesn't stop the copy. `cleanOutput` removes it.
16. Free space can't be checked beforehand. A full drive gives `io-error` part-way through.

**Writing**

17. Missing directories on the target are created with the location's spelling (uppercase).
18. For an SVOD package, the order is: create `name.data/`; copy the data files from the **highest number down to `Data0000`**, sorted by number; then copy the header. For an STFS package, only the header is copied.
19. Each file is copied in one write session: `getFileHandle(name, { create: true })`, `createWritable()`, the source file's stream piped in, then `close()`. There are no slices and no resuming.
20. After each `close()`, the copy's size is compared with the source file's size (a metadata read). A mismatch gives `io-error` with `operation: 'verify-size'`, and `error.message` giving both sizes _(inferred)_.

**Interruption**

21. An abort during a file cancels the stream and abandons the writable, so Chromium removes the swap file. The function returns `aborted`.
22. Nothing is rolled back after an abort or an `io-error`. Files and directories already written stay, and so does the empty file being written (record §5.2 lists what each interruption leaves).
23. Every interrupted copy is detectable: it leaves at least one of a `.crswap` file (only after a hard stop), a 0-byte file, a `.data/` without `Data0000`, or a `.data/` without its header.

**Cleaning the output**

24. With `cleanOutput: true` (the default), after the header has been copied, the function runs `clean(target, location, { includeParents: true, signal })` (J1).
25. This step is **best-effort and silent**: its failures don't change the result, its progress isn't reported, and an abort during it still gives `[true]`.

**Progress**

26. `totalBytes` and `totalFiles` are worked out from the source before writing starts: the header plus every `DataNNNN` file.
27. `onProgress` is called as data is written to the current file, and once after each file's `close()`. After the last call for a file, `copiedFiles` counts that file. `fileName` is the current file's name.

**Result**

28. `[true]` once the header has been copied and its size checked, whatever `cleanOutput` then does.

### Notes and references

- **Spec:** §7.3 (a package as one unit), §7.4 (copying, updated during this design).
- **Record:** §5 (all of copying), §4.3 (name length and FATX), §2.3 and §2.4 (how Chromium writes, and the probe).
- **Size of a data file:** `0xA290000` bytes (§6.7). The probe wrote one in about 5.3 s on a FAT32 USB drive.

---

## D1 `root.deletePackage`

### Summary

Deletes one package from this root: the header first, then the data files from `Data0000` upwards, then the empty `.data/` directory. It deletes orphans too, and assumes the package is clean: junk makes it fail without deleting anything.

### Signature

```ts
deletePackage(
  location: PackageLocation,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: DeleteProgress) => void;
  },
): Promise<[true] | [false, DeletePackageFailureReason[]]>;
```

### Return type

```ts
type DeleteProgress = {
  deletedFiles: number;
  totalFiles: number;
  fileName: string; // the file just deleted
};

type DeletePackageFailureReason =
  | InvalidLocationReason
  | PermissionDeniedReason
  | WrongCaseReason
  | NotFoundReason
  | UnexpectedEntryTypeReason
  | JunkReason
  | AbortedReason
  | IoErrorReason;
```

On success the result is `[true]`. It doesn't say what was deleted.

### Behaviour

**Input**

1. An already-aborted `signal` gives `aborted` before anything else.
2. `location` is checked by the location checks (package-wide rule 7). `packageName` doesn't have to follow FATX's rules: if it exists, it can be deleted.
3. The root needs `readwrite` permission, checked with `checkPermission`.
4. Every directory on the path must exist (`not-found`) in exactly the location's case (`wrong-case`).

**What it deletes**

5. It deletes whatever exists of the package: the file `name`, the directory `name.data/`, or both. Either one alone is an orphan, and is deleted.
6. If neither exists, it fails with `not-found`.
7. `name` and `name.data` must match `packageName` exactly in case. An entry with the same name in a different case gives `wrong-case` _(inferred, from rule 8)_.
8. If `name` is a directory, or `name.data` is a file, it fails with `unexpected-entry-type`.
9. It never reads the header. An empty header, or a file that isn't a package, is deleted the same way.

**It assumes the package is clean**

10. It fails with one `junk` reason per entry if `name.data/` holds anything other than files named `DataNNNN`, including swap files, AppleDouble files and subdirectories.
11. It also fails with `junk` if the package's swap or AppleDouble files sit beside the header, by `clean`'s rules (J1.13–J1.16).
12. The caller runs `clean` first (J1).

**Order**

13. All checks run before anything is deleted.
14. The header is deleted first. Then the data files, in ascending numeric order (`Data0000`, `Data0001`, …). Gaps don't stop it. Then `name.data/`.
15. `name.data/` is removed **without** `recursive`. If something appeared in it during the delete, this fails with `io-error`, instead of wiping it.
16. An interrupted delete leaves a `name.data/` without its header and without its lowest data files, detectable from names alone.
17. Empty parent directories are left in place.
18. On macOS, deleting a file also deletes its AppleDouble file (record §2.4).

**Cancelling and progress**

19. The `signal` is checked before each deletion. An abort part-way returns `aborted`, leaving the state in statement 16.
20. `onProgress` counts **files**: the header (if it exists) plus every data file. It's called after each file is deleted, so the last call has `deletedFiles === totalFiles`. Removing `name.data/` isn't a progress step.

### Notes and references

- **Spec:** §7.6 (removing, updated during this design: the header first).
- **Record:** §6.1.
- **Clean-up after an interrupted copy:** run `clean`, then `deletePackage`. Both work when the header is missing.

---

## H1 `root.readHeaderBytes`

### Summary

Reads the first `0xB000` bytes of a package's header file, for `xcontent-header`'s functions. It only does I/O: it doesn't parse or check the bytes.

### Signature

```ts
readHeaderBytes(
  location: PackageLocation,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: ReadProgress) => void;
  },
): Promise<[true, Uint8Array] | [false, ReadHeaderBytesFailureReason[]]>;
```

### Return type

```ts
type ReadProgress = {
  readBytes: number;
  totalBytes: number; // the smaller of the file's size and 0xB000
};

type ReadHeaderBytesFailureReason =
  | InvalidLocationReason
  | PermissionDeniedReason
  | WrongCaseReason
  | NotFoundReason
  | OrphanedDataReason
  | UnexpectedEntryTypeReason
  | AbortedReason
  | IoErrorReason;
```

### Behaviour

**Input**

1. An already-aborted `signal` gives `aborted` before anything else.
2. `location` is checked by the location checks (package-wide rule 7). The root needs `read` permission.
3. Every directory on the path, and `packageName`, must exist in exactly the location's case.
4. If there's no header but there is a `name.data/`, it fails with `orphaned-data`. If neither exists, `not-found`.
5. If `name` is a directory, it fails with `unexpected-entry-type`.

**Reading**

6. It reads from offset 0, up to a fixed `0xB000` bytes. There's no option to change the length: `0xB000` is always enough for every `xcontent-header` function.
7. A shorter file returns the bytes it has, even none, and still succeeds. `xcontent-header` then reports `insufficient-bytes`.
8. It doesn't parse or check the bytes, not even the magic. It never looks at `name.data/`, and ignores junk.
9. It reads the file as a stream, so it can report progress and be cancelled. An abort during the read cancels the stream and returns `aborted`.

**Result**

10. The result is always a new `Uint8Array`, and the only view of its own `ArrayBuffer`: `byteOffset` is 0, and `buffer.byteLength` equals the number of bytes read. Two calls return two separate arrays.

### Notes and references

- `xcontent-header`'s README tells callers to read `0xB000` bytes: a header is at most `0xAD0E` bytes, padded to `0xB000`.
- Like `Blob.arrayBuffer()`, `Blob.bytes()` and `Response.arrayBuffer()`, which return new memory on each call.

---

## L1 `root.locatePackage`

### Summary

Turns a handle to a package's header file, or to its `.data` directory, into that package's `PackageLocation`. It works for an orphan `.data` directory too, so the result can go straight to `deletePackage`.

### Signature

```ts
locatePackage(handle: FileSystemHandle): Promise<[true, PackageLocation] | [false, LocatePackageFailureReason[]]>;
```

### Return type

```ts
type LocatePackageFailureReason =
  | { kind: 'not-in-root' }
  | { kind: 'not-a-package-path'; path: EntryPath }
  | InvalidLocationReason
  | PermissionDeniedReason
  | WrongCaseReason
  | NotFoundReason
  | UnexpectedEntryTypeReason
  | JunkReason
  | IoErrorReason;
```

`NotFoundReason` and `UnexpectedEntryTypeReason` were added while building L1 (2026-10-16), for statement 12.

### Behaviour

**Which handles**

1. It calls `this.handle.resolve(handle)`. A `null` result means the handle isn't inside this root: `not-in-root`.
2. The path must be exactly **4 names** long: partition, Title ID, content type, then the package entry. Any other length gives `not-a-package-path`. That includes files inside `name.data/`.
3. At depth 4 it accepts two kinds of entry:
   1. **a file:** the header. `packageName` is the file's name. A file named `X.data` is a header named `X.data`.
   2. **a directory whose name ends in `.data`:** a data directory. `packageName` is its name without `.data`, whether or not the header exists.
4. Any other directory at depth 4 gives `not-a-package-path`.

**Checks**

5. The root needs `read` permission (it lists directories).
6. The first three names must pass the location checks (package-wide rule 7).
7. Every name must match the entry on disk exactly, checked by listing, because `resolve()` repeats the spelling the handle was obtained with. A mismatch gives `wrong-case`.
8. If the header and the data directory both exist but differ in case (a header `abc` beside `ABC.data/`), it fails with `wrong-case` rather than guess.
9. A junk name at depth 4 gives `junk`, by `clean`'s rules (J1.13–J1.16): for example `._ABC` or `ABC.crswap`.
10. It doesn't check that the header exists (for a data directory), and never reads it. `readHeaderBytes` is how to confirm the header.
11. Takes no `signal` and no `onProgress`.
12. A handle outlives its entry. If the entry, or a directory above it, was removed after the handle was obtained, it fails with `not-found`; if one was replaced by an entry of the other kind, with `unexpected-entry-type`.

### Notes and references

- `resolve()` returns the names from the root down to the handle, or `null` (record §2.2).

---

## J1 `clean`

### Summary

Removes junk files from one package: Chromium's swap files, macOS's AppleDouble files, and anything in `.data/` that isn't a data file. It never touches another package's files. Exported from `xcontent-fs-web/extended`.

### Signature

```ts
function clean(
  root: ContentRoot,
  location: PackageLocation,
  options?: {
    includeParents?: boolean; // default true
    signal?: AbortSignal;
    onProgress?: (progress: CleanProgress) => void;
  },
): Promise<[true] | [false, CleanFailureReason[]]>;
```

`root` is an object from `openContentRoot`, so it has been through the same checks as everything else.

### Return type

```ts
type CleanProgress = {
  step: 'svod-junk' | 'crswap' | 'apple-double' | 'parent-apple-double';
  deletedFiles: number; // within this step
  totalFiles: number; // within this step
  fileName: string; // the entry just deleted
};

type CleanFailureReason =
  InvalidLocationReason | PermissionDeniedReason | WrongCaseReason | NotFoundReason | AbortedReason | IoErrorReason;
```

### Behaviour

**Input**

1. An already-aborted `signal` gives `aborted` before anything else.
2. `location` is checked by the location checks (package-wide rule 7). The root needs `readwrite` permission.
3. Every directory on the path must exist in exactly the location's case.
4. The header and `name.data/` don't have to exist _(inferred)_: `clean` removes whatever junk it finds, and a step with nothing to do deletes nothing.

**Steps.** `clean` runs four internal functions, in this order _(inferred)_. Each takes the `signal`, lists what it will delete, then deletes it:

5. `deleteSvodJunkFiles` (step `svod-junk`)
6. `deleteCrswapFiles` (step `crswap`)
7. `deleteAppleDoubleFiles` (step `apple-double`)
8. `deleteParentAppleDoubleFiles` (step `parent-apple-double`), only when `includeParents` is `true`

**Progress**

9. Each step reports its own progress: `deletedFiles` and `totalFiles` restart at each step, and `clean` passes them on with the step's name.

**`deleteSvodJunkFiles`**

10. Deletes every entry in `name.data/` that isn't a file named exactly `DataNNNN` (`^Data\d{4}$`, case-sensitive). That includes swap files, AppleDouble files and anything else.
11. Subdirectories in `name.data/` are deleted recursively.
12. No magic check is done inside `name.data/`: nothing but data files belongs there. The JSDoc says so.

**Beside the header.** `NAME` is `packageName` with its regex characters escaped by an internal function (not `RegExp.escape`, which is ES2025). Patterns are anchored at both ends and case-sensitive.

13. `deleteCrswapFiles` deletes files in the content-type directory matching `^NAME(\.\d+)?\.crswap$`. Swap files are trusted by name.
14. `deleteAppleDoubleFiles` deletes files in the content-type directory matching `^\._NAME(\.data|(\.\d+)?\.crswap)?$`, **only if** they start with the AppleDouble magic `00 05 16 07`. A file shorter than 4 bytes, or with other bytes, is kept. The JSDoc says that swap files are trusted by name, and AppleDouble files are checked.
15. **The `NAME.N` rule.** Before deleting `NAME.N.crswap` or `._NAME.N.crswap`, both functions check that no entry named exactly `NAME.N` exists in the same directory. If one does, the file is kept: it may be the swap file of a package named `NAME.N`.
16. `deleteCrswapFiles`'s pattern starts at the name, so `._NAME.crswap` is left to `deleteAppleDoubleFiles` and its magic check.

**Parent directories**

17. `deleteParentAppleDoubleFiles` deletes exactly `._<contentType>` in the Title ID directory, `._<titleId>` in the partition directory and `._<partition>` in the root, each only if it starts with `00 05 16 07`.
18. The root's own AppleDouble file (such as `._Content`) is outside the root, so it can't be reached.

**Cancelling**

19. The `signal` is checked before each deletion, and passed to each internal function. An abort part-way returns `aborted`. Junk already deleted stays deleted.

### Tests required

James asked (2026-10-15) for tests proving the rules never touch another package's files. Each row is its own test case. The fixtures put these neighbours next to a package `ABC`: `ABCD`, `XABC` and `AB`. A neighbour `ABC.1` is added only where a row says so, because its presence changes what happens to `ABC.1.crswap`.

| Entry beside `ABC`                                                        | Expected |
| ------------------------------------------------------------------------- | -------- |
| `ABC.crswap`, `ABC.1.crswap`, `ABC.12.crswap`                             | deleted  |
| `ABC.1.crswap` when an entry `ABC.1` exists                               | kept     |
| `._ABC`, `._ABC.data`, `._ABC.crswap`, `._ABC.1.crswap`, with valid magic | deleted  |
| `._ABC` without valid magic, or shorter than 4 bytes                      | kept     |
| `ABC`, `ABC.data/`                                                        | kept     |
| `ABCD.crswap`, `._ABCD`, `XABC.crswap`, `._XABC`, `AB.crswap`             | kept     |
| `abc.crswap`, `._abc` (wrong case)                                        | kept     |
| `ABC.crswap.crswap`, `ABC.x.crswap`, `ABC.1.2.crswap`                     | kept     |

Also:

- a package named with regex characters, such as `a.b(c)[d]^$`, beside a neighbour that the unescaped pattern would match
- the escape function, against every character FATX allows in names (§5): letters, digits, space and ``! # $ % & ' ( ) - . @ [ ] ^ _ ` { } ~``
- `deleteSvodJunkFiles`: `Data0000`–`Data0003` kept; `data0000`, `Data000`, `Data00000`, `Data0000.crswap`, `._Data0000`, `COPYING` and a subdirectory with files in it all deleted
- `deleteParentAppleDoubleFiles`: `._00007000` with valid magic deleted; one without kept; the AppleDouble files of sibling directories (`._00004000`) kept

### Notes and references

- **Record:** §3.6 (junk), §6.2 (the four functions and their history), §2.4 (the probe found AppleDouble files beside every file and directory Chrome created on FAT32).
- **AppleDouble format:** the magic `00 05 16 07` at offset 0.
