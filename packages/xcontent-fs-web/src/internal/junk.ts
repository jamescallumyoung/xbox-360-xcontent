// The rules for recognising junk files (design record §3.6): Chromium swap files
// and macOS AppleDouble files beside a header, and anything other than a data
// file inside `name.data/`. Used by `clean`, and by the functions that refuse a
// package with junk in it.

import type { AbortedReason, EntryPath, IoErrorReason, PermissionDeniedReason } from '../types.js';
import { failureFrom, isNotFoundError } from './errors.js';
import type { Listing } from './lookup.js';
import { escapeRegExp } from './regex.js';

const DATA_FILE_NAME = /^Data(\d{4})$/;

/** The first 4 bytes of every AppleDouble file. */
const APPLE_DOUBLE_MAGIC = [0x00, 0x05, 0x16, 0x07] as const;

/**
 * Whether `name` is exactly a data file's name: `Data` and 4 ASCII digits, in
 * that case. Anything else in `name.data/` is junk.
 *
 * Function design doc, J1.10.
 */
export function isDataFileName(name: string): boolean {
  return DATA_FILE_NAME.test(name);
}

/** A data file's number (`Data0012` is 12), or `undefined` for any other name. */
export function dataFileIndex(name: string): number | undefined {
  const match = DATA_FILE_NAME.exec(name);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/**
 * Whether `entryName`, in the same directory as package `packageName`'s header,
 * is one of the package's junk files, and which kind.
 *
 * Function design doc, J1.13-J1.16. The patterns are anchored and
 * case-sensitive, with the name escaped, so they never match another package's
 * files:
 * - a swap file: `^NAME(\.\d+)?\.crswap$`
 * - an AppleDouble file: `^\._NAME(\.data|(\.\d+)?\.crswap)?$`. The caller must
 *   still check its magic (see {@link hasAppleDoubleMagic}): swap files are
 *   trusted by name, AppleDouble files are not.
 *
 * `siblings` is every entry in the directory, by name. Two names are ambiguous,
 * and are kept when they may belong to another package (J1.15):
 * - `NAME.N.crswap` and `._NAME.N.crswap`, if an entry named exactly `NAME.N`
 *   exists: Chromium's counter makes them look like that package's swap file.
 * - `._NAME.data`, if `NAME.data` is a file: then it's another package's header,
 *   not this package's data directory, and `._NAME.data` is its AppleDouble file.
 */
export function classifyBesideHeader(
  packageName: string,
  entryName: string,
  siblings: ReadonlyMap<string, { readonly kind: FileSystemHandleKind }>,
): 'crswap' | 'apple-double' | undefined {
  const name = escapeRegExp(packageName);
  const swap = new RegExp(`^${name}(?:\\.(\\d+))?\\.crswap$`).exec(entryName);
  if (swap !== null) return isOwnCounter(packageName, swap[1], siblings) ? 'crswap' : undefined;
  const appleDouble = new RegExp(`^\\._${name}(?:(\\.data)|(?:\\.(\\d+))?\\.crswap)?$`).exec(entryName);
  if (appleDouble === null) return undefined;
  if (appleDouble[1] !== undefined && siblings.get(`${packageName}.data`)?.kind === 'file') return undefined;
  return isOwnCounter(packageName, appleDouble[2], siblings) ? 'apple-double' : undefined;
}

function isOwnCounter(
  packageName: string,
  counter: string | undefined,
  siblings: ReadonlyMap<string, { readonly kind: FileSystemHandleKind }>,
): boolean {
  return counter === undefined || !siblings.has(`${packageName}.${counter}`);
}

/**
 * Whether a file starts with the AppleDouble magic `00 05 16 07`. A file shorter
 * than 4 bytes doesn't.
 *
 * Function design doc, J1.14. Reads only the first 4 bytes. Errors from the
 * browser are left for the caller to turn into a reason.
 */
export async function hasAppleDoubleMagic(file: FileSystemFileHandle): Promise<boolean> {
  const head = new Uint8Array(await (await file.getFile()).slice(0, 4).arrayBuffer());
  return head.length === 4 && APPLE_DOUBLE_MAGIC.every((byte, index) => head[index] === byte);
}

/**
 * Whether a file's name alone makes it some package's junk: a swap file
 * (`*.crswap`) or, if its magic is valid, an AppleDouble file (`._*`).
 *
 * Function design doc, L1.9. Every name ending in `.crswap` is the swap file of
 * some package (`NAME.crswap` or `NAME.N.crswap`), and every name starting with
 * `._` is the AppleDouble file of some entry, so by `clean`'s rules (J1.13,
 * J1.14) such a file is never a header. An `apple-double` result still needs
 * {@link hasAppleDoubleMagic}.
 */
export function junkKindOfName(name: string): 'crswap' | 'apple-double' | undefined {
  // `._` first: `._ABC.crswap` is an AppleDouble file, checked by its magic (J1.16).
  if (name.startsWith('._')) return 'apple-double';
  if (name.endsWith('.crswap')) return 'crswap';
  return undefined;
}

type ReadFailure = PermissionDeniedReason | IoErrorReason | AbortedReason;

/**
 * Checks a file's AppleDouble magic, turning errors into reasons.
 *
 * Function design doc, J1.14 and rule 12. A file that has vanished since it was
 * listed counts as not AppleDouble, so it's skipped rather than failing the
 * whole operation: on macOS, removing a file also removes its AppleDouble file.
 */
export async function readAppleDoubleMagic(
  file: FileSystemFileHandle,
  path: EntryPath,
  signal?: AbortSignal,
): Promise<[true, boolean] | [false, [ReadFailure]]> {
  try {
    return [true, await hasAppleDoubleMagic(file)];
  } catch (error) {
    if (isNotFoundError(error)) return [true, false];
    return [false, [failureFrom(error, 'read', path, signal)]];
  }
}

/** A junk file beside a package's header. */
export interface JunkFile {
  name: string;
  handle: FileSystemFileHandle;
  kind: 'crswap' | 'apple-double';
}

/**
 * Finds a package's own junk files of the given kinds in its content-type
 * directory, from that directory's listing.
 *
 * Function design doc, J1.13-J1.16: {@link classifyBesideHeader} for each file,
 * then the magic check for AppleDouble candidates. Only files count. The magic
 * is read only for the kinds asked for.
 */
export async function findJunkBesideHeader(
  listing: Listing,
  packageName: string,
  dirPath: EntryPath,
  kinds: ReadonlySet<'crswap' | 'apple-double'>,
): Promise<[true, JunkFile[]] | [false, [PermissionDeniedReason | IoErrorReason]]>;
export async function findJunkBesideHeader(
  listing: Listing,
  packageName: string,
  dirPath: EntryPath,
  kinds: ReadonlySet<'crswap' | 'apple-double'>,
  signal: AbortSignal | undefined,
): Promise<[true, JunkFile[]] | [false, [ReadFailure]]>;
export async function findJunkBesideHeader(
  listing: Listing,
  packageName: string,
  dirPath: EntryPath,
  kinds: ReadonlySet<'crswap' | 'apple-double'>,
  signal?: AbortSignal,
): Promise<[true, JunkFile[]] | [false, [ReadFailure]]> {
  const found: JunkFile[] = [];
  for (const [name, handle] of listing) {
    if (handle.kind !== 'file') continue;
    const kind = classifyBesideHeader(packageName, name, listing);
    if (kind === undefined || !kinds.has(kind)) continue;
    if (kind === 'apple-double') {
      const [read, isAppleDouble] = await readAppleDoubleMagic(handle, [...dirPath, name], signal);
      if (!read) return [false, isAppleDouble];
      if (!isAppleDouble) continue;
    }
    found.push({ name, handle, kind });
  }
  return [true, found];
}

/** A data file in a package's `name.data/` directory. */
export interface DataFile {
  name: string;
  /** Its number: 12 for `Data0012`. */
  index: number;
  handle: FileSystemFileHandle;
}

/**
 * Splits a `name.data/` listing into its data files, in ascending numeric order
 * (gaps allowed), and everything else, which is junk.
 *
 * Function design doc, J1.10: only a file named exactly `DataNNNN` is a data
 * file. A directory with that name is junk.
 */
export function splitDataEntries(listing: Listing): {
  dataFiles: DataFile[];
  junk: { name: string; kind: FileSystemHandleKind }[];
} {
  const dataFiles: DataFile[] = [];
  const junk: { name: string; kind: FileSystemHandleKind }[] = [];
  for (const [name, handle] of listing) {
    const index = dataFileIndex(name);
    if (index !== undefined && handle.kind === 'file') dataFiles.push({ name, index, handle });
    else junk.push({ name, kind: handle.kind });
  }
  dataFiles.sort((a, b) => a.index - b.index);
  return { dataFiles, junk };
}
