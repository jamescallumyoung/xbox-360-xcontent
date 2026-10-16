# xcontent-fs-web

Copy, delete and locate Xbox 360 packages in a `Content/` tree, from a web page.

Almost everything an Xbox 360 stores (games, DLC, title updates, saves, profiles) is an XContent **package**: a single file, or for large content a header file plus a `<name>.data/` directory of data files. This package works on one package at a time, through the File System Access API: it can copy a package between two `Content/` trees, delete packages, read a package's header bytes for use by [`xcontent-header`](https://github.com/jamescallumyoung/xbox360-content-utils/tree/main/packages/xcontent-header), and it can clean up junk files left by browsers and macOS.

The XContent format is documented in the [XContent Specification](https://github.com/jamescallumyoung/xbox360-content-utils/blob/main/docs/xcontent-specification.md). Section references below (§) point to it.

> **Status: pre-1.0.** The API may change between minor versions.
>
> - **Available now:** `openContentRoot`, and on the root it returns `copyTo`, `deletePackage`, `readHeaderBytes` and `locatePackage`; `clean` in `xcontent-fs-web/extended`.

## Requirements

**A Chromium-based browser,** such as Chrome, Edge, Brave, Opera or Vivaldi. As of October 2026, only Chromium-based browsers support the parts of the File System Access API this package needs: picking a real folder (`showDirectoryPicker()`) and writing files in it (`createWritable()`). Firefox and Safari can only write to their own private storage. The package is expected to work only in Chromium-based browsers.

Specifically, the following APIs are needed:

- **Your page calls these,** to get a handle to a folder and permission to use it:
  - `window.showDirectoryPicker()`: currently Chromium only
  - `FileSystemHandle.requestPermission()`, to ask again after a reload: Chromium only (a WICG draft)
- **The package calls these:**
  - `FileSystemHandle`: `queryPermission()` (Chromium only, a WICG draft) and `isSameEntry()`
  - `FileSystemDirectoryHandle`: `getDirectoryHandle()`, `getFileHandle()`, `entries()`, `keys()`, `removeEntry()` and `resolve()`
  - `FileSystemFileHandle`: `getFile()`, and `createWritable()` (Chromium only, outside a browser's private storage)
  - `FileSystemWritableFileStream`: `write()`, `close()` and `abort()`
  - Files and streams: `Blob.stream()`, `Blob.slice()`, `Blob.arrayBuffer()` and `ReadableStream.getReader()`
  - `AbortSignal`, `DOMException` and `reportError()`

The File System Access API is only available in secure contexts: pages served over https, or from `localhost`.

Check that the current browser has all of the required APIs with:

```js
function hasRequiredApis() {
  return (
    window.isSecureContext &&
    typeof window.showDirectoryPicker === 'function' &&
    typeof window.reportError === 'function' &&
    typeof globalThis.FileSystemHandle?.prototype.queryPermission === 'function' &&
    typeof globalThis.FileSystemHandle?.prototype.requestPermission === 'function' &&
    typeof globalThis.FileSystemHandle?.prototype.isSameEntry === 'function' &&
    ['getDirectoryHandle', 'getFileHandle', 'entries', 'keys', 'removeEntry', 'resolve'].every(
      (name) => typeof globalThis.FileSystemDirectoryHandle?.prototype[name] === 'function',
    ) &&
    ['getFile', 'createWritable'].every(
      (name) => typeof globalThis.FileSystemFileHandle?.prototype[name] === 'function',
    ) &&
    ['write', 'close', 'abort'].every(
      (name) => typeof globalThis.FileSystemWritableFileStream?.prototype[name] === 'function',
    ) &&
    ['stream', 'slice', 'arrayBuffer'].every((name) => typeof Blob.prototype[name] === 'function') &&
    typeof ReadableStream.prototype.getReader === 'function' &&
    typeof AbortSignal === 'function' &&
    typeof DOMException === 'function'
  );
}
```

`showDirectoryPicker` is the check that matters most. Firefox and Safari have `createWritable()`, but only for their private storage, so without a folder picker they can't use this package.

These checks only show that the APIs exist. A user can still refuse permission, or a drive can be unplugged, so check every result the package returns.

### The drives you write to

- **Names need room for a swap file.** Chromium writes every file through a swap file named `<name>.crswap`, 7 characters longer than the file's name. So `copyTo` accepts package names of up to **248** characters, which works on FAT32, exFAT, NTFS and APFS (all allow 255).
- **FATX isn't supported.** An Xbox 360's own file system allows only 42 characters, and Xbox Live packages use all 42, so their swap files can't exist there. Write to a FAT32 USB drive, which modded consoles read, rather than to a FATX drive mounted on a computer.
- **Free space can't be checked.** The browser can't read a drive's capacity, so a full drive shows up part-way through a copy, as an `io-error`.

## Install

```sh
npm install xcontent-fs-web
```

## Quick start

Pick two folders (a "vault" to copy from, and a "drive" to copy to), open them as roots, read a package's header, and copy the package:

```ts
import { openContentRoot, type PackageLocation } from 'xcontent-fs-web';
import { parseHeader } from 'xcontent-header';

// showDirectoryPicker needs a user gesture, such as a click.
async function onCopyClicked() {
  const [vaultOk, vault] = await openContentRoot(await showDirectoryPicker({ mode: 'read' }));
  const [driveOk, drive] = await openContentRoot(await showDirectoryPicker({ mode: 'readwrite' }), {
    mode: 'readwrite',
  });
  if (!vaultOk || !driveOk) return;

  const location: PackageLocation = {
    partition: '0000000000000000',
    titleId: '4D5307E6',
    contentType: '00007000',
    packageName: 'E2A4C0F1B3D5E7A9C1E3F5A7B9D1E3F5',
  };

  const [read, bytes] = await vault.readHeaderBytes(location);
  if (read) {
    const [parsed, header] = parseHeader(bytes);
    if (parsed) console.log(header.displayNames[0]);
  }

  const stop = new AbortController(); // call stop.abort() to cancel
  const [copied, reasons] = await vault.copyTo(drive, location, {
    signal: stop.signal,
    onProgress: ({ copiedBytes, totalBytes, fileName }) => {
      console.log(`${fileName}: ${Math.round((copiedBytes / totalBytes) * 100)}%`);
    },
  });
  if (!copied) console.log(reasons);
}
```

## Locations

A package is identified by a `PackageLocation`: its partition, Title ID and content type directories, and its header's name.

```ts
interface PackageLocation {
  partition: string; // '0000000000000000', or a profile ID: 16 uppercase hex digits
  titleId: string; // 8 uppercase hex digits, such as '4D5307E6'
  contentType: string; // 8 uppercase hex digits, such as '00007000'
  packageName: string; // the header's file name, exactly as stored
}
```

- **It's plain data,** so you can store it (in IndexedDB, or as JSON) and build it by hand. Every function checks it when called, and copies it, so changing your object during a call has no effect.
- **Hex digits must be uppercase.** Lowercase is rejected, not converted.
- **Case matters, on disk too.** Every directory and the package's name must match the drive exactly. On FAT32, a lookup for `4D5307E6` also finds `4d5307e6`; this package lists each directory to check, and fails with `wrong-case` rather than use a directory in another case.
- **From a handle:** `root.locatePackage(handle)` turns a handle to a header file, or to a `.data` directory, into a location.

## The API

### How results work

Every function returns a promise of a tuple whose first element says whether it succeeded:

- `[true]`, or `[true, result]` for functions that return something, on success.
- `[false, reasons]` on failure, where `reasons` is a list of failure reasons.

Check the first element before using the second. TypeScript narrows the second element when both are declared with `const`:

```ts
const [ok, value] = await root.readHeaderBytes(location);
if (ok) {
  console.log(value.length); // value is a Uint8Array
} else {
  console.log(value[0]?.kind); // value is a list of failure reasons
}
```

A few more rules apply to every function:

- **No exceptions for expected failures.** Bad input, missing entries, permission problems, I/O errors and aborts all come back as reasons.
- **Every check runs before anything changes.** A failed check leaves the drive as it was.
- **The order of reasons isn't part of the contract.** It's the same for the same input, but may change between versions. Invalid location fields and junk files are each reported together; every other check stops at the first failure.
- **Nothing is cached.** Every call reads the drive afresh.
- **Permission is your job.** Functions check permission with `queryPermission`, and fail with `permission-denied` if it isn't granted, but never prompt. After a reload, ask again yourself, during a user gesture:

  ```ts
  if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    await handle.requestPermission({ mode: 'readwrite' }); // in a click handler
  }
  ```

### Cancelling and progress

The long-running functions take a `signal` and an `onProgress` callback:

- **`signal`, as in `fetch`.** An already-aborted signal stops a function before it does anything. An abort part-way is noticed between files, or between chunks of a file. Unlike `fetch`, an abort doesn't reject: it returns `[false, [{ kind: 'aborted', reason }]]`, where `reason` is the signal's.
- **`onProgress`,** a plain callback. Its fields say what they count (`copiedBytes`, `deletedFiles` and so on). It's called synchronously. If it throws, the exception goes to `reportError()`, which reports it like a throwing event listener (the page's `error` event and the console), and the operation carries on: progress is something you watch, not control.

### Failure reasons

These reasons are shared by several functions:

| `kind`                  | Meaning                                                          | Extra fields                             |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `invalid-location`      | A `PackageLocation` field isn't valid                            | `field`, `value`                         |
| `permission-denied`     | The page doesn't have permission in the mode needed              | `mode`, `state` (`'prompt'`, `'denied'`) |
| `wrong-case`            | An entry exists, but in another case                             | `path` (as asked for), `found` (on disk) |
| `not-found`             | An entry doesn't exist                                           | `path`                                   |
| `orphaned-data`         | A `.data/` directory exists without its header                   | `path`                                   |
| `unexpected-entry-type` | A file where a directory belongs, or the reverse                 | `path`, `expected`                       |
| `junk`                  | A junk file in a package (see [`clean`](#clean))                 | `path`                                   |
| `aborted`               | The `signal` was aborted                                         | `reason`                                 |
| `io-error`              | The browser reported another error, such as a drive pulled out  | `operation`, `path`, `error` (`name`, `message`) |

A `path` is a list of names from the root down, as `FileSystemDirectoryHandle.resolve()` gives them.

### Functions

#### `openContentRoot(handle, { mode })`

Opens a `Content/` tree from a directory handle. Every other function works through the root it returns. `mode` is `'read'` (the default) or `'readwrite'`, as for `showDirectoryPicker`.

It checks that the handle is a directory, that permission is granted in `mode`, and that the drive is still there. It doesn't check what the directory holds, and the directory can have any name. The root is a frozen object with `handle`, `mode` and the methods below. Store the handle, not the root, if you want to reopen it after a reload.

#### `root.readHeaderBytes(location, { signal, onProgress })`

Reads the first `0xB000` bytes of a package's header file, for `xcontent-header`'s functions: that's always enough for every one of them. It doesn't parse or check the bytes. A shorter file gives what it has. The result is a new array, which you own.

A `.data/` directory without its header gives `orphaned-data`.

#### `root.locatePackage(handle)`

Turns a handle to a package's header file, or to its `.data` directory, into that package's `PackageLocation`. It works for a `.data` directory without its header too, so the result can go straight to `deletePackage`. Other handles give `not-in-root` or `not-a-package-path`, and a junk file gives `junk`.

#### `root.copyTo(target, location, options)`

Copies one package from this root to the same location in `target`, another root opened with `readwrite`. Options: `failOnJunk` (default `false`), `cleanOutput` (default `true`), `signal` and `onProgress`.

- **What's copied:** the header and, for an SVOD package, its `.data/` directory and the files in it named `DataNNNN`. Nothing else. The header isn't read or verified, so a broken package is copied as it is.
- **The order:** data files from the highest number down to `Data0000`, then the header last. Each file is written in one go, through Chromium's swap file, and its size is checked afterwards.
- **An interrupted copy is always detectable.** It leaves at least one of: a `.crswap` swap file (after a crash or a pulled drive), an empty file, a `.data/` without `Data0000`, or a `.data/` without its header. Nothing is rolled back. See [recovering from an interrupted copy](#recovering-from-an-interrupted-copy).
- **Junk in the source** (see [`clean`](#clean)) is never copied. With `failOnJunk: true`, it fails the copy.
- **`cleanOutput`** runs `clean` on the copy afterwards, to remove the AppleDouble files macOS adds. It's best-effort and silent: its failures and progress don't change the copy's result.
- **The target must be free.** If the package's header or `.data/` already exists at the target, in any case, the copy fails with `target-exists`. This is checked again just before `.data/` and the header are created, but the browser has no "create only if new", so don't run two copies of the same package to the same drive at once.

Its own failure reasons, besides the shared ones:

| `kind`           | Meaning                                                    | Extra fields      |
| ---------------- | ---------------------------------------------------------- | ----------------- |
| `name-too-long`  | `packageName` is over 248 characters                       | `length`, `max`   |
| `same-root`      | `target` is this root                                      |                   |
| `target-exists`  | The package, or its name in another case, is at the target | `path`            |

Reasons about a root also say which, with `root: 'source'` or `root: 'target'`. Progress gives `copiedBytes`, `totalBytes`, `copiedFiles`, `totalFiles` and `fileName`.

#### `root.deletePackage(location, { signal, onProgress })`

Deletes one package: the header first, then the data files from `Data0000` upwards, then the empty `.data/` directory. It deletes a header or `.data/` directory found on its own too. Empty parent directories stay.

- **The header goes first,** so the console never lists a half-deleted package. An interrupted delete leaves a `.data/` without its header and without its lowest data files.
- **It assumes the package is clean.** Junk in `.data/`, or the package's swap or AppleDouble files beside its header, make it fail with one `junk` reason per file, deleting nothing. Run `clean` first.
- The `.data/` directory is removed without `recursive`: anything that appears in it during the delete makes the delete fail, rather than be wiped.

Progress counts files: the header plus each data file.

## `xcontent-fs-web/extended`

### `clean`

```ts
import { clean } from 'xcontent-fs-web/extended';

const [ok, reasons] = await clean(root, location, { includeParents: true, signal, onProgress });
```

Removes junk files from one package, on a root opened with `readwrite`. It never touches another package's files. Junk is:

- **Swap files**, `NAME.crswap` or `NAME.N.crswap`, left beside a file when Chromium was stopped while writing it. They're recognised by name.
- **AppleDouble files**, `._NAME` and the like, which macOS writes beside every file and directory it creates on a drive like FAT32. They're only deleted if they start with the AppleDouble magic bytes `00 05 16 07`: a file with the name but other contents is kept.
- **Anything in `.data/` that isn't a file named `DataNNNN`**, including directories. Nothing else belongs there, so no magic is checked.
- With `includeParents` (the default), the AppleDouble files of the package's partition, Title ID and content-type directories, which the packages under them share.

The patterns are case-sensitive and match only this package's name, so `clean` for `ABC` never deletes `ABCD.crswap`. Names that may belong to another package are kept: `ABC.1.crswap` if a package `ABC.1` exists, and `._ABC.data` if `ABC.data` is a file.

The header and `.data/` don't have to exist, but if they do, they must match the name exactly. Progress comes in four steps (`svod-junk`, `crswap`, `apple-double`, `parent-apple-double`), each with its own `deletedFiles` and `totalFiles`.

## Recovering from an interrupted copy

A copy that was stopped, failed, or cut off by a pulled drive leaves the package incomplete at the target, and detectable. To remove it:

1. `clean(drive, location)` removes any swap files and AppleDouble files.
2. `drive.deletePackage(location)` removes the rest, whether or not the header was written.

Then copy again. A target that still holds anything of the package fails with `target-exists`.

## Development

This package lives in the [xbox360-content-utils](https://github.com/jamescallumyoung/xbox360-content-utils) monorepo, and uses pnpm. Its design is in [`docs/`](https://github.com/jamescallumyoung/xbox360-content-utils/tree/main/packages/xcontent-fs-web/docs): a design decision record, and a function design doc whose numbered statements (such as `C1.18`) the tests cite.

Running the tests needs **Node 22.12 or later** (for Vitest 5).

```sh
pnpm build         # compile to dist/js and dist/types
pnpm typecheck     # library and tests
pnpm lint
pnpm format:check  # or `pnpm format` to fix
pnpm test
```

The tests run in Node, against an in-memory drive built on [memfs](https://github.com/streamich/memfs), which behaves like Chromium on a real drive: swap files, FAT32's case-insensitive lookups, permission states, injected I/O errors, a pulled drive, and macOS's AppleDouble files.

## Use of AI

Development of this package is **AI-assisted**. AI tools helped write its code, tests and documentation. However, development was still driven by a human (beyond just prompting) and human input and review was involved in every stage of development.

This package is **not** **"vibe-coded"**. No code was generated without human oversight.

## Contributing

This project doesn't accept pull requests from the public. Many open-source projects are flooded with low-effort, vibe-coded submissions that easily exhaust the maintainers' efforts to review them.

If you'd like to contribute, you're welcome to contact the maintainers and ask for access.

The project is open source, so anyone may fork it without asking first.

## Licence

[AGPL-3.0-only](./LICENSE).
