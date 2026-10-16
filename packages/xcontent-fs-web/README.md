# xcontent-fs-web

Copy, delete and locate Xbox 360 packages in a `Content/` tree, from a web page.

Almost everything an Xbox 360 stores (games, DLC, title updates, saves, profiles) is an XContent **package**: a single file, or for large content a header file plus a `<name>.data/` directory of data files. This package works on one package at a time, through the File System Access API: it provides functions to copy a package between two `Content/` trees, delete packages, reads its header bytes for use by [`xcontent-header`](https://github.com/jamescallumyoung/xbox360-content-utils/tree/main/packages/xcontent-header), and cleans up junk files left by browsers and macOS.

The XContent format is documented in the [XContent Specification](https://github.com/jamescallumyoung/xbox360-content-utils/blob/main/docs/xcontent-specification.md).

> **Status: in development.** Nothing is published yet, and the API may change.

## Requirements

**A Chromium-based browser,** such as Chrome, Edge, Brave, Opera or Vivaldi. As of October 2026, only Chromium-based browsers support the parts of the File System Access API this package needs: picking a real folder (`showDirectoryPicker()`) and writing files in it (`createWritable()`). Firefox and Safari can only write to their own private storage. The package is expected to work only in Chromium-based browsers.

Specifically, the following APIs are needed:

- **Your page calls these,** to get a handle to a folder and permission to use it:
  - `window.showDirectoryPicker()`: currently Chromium only
  - `FileSystemHandle.requestPermission()`, to ask again after a reload: Chromium only (a WICG draft)
- **The package calls these:**
  - `FileSystemHandle`: `queryPermission()` (Chromium only, a WICG draft) and `isSameEntry()`
  - `FileSystemDirectoryHandle`: `getDirectoryHandle()`, `getFileHandle()`, `entries()`, `removeEntry()` and `resolve()`
  - `FileSystemFileHandle`: `getFile()`, and `createWritable()` (Chromium only, outside a browser's private storage)
  - `FileSystemWritableFileStream`: `close()` and `abort()`
  - Streams and files: `Blob.stream()`, `Blob.slice()` and `ReadableStream.pipeTo()`
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
    ['getDirectoryHandle', 'getFileHandle', 'entries', 'removeEntry', 'resolve'].every(
      (name) => typeof globalThis.FileSystemDirectoryHandle?.prototype[name] === 'function',
    ) &&
    ['getFile', 'createWritable'].every(
      (name) => typeof globalThis.FileSystemFileHandle?.prototype[name] === 'function',
    ) &&
    typeof globalThis.FileSystemWritableFileStream?.prototype.close === 'function' &&
    typeof globalThis.FileSystemWritableFileStream?.prototype.abort === 'function' &&
    typeof Blob.prototype.stream === 'function' &&
    typeof ReadableStream.prototype.pipeTo === 'function' &&
    typeof AbortSignal === 'function' &&
    typeof DOMException === 'function'
  );
}
```

`showDirectoryPicker` is the check that matters most. Firefox and Safari have `createWritable()`, but only for their private storage, so without a folder picker they can't use this package.

These checks only show that the APIs exist. A user can still refuse permission, or a drive can be unplugged, so check every result the package returns.
