import type {
  EntryPath,
  IoErrorReason,
  PermissionDeniedReason,
  UnexpectedEntryTypeReason,
  WrongCaseReason,
} from '../types.js';
import { failureFrom } from './errors.js';
import { classifyBesideHeader, dataFileIndex, hasAppleDoubleMagic } from './junk.js';
import { listDirectory, lookupExact } from './lookup.js';

/** A data file in a package's `name.data/` directory. */
export interface DataFile {
  name: string;
  /** Its number: 12 for `Data0012`. */
  index: number;
  handle: FileSystemFileHandle;
}

/** What a package's entries are, as found on disk. */
export interface PackageEntries {
  /** The header file, if it exists. */
  header: FileSystemFileHandle | undefined;
  /** The `name.data/` directory, if it exists. */
  dataDirectory: FileSystemDirectoryHandle | undefined;
  /** The data files, in ascending numeric order. Empty unless `dataContents` was asked for. */
  dataFiles: DataFile[];
  /** Names of every other entry in `name.data/`, files and directories. Empty unless `dataContents` was asked for. */
  dataJunk: string[];
  /** Names of the package's junk files beside the header. Empty unless `besideHeaderJunk` was asked for. */
  junkBesideHeader: string[];
}

type InspectFailure = WrongCaseReason | UnexpectedEntryTypeReason | PermissionDeniedReason | IoErrorReason;

/**
 * Finds a package's entries in its content-type directory: the header, the
 * `name.data/` directory and, if asked, what's in it and the junk beside the
 * header.
 *
 * Both entries are optional: an orphan header or data directory, or neither, is
 * reported as it is, for the caller to judge. Each must match `packageName`
 * exactly in case (function design doc, rule 8; D1.7), or it's `wrong-case`. A
 * header that is a directory, or a `name.data` that is a file, is
 * `unexpected-entry-type` (D1.8, H1.5).
 *
 * Options:
 * - `dataContents`: list `name.data/`, sorting its data files by number (gaps
 *   allowed) from everything else (J1.10). Off, `name.data/` isn't read (H1.8).
 * - `besideHeaderJunk`: find the package's own swap and AppleDouble files beside
 *   the header (J1.13-J1.16), checking each AppleDouble file's magic.
 */
export async function inspectPackage(
  dir: FileSystemDirectoryHandle,
  dirPath: EntryPath,
  packageName: string,
  options: { dataContents?: boolean; besideHeaderJunk?: boolean } = {},
): Promise<[true, PackageEntries] | [false, InspectFailure[]]> {
  const [listed, listing] = await listDirectory(dir, dirPath);
  if (!listed) return [false, listing];

  const dataName = `${packageName}.data`;
  const [headerFound, header] = lookupExact(listing, packageName, dirPath);
  if (!headerFound) return [false, header];
  if (header?.kind === 'directory') {
    return [false, [{ kind: 'unexpected-entry-type', path: [...dirPath, packageName], expected: 'file' }]];
  }
  const [dataFound, dataDirectory] = lookupExact(listing, dataName, dirPath);
  if (!dataFound) return [false, dataDirectory];
  if (dataDirectory?.kind === 'file') {
    return [false, [{ kind: 'unexpected-entry-type', path: [...dirPath, dataName], expected: 'directory' }]];
  }

  const entries: PackageEntries = { header, dataDirectory, dataFiles: [], dataJunk: [], junkBesideHeader: [] };

  if (options.dataContents === true && dataDirectory !== undefined) {
    const [dataListed, dataListing] = await listDirectory(dataDirectory, [...dirPath, dataName]);
    if (!dataListed) return [false, dataListing];
    for (const [name, handle] of dataListing) {
      const index = dataFileIndex(name);
      if (index !== undefined && handle.kind === 'file') entries.dataFiles.push({ name, index, handle });
      else entries.dataJunk.push(name);
    }
    entries.dataFiles.sort((a, b) => a.index - b.index);
  }

  if (options.besideHeaderJunk === true) {
    const siblings = new Set(listing.keys());
    for (const [name, handle] of listing) {
      if (handle.kind !== 'file') continue;
      const kind = classifyBesideHeader(packageName, name, siblings);
      if (kind === undefined) continue;
      if (kind === 'apple-double') {
        try {
          if (!(await hasAppleDoubleMagic(handle))) continue;
        } catch (error) {
          return [false, [failureFrom(error, 'read', [...dirPath, name])]];
        }
      }
      entries.junkBesideHeader.push(name);
    }
  }

  return [true, entries];
}
