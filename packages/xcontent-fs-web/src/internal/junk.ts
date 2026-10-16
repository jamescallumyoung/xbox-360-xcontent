// The rules for recognising junk files (design record §3.6): Chromium swap files
// and macOS AppleDouble files beside a header, and anything other than a data
// file inside `name.data/`. Used by `clean`, and by the functions that refuse a
// package with junk in it.

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
 * Chromium's counter makes `NAME.1.crswap` ambiguous: it could be the swap file
 * of a package named `NAME.1`. So a name with a counter `N` is only junk if
 * `siblingNames` (every entry in the directory) has no entry named exactly
 * `NAME.N` (J1.15).
 */
export function classifyBesideHeader(
  packageName: string,
  entryName: string,
  siblingNames: ReadonlySet<string>,
): 'crswap' | 'apple-double' | undefined {
  const name = escapeRegExp(packageName);
  const swap = new RegExp(`^${name}(?:\\.(\\d+))?\\.crswap$`).exec(entryName);
  if (swap !== null) return isOwnCounter(packageName, swap[1], siblingNames) ? 'crswap' : undefined;
  const appleDouble = new RegExp(`^\\._${name}(?:\\.data|(?:\\.(\\d+))?\\.crswap)?$`).exec(entryName);
  if (appleDouble !== null) {
    return isOwnCounter(packageName, appleDouble[1], siblingNames) ? 'apple-double' : undefined;
  }
  return undefined;
}

function isOwnCounter(packageName: string, counter: string | undefined, siblingNames: ReadonlySet<string>): boolean {
  return counter === undefined || !siblingNames.has(`${packageName}.${counter}`);
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
