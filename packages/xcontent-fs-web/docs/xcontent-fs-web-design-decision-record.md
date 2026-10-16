# `xcontent-fs-web`: design decision record

**Status:** in design. No code yet. Last updated 2026-10-16.

This records the decisions made while designing the public API of `xcontent-fs-web`, the package that copies and deletes Xbox 360 packages in a `Content/` tree from a web page. It's for James and for any agent continuing the work. The format reference is [xcontent-specification.md](../../../docs/xcontent-specification.md). Section numbers (§) below refer to it. Each function's behaviour is specified in [function-design-doc.md](function-design-doc.md).

Items marked **Open** are not decided yet. Everything else is decided.

---

## 1. Context and scope

- **What it replaces.** The deprecated `xcontent-web` package copied packages. `xcontent-fs-web` replaces that part of it. The deprecated packages are not a reference for this design.
- **What it does:** opens a `Content/` tree from a directory handle, then copies, deletes, reads the header of, locates and cleans **one package at a time**. A package is the unit of §7.3: an STFS file, or an SVOD header plus its `<name>.data/` directory.
- **What it doesn't do:**
  - parse or verify headers: that's `xcontent-header`, which `readHeaderBytes` feeds
  - walk or scan a whole `Content/` tree, or check that a root holds only partitions
  - remove empty directories after a delete
  - resume an interrupted copy, or copy a file in slices (§5.3)
  - write to FATX (§4.3)

### 1.1 The name

`xcontent-fs-web` follows the `<thing>-web` / `<thing>-node` pattern of OpenTelemetry (`@opentelemetry/sdk-trace-web`, `sdk-trace-node`) and TensorFlow.js (`@tensorflow/tfjs`, `tfjs-node`). It was chosen over `xcontent-web-fs-utils`: "utils" says nothing, and the platform belongs at the end of the name.

- **"-web" names the File System Access API, not the runtime.** Node could drive the package through an adapter such as `memfs`'s `nodeToFsa`.
- **A `-node` sibling,** built on `node:fs`, is planned but low priority, and out of scope. Code shared by both may move into a common package later (as Sentry does with `@sentry/core`).
- The name `xcontent-fs-web` was free on npm on 2026-10-15. It's close to the deprecated `xcontent-web`, so that package's deprecation notice should name its replacement.

### 1.2 Function IDs

Each function has an ID, used in discussion and cited by tests. IDs are never renumbered.

| ID  | Function               | Exported from |
| --- | ---------------------- | ------------- |
| O1  | `openContentRoot`      | root          |
| C1  | `root.copyTo`          | root (method) |
| D1  | `root.deletePackage`   | root (method) |
| H1  | `root.readHeaderBytes` | root (method) |
| L1  | `root.locatePackage`   | root (method) |
| J1  | `clean`                | `/extended`   |

`copyPackage`, a function that copied a package to any path, was **dropped**. A package only works at its own partition, Title ID and content-type path, with its own name (§7.4), so a copy anywhere else is a mistake the API should prevent.

---

## 2. The browser platform

### 2.1 Browser support

The package needs `showDirectoryPicker()` to get a handle to a real folder, and `createWritable()` to write files in it. Checked against MDN's browser-compat-data (updated 2026-10-12) on 2026-10-15:

| Method                                  | Chrome / Edge   | Firefox                          | Safari                            |
| --------------------------------------- | --------------- | -------------------------------- | --------------------------------- |
| `showDirectoryPicker()`                 | 86              | not supported                    | not supported                     |
| `FileSystemFileHandle.createWritable()` | 86              | 111, origin-private storage only | 26, origin-private storage only   |
| `move()`                                | 102, files only | 111, origin-private storage only | 15.2, origin-private storage only |

- **So the package needs a Chromium-based browser.** Firefox and Safari can only write to the origin-private file system, a per-site sandbox, never the user's folders.
- **Mozilla's position on the File System Access API is negative** ([standards-positions #154](https://github.com/mozilla/standards-positions/issues/154)). A later request for a subset was closed as "defer" ([#738](https://github.com/mozilla/standards-positions/issues/738)). Firefox can read a folder through `<input type="file" webkitdirectory>` or drag and drop, but can't write to it.
- **Directories can't be moved or renamed** in Chromium ([crbug 40198034](https://crbug.com/40198034)). Nothing in this design renames anything.

### 2.2 Handles and paths

- **There are no path strings.** The API works with handles. A page gets its first handle from a picker (which needs a user gesture), drag and drop, or IndexedDB. From a directory handle, code can reach anything below it with `getDirectoryHandle` and `getFileHandle`, without asking again, but never its parent or siblings.
- **A file handle reaches only its own file.** From an SVOD header's file handle you can't find its `.data/` directory, and you can't delete a file through its own handle (`removeEntry` is called on the parent). So every operation on a package needs a **directory** handle above it, which is why every function works from an opened root.
- **The API's own path is an array of names,** from `root.resolve(handle)`. Names can't contain `/` or `\`, or be `.` or `..`.

### 2.3 How Chromium writes a file

These facts shaped the copy design. Most were checked on a real drive (§2.4).

- `getFileHandle(name, { create: true })` creates an **empty file** straight away.
- `createWritable()` writes into a **swap file**, `<name>.crswap`, beside the target. `close()` replaces the target with it in one step. `abort()`, or abandoning the stream, deletes it. Only a hard stop (a crash, a power cut, a pulled drive) leaves it behind.
- **Why the swap file exists:** the File System standard requires that writes don't show in the file until the stream is closed, and Chromium runs its security checks (Safe Browsing, and the operating system's "downloaded from the internet" marker) on the finished file before it gets its real name.
- **If `<name>.crswap` already exists,** Chromium uses `<name>.1.crswap`, and so on.
- **So each file is written all at once, or not at all.** That's the only guarantee. There's no way to append to a file without first copying it whole into a new swap file (`keepExistingData: true`), and no way to join files.
- **Swap names need 7 more characters than the file's name** (`.crswap`), or 9 with a counter. On FAT32, which allows 255, names of up to 248 characters can be written, and from 249 `createWritable()` fails.

### 2.4 The real-drive probe (2026-10-15)

A test page (`fsa-probe`) was run by James on Chrome 155.0.8059.40, macOS 26.3, against a FAT32 USB drive. Results:

| Question                                          | Result                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does `getFileHandle(create)` make a file at once? | Yes, 0 bytes. It stays after `abort()`.                                                                                                                                                                                                                                         |
| Is the swap file visible to `entries()`?          | Yes, `Data0000.crswap`, starting at 0 bytes and growing as data is written                                                                                                                                                                                                      |
| Do `close()` and `abort()` remove it?             | Both do                                                                                                                                                                                                                                                                         |
| With a stale `Data0000.crswap` present?           | Chromium used `Data0000.1.crswap`. A page can create, open and `removeEntry` `.crswap` files.                                                                                                                                                                                   |
| Name lengths                                      | 42 and 248 work. 249, 250 and 255 fail at `createWritable()` with `InvalidStateError`; 256 fails at `getFileHandle`.                                                                                                                                                            |
| Case: lookup `4D5307E6` when `4d5307e6/` exists   | Found. But `handle.name` and `resolve()` report `4D5307E6` (the spelling asked for), and `isSameEntry` with the lowercase handle is **false**. `getDirectoryHandle('4D5307E6', { create: true })` didn't create a second directory. `getFileHandle('PKGNAME')` found `pkgname`. |
| Writing 163 MB (`0xA290000`)                      | 4.8 s writing, 0.5 s in `close()`, about 30 MiB/s. The macOS cache may have flattered this. `removeEntry`: 8 ms.                                                                                                                                                                |
| `move()`                                          | Present on file handles, absent on directory handles                                                                                                                                                                                                                            |
| **AppleDouble files**                             | macOS wrote a 4 KiB `._<name>` file beside **every file and directory** Chrome created, including `._Data0000`, `._Data0000.crswap` and `._4d5307e6`. Deleting a file also deleted its `._` file.                                                                               |

Not yet tested: what a pulled drive or closed tab leaves part-way through a write (the probe's T7), and copying a real data file from a vault (T6).

---

## 3. Conventions

These follow `xcontent-header`'s conventions unless stated.

### 3.1 Result tuples

Every function returns a promise of a tuple whose first element says whether it succeeded: `[true]` or `[true, value]` on success, `[false, reasons]` on failure, where `reasons` is a list. Expected failures, including I/O errors and aborts, never throw.

### 3.2 Locations

A package is identified by a plain object:

```ts
type PackageLocation = {
  partition: string; // '0000000000000000' or a profile ID: 16 uppercase hex digits
  titleId: string; // 8 uppercase hex digits
  contentType: string; // 8 uppercase hex digits
  packageName: string; // the header's file name, exactly as stored
};
```

- **Why an object, not a string or an array:** each part is named, so they can't be swapped by mistake; it survives IndexedDB and `JSON.stringify` (Loadout stores its queue in IndexedDB); and it's easy to build in tests. A branded type was rejected because brands don't survive storage. A URI was rejected because no API accepts one.
- **Checked on every call,** since it's plain data.
- **Field names:** `titleId` and `contentType`, without `xcontent-header`'s `declared…` prefix, because these are the directory's values, which decide the truth (§7.2). `contentType` is a string here because it's a directory name. `partition` rather than `profileId: string | null`, because it's literally the directory name.
- **Copied on entry.** Every function copies the four strings when it's called, as `fetch` copies its options, so changing the object later has no effect on a running copy.

### 3.3 Case

- **Input:** `partition`, `titleId` and `contentType` must be uppercase hex. Anything else is rejected with a reason, not converted.
- **On disk:** every directory on the path must match the location's segment **exactly**, on the source and on the target. If the drive has `4d5307e6/` and the location says `4D5307E6`, the function fails.
- **`packageName` is case-sensitive,** because a game may depend on the exact name of its packages.
- **How it's checked:** by listing the parent directory and comparing names. The probe showed lookups ignore case on FAT32, and `handle.name` reports the spelling asked for, not the one on disk.
- This is stricter than §7.1, which says to match case-insensitively. It was chosen so a package never lands in a wrongly cased directory that some tools won't find (§5).

### 3.4 Cancelling and progress

Long-running functions take the two options developers know from existing web APIs:

- **`signal`, as in `fetch`.** An already-aborted signal stops the function before it does anything. An abort part-way stops between files, or cancels the current stream. Unlike `fetch`, an abort doesn't reject: it returns `[false, [{ kind: 'aborted', reason: signal.reason }]]`, matching §3.1.
- **`onProgress`, as in axios and ky.** A plain callback, not an event target. Field names carry their unit, because `ProgressEvent`'s `loaded` and `total` don't say what they count. There's no `percent`.
- **A throwing `onProgress` doesn't stop anything** (decided 2026-10-16). The callback is called synchronously inside `try`/`catch`, and an exception goes to `globalThis.reportError()`, the web's way of reporting an error as a throwing event listener is reported. The operation carries on, with no failure reason.
  - **Why:** progress is something the caller watches, not controls; cancelling is what `signal` is for. Stopping a long copy part-way because of a bug in progress UI would leave a partial copy.
  - **What the libraries do:** axios isolates its callbacks (its XHR adapter uses event listeners; its fetch adapter defers them with `queueMicrotask`), so the request carries on. Ky calls them inside a `TransformStream`, so an exception fails the download.
  - We call synchronously, not deferred like axios's fetch adapter, so the numbers always match the current state.

| Function             | `onProgress` receives                                            |
| -------------------- | ---------------------------------------------------------------- |
| C1 `copyTo`          | `{ copiedBytes, totalBytes, copiedFiles, totalFiles, fileName }` |
| D1 `deletePackage`   | `{ deletedFiles, totalFiles, fileName }`                         |
| H1 `readHeaderBytes` | `{ readBytes, totalBytes }`                                      |
| J1 `clean`           | `{ step, deletedFiles, totalFiles, fileName }`                   |

`openContentRoot` and `locatePackage` take neither: each takes milliseconds.

### 3.5 Errors from the browser

The File System Access API throws `DOMException`s: `NotFoundError` (also how a pulled drive shows up), `NotAllowedError`, `SecurityError`, `TypeMismatchError`, `InvalidModificationError`, `NoModificationAllowedError`, `QuotaExceededError` (probably a full drive; unconfirmed), `NotReadableError`, `InvalidStateError` (Chromium's catch-all: the probe got it for a name that was too long) and `AbortError`.

- **They become two reasons:** `permission-denied` (from `NotAllowedError` and `SecurityError`), because the caller can act on it by asking for permission again; and `io-error` for everything else, carrying the operation, the path and the exception's `name` and `message`.
- **Why so few:** Chromium's mapping is coarse ("name too long" is `InvalidStateError`; a pulled drive looks like a deleted file), so a reason named after the exception would often mislead. And to a caller, most of them mean the same: stop, and tell the user.

### 3.6 Junk files

Two kinds of file appear in real `Content/` trees but belong to no package:

- **Swap files** (`*.crswap`), left by a hard stop during a Chromium write (§2.3).
- **AppleDouble files** (`._*`), written by macOS beside every file and directory on a drive that can't store its extended attributes, such as FAT32 (§2.4). They start with the magic `00 05 16 07`.

Inside a package's `.data/`, anything that isn't a `DataNNNN` file counts as junk for `clean`. Junk is handled by one function, `clean` (§6), and `copyTo` and `deletePackage` assume the package is clean (with `copyTo`'s `failOnJunk` choosing whether junk in the source is ignored or fails the copy).

---

## 4. Platform constraints the package states

### 4.1 Chromium only

See §2.1. The README must say so.

### 4.2 Permission is the caller's job

Opening a root checks permission with `queryPermission` but never calls `requestPermission`: it shows a browser prompt and only works during a user gesture, and a library that prompts is surprising. The caller asks (Loadout's Reconnect flow does), then opens the root. Every function checks permission again when called, because it can be withdrawn.

### 4.3 Name length, and no FATX

Writing a file needs its name plus 7 characters for the swap file (§2.3). So:

- `copyTo` fails with `name-too-long` for a `packageName` over **248** characters, before writing anything. Otherwise it would fail only at the header, after every data file was copied.
- **FATX targets aren't supported.** FATX allows 42 characters (§5), and Xbox Live packages use all 42, so their swap names can't exist there. A FATX drive is only writable from a browser when mounted by a tool such as FATXplorer. FAT32, exFAT, NTFS and APFS all allow 255.

### 4.4 Free space

The browser can't read a drive's capacity, so a copy can't check for space first. A full drive shows up part-way through, as an `io-error`.

---

## 5. Copying

### 5.1 One write per file

Each file is copied in one `createWritable()` session, start to finish. There are no resumable copies and no slices.

- **Why not slices:** appending a slice means `createWritable({ keepExistingData: true })`, which copies the whole existing file into a new swap file first. Copying an N-byte file in k slices writes N(k + 1)/2 bytes: for a 2 GB file in 164 MiB slices, about 6.5 × N, or 13 GB to a slow USB drive.
- **Why not separate slice files joined at the end:** there's no API to join files, so joining is a second full write (2N), needing 2N of space.
- **What one write per file gives for free:** every file is either complete or never committed. SVOD data files are about 163 MB, so an interrupted GOD copy loses at most one of them. STFS packages restart from the beginning, but most are small.
- A size check after each `close()` (comparing with the source's size) catches a truncated write that reported no error. It reads only metadata.

### 5.2 Order: data first, highest number first, header last

An SVOD package is copied as: `.data/`, then the data files from the **highest number down to `Data0000`**, then the header.

So an interrupted copy always leaves something detectable from names and sizes alone, without reading a header:

| Interrupted                             | Leaves                                     |
| --------------------------------------- | ------------------------------------------ |
| during a data file, by a hard stop      | `DataNNNN.crswap`, and a 0-byte `DataNNNN` |
| during a data file, cancelled or failed | a 0-byte `DataNNNN`                        |
| between data files                      | a `.data/` without `Data0000`              |
| during `Data0000`                       | an empty `Data0000`, and no header         |
| after `Data0000`, before the header     | a `.data/` without its header              |
| during the header                       | an empty header file                       |

Because `Data0000` is copied last, a non-empty `Data0000` means every other data file was copied before it. The header comes last, as §7.4 already required, so a tool that finds packages by their header never sees a half-copied one.

### 5.3 Dropped designs

Earlier designs marked unfinished copies with `.part` or `.p` suffixes, and `COPYING`/`DELETING` marker files. James dropped them on 2026-10-15 to restart the concept. The design that replaced them, one write per file (§5.1) plus the order above, makes every interruption detectable without any markers. It also avoids two problems the earlier designs had: the browser can't rename a directory, and a suffix pushes names past FATX's limit.

### 5.4 Targets that already exist

A copy fails if the header or `.data/` already exists at the target, **in any case**: on FAT32, creating `ABC` would write into an existing `abc`. Junk already at the target doesn't stop a copy; the clean-up after the copy removes it.

### 5.5 Junk in the source: `failOnJunk`

Only the header, `.data/` and its `DataNNNN` files are ever copied. `failOnJunk` (default `false`) only decides what junk in the source means: ignored, or a reason to fail before copying anything. The default is `false` because a vault is opened read-only, so `clean` can't run on it, and a vault ever written from a Mac is full of AppleDouble files. The flag was first named `skipJunk` (default `true`); it was inverted because it's about failing, and named `failOnJunk` rather than `abortOnJunk` because "abort" already means the `signal`.

### 5.6 Cleaning the output: `cleanOutput`

Copying from a Mac makes the target dirty at once (macOS writes `._DataNNNN` as the copy goes). So `copyTo` runs `clean` on its output when it finishes, unless `cleanOutput: false`. This step is best-effort and silent: its failures don't fail the copy, its progress isn't reported, and an abort during it still returns `[true]`, because the package was already copied completely.

---

## 6. Deleting and cleaning

### 6.1 Order: header first

A package is deleted as: the header, then the data files from `Data0000` **upwards**, then the empty `.data/` directory.

- **Why:** the console and dashboard never list a package whose data is half gone. An interrupted delete leaves a `.data/` with no header and without its lowest data files, which is detectable from names alone, the same idea as the copy order.
- **This reverses the old §7.6,** which removed the data first so that tools that find packages by their headers would see a leftover header. That reasoning assumed tools never look at directory names. §7.6 was updated to match (§9).
- The directory is removed without `recursive`, so if something appears in it during the delete, removing it fails rather than wiping it.
- Orphans are deleted too: a header without `.data/`, or a `.data/` without a header.
- Empty parent directories are left in place (§7.6 says a tool "may" remove them).

### 6.2 `clean` and its four internal functions

`clean` removes junk (§3.6) from one package. Its rules never touch another package's files. It runs four internal single-purpose functions, each of which takes the `signal` and reports progress as its own step:

| Function                       | Step                  | Deletes                                                                                                             |
| ------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `deleteSvodJunkFiles`          | `svod-junk`           | everything in `name.data/` not named exactly `DataNNNN`, including subdirectories (recursively)                     |
| `deleteCrswapFiles`            | `crswap`              | files beside the header matching `^NAME(\.\d+)?\.crswap$`                                                           |
| `deleteAppleDoubleFiles`       | `apple-double`        | files beside the header matching `^\._NAME(\.data\|(\.\d+)?\.crswap)?$` that start with `00 05 16 07`               |
| `deleteParentAppleDoubleFiles` | `parent-apple-double` | `._<dirname>` for each parent directory up to the root, if it starts with `00 05 16 07`; only with `includeParents` |

- `NAME` is the package name with its regex characters escaped. FATX names can contain `. ( ) [ ] ^ $ { }` (§5). The escape is an internal function, not `RegExp.escape`, which is ES2025 (the repo targets ES2024).
- **Before deleting `NAME.N.crswap` or `._NAME.N.crswap`, the functions check that no entry named `NAME.N` exists,** because Chromium's counter makes `ABC.1.crswap` ambiguous: it could belong to a package named `ABC.1`.
- **AppleDouble files beside the header are checked for their magic;** swap files are trusted by name. Inside `.data/`, everything that isn't `DataNNNN` is removed without a check, since nothing else belongs there. The JSDoc says so.
- Patterns are anchored and case-sensitive, so `ABC`'s clean never matches `ABCD.crswap` or `._XABC`. Tests must prove this (function-design-doc J1).
- `deleteCrswapFiles`'s pattern starts at the name, so `._ABC.crswap` goes through `deleteAppleDoubleFiles` and its magic check.
- Earlier designs put swap-file handling in `deletePackage` (`deleteCrswap`, `treatCrswapAsDirty`) and an `allowDirtySvodData` option on copy and delete. All were replaced by `clean`.

### 6.3 Why `clean` is in `/extended`

`clean` is the only function exported from `xcontent-fs-web/extended`. There are no other candidates at present. Its four internal functions stay internal.

---

## 7. Opening a root

- `openContentRoot(handle, { mode })` returns a plain, frozen object with the four methods and read-only `handle` and `mode`. There's no exported class, so nothing outside the package can make an unchecked root.
- `mode` uses the File System Access API's own option name and values (`'read' | 'readwrite'`, default `'read'`). A vault is opened `'read'`, a drive `'readwrite'`.
- The root's contents aren't checked: any directory can be a root, including an empty one, and every function checks what it touches. A function to check that a root holds only partitions (Loadout's X5) could come later.
- A liveness check reads the first entry, so a pulled drive fails when opening rather than at the first copy.
- Nothing is cached. Every call reads the drive afresh.
- `copyTo` refuses a target that is the same directory as the source, using the browser's `isSameEntry` directly. A wrapper was considered and rejected: it would only rename the method. **Caveat** (from the probe): `isSameEntry` can return `false` for one directory reached by two spellings. Roots from the picker aren't affected.

---

## 8. Implementation decisions (2026-10-16)

- **No verticals.** Unlike `xcontent-header`, the package is small enough without them. Public functions live in the `src/` root, one file each; everything else lives in `src/internal/`, and is never exported.
- **Tooling from the start:** ESLint (typescript-eslint's `strictTypeChecked`, and `xcontent-header`'s import rules) and Prettier are set up in the first stage, not added later as in `xcontent-header`. Otherwise the setup mirrors `xcontent-header`: pnpm, TypeScript 7 with TypeScript 6 for typescript-eslint, Vitest 5, ES2024.
- **Licence:** `AGPL-3.0-only`, like `xcontent-header`.
- **Type declarations:** TypeScript's own libs (`dom`, `dom.asynciterable`) as far as possible, plus a small `runtime.d.ts` for what they lack, such as `queryPermission` (a WICG draft). No non-trivial hand-written runtime declarations.
- **Test double:** `memfs`'s `nodeToFsa`, which already emulates Chromium's swap files, `queryPermission`, `isSameEntry` and `resolve`, wrapped by a test helper that adds FAT32's case behaviour, AppleDouble files, permission states and injected I/O failures.

**Still open:** the probe's T6 and T7 (§2.4), planned for after the last stage.

---

## 9. Spec changes made during this design

- **§7.4:** data files are copied from the highest number down; one write per file; Chromium's swap files and macOS's AppleDouble files described; FATX targets need names short enough for swap files.
- **§7.6:** the delete order reversed: the header first, then the data files from `Data0000` up, then the directory.
- **§8.3 and §8.10:** the probe added as primary research.
