// The per-package scan of a Content/ tree's public partition
// (docs/lib-design.md, S1; Loadout's X2).

import { LanguageSlot, parseHeader, type Header } from 'xcontent-header';
import { packageKind } from './content-types.js';
import { healthFromError } from './folder-health.js';
import type { FolderHealth, Package, Title } from './types.js';

const PUBLIC = '0000000000000000';
const HEX8 = /^[0-9A-F]{8}$/;
/** Always enough for a whole header: at most 0xAD0E bytes, padded to 0xB000. */
const HEADER_READ_SIZE = 0xb000;

/** A scanned package, with the header fields titles are built from. */
interface Found {
  pkg: Package;
  header: Header | null;
}

/** Lists a directory's entries, sorted by name. */
async function list(dir: FileSystemDirectoryHandle): Promise<[string, FileSystemHandle][]> {
  const entries: [string, FileSystemHandle][] = [];
  for await (const entry of dir.entries()) entries.push(entry);
  return entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The subdirectories named with 8 uppercase hex digits (S1.2). */
async function hexDirectories(dir: FileSystemDirectoryHandle): Promise<[string, FileSystemDirectoryHandle][]> {
  return (await list(dir)).filter(
    (entry): entry is [string, FileSystemDirectoryHandle] => entry[1].kind === 'directory' && HEX8.test(entry[0]),
  );
}

/** A download in progress: a CON placeholder for the dashboard, outside its own directory (S1.11). */
function isDownloadInProgress(header: Header, titleId: string, contentType: string): boolean {
  return (
    header.declaredSigning === 'CON' &&
    header.declaredTitleId === 'FFFE07D1' &&
    header.declaredContentType === 0xb0000 &&
    !(titleId === 'FFFE07D1' && contentType === '000B0000')
  );
}

/** A header's English display name, else its title name (S1.8, S1.13). */
const headerName = (h: Header): string | null => h.displayNames[LanguageSlot.English] ?? h.titleName;

/**
 * Reads one header file into a package (S1.6-S1.9). Gives `undefined` for a file
 * that isn't a package, or a download in progress (S1.3, S1.11). A browser error
 * isn't caught: it ends the scan (S1.19).
 */
async function readPackage(
  handle: FileSystemFileHandle,
  base: Pick<Package, 'location' | 'kind'>,
): Promise<Found | undefined> {
  const { titleId, contentType, packageName } = base.location;
  const file = await handle.getFile();
  const [ok, header] = parseHeader(new Uint8Array(await file.slice(0, HEADER_READ_SIZE).arrayBuffer()));
  if (!ok) {
    if (header[0]?.kind === 'not-a-package') return undefined;
    return { pkg: corrupt(base, file.size, file.lastModified), header: null };
  }
  if (isDownloadInProgress(header, titleId, contentType)) return undefined;
  const svod = header.format.decoded === 'svod';
  return {
    pkg: {
      ...base,
      name: headerName(header) ?? packageName,
      contentId: header.contentId,
      format: header.format.decoded,
      headerFileBytes: file.size,
      dataFilesBytes: svod ? header.dataFilesSize : 0,
      lastModified: file.lastModified,
      corrupt: false,
    },
    header,
  };
}

/** A corrupt package: a header that fails to parse, or a `.data` directory without one (S1.9, S1.10). */
function corrupt(base: Pick<Package, 'location' | 'kind'>, headerFileBytes: number, lastModified: number): Package {
  return {
    ...base,
    name: base.location.packageName,
    contentId: null,
    format: 'unknown',
    headerFileBytes,
    dataFilesBytes: 0,
    lastModified,
    corrupt: true,
  };
}

/** Scans one content type directory's packages (S1.3, S1.4, S1.10). */
async function scanContentType(
  dir: FileSystemDirectoryHandle,
  titleId: string,
  contentType: string,
  onFound: () => void,
): Promise<Found[]> {
  const headers: [string, FileSystemFileHandle][] = [];
  const dataDirectories = new Set<string>();
  for (const [name, entry] of await list(dir)) {
    if (name.startsWith('.')) continue;
    if (entry.kind === 'file' && !name.endsWith('.crswap')) headers.push([name, entry as FileSystemFileHandle]);
    if (entry.kind === 'directory' && name.endsWith('.data')) dataDirectories.add(name.slice(0, -'.data'.length));
  }
  const kind = packageKind(contentType);
  const base = (packageName: string) => ({
    location: { partition: PUBLIC, titleId, contentType, packageName },
    kind,
  });
  const found: Found[] = [];
  for (const [name, handle] of headers) {
    dataDirectories.delete(name);
    const pkg = await readPackage(handle, base(name));
    if (pkg === undefined) continue;
    found.push(pkg);
    onFound();
  }
  for (const name of dataDirectories) {
    found.push({ pkg: corrupt(base(name), 0, 0), header: null });
    onFound();
  }
  return found.sort((a, b) => (a.pkg.location.packageName < b.pkg.location.packageName ? -1 : 1));
}

/** Builds a title from its packages (S1.13-S1.16). */
function buildTitle(titleId: string, found: Found[]): Title {
  const headers = found.flatMap((f) => (f.header === null ? [] : [f.header]));
  const gameHeaders = found.flatMap((f) => (f.header !== null && f.pkg.kind === 'game' ? [f.header] : []));
  const first = <T>(pick: (h: Header) => T | null, from: Header[] = headers): T | null => {
    for (const h of from) {
      const value = pick(h);
      if (value !== null) return value;
    }
    return null;
  };
  const game = gameHeaders[0];
  return {
    titleId,
    name: (game === undefined ? null : headerName(game)) ?? first((h) => h.titleName) ?? 'UNKNOWN',
    publisher: first((h) => h.publisherName, gameHeaders) ?? first((h) => h.publisherName),
    thumbnail:
      first((h) => h.titleThumbnail ?? h.thumbnail, gameHeaders) ?? first((h) => h.titleThumbnail ?? h.thumbnail),
    addedAt: Math.max(...found.map((f) => f.pkg.lastModified)),
    packages: found.map((f) => f.pkg),
  };
}

/**
 * Scans the public partition of a `Content/` tree into titles and their packages
 * (S1). Entries that aren't packages are passed over. Any browser error, while
 * listing or reading, ends the scan with the folder's health (S1.19).
 */
export async function scanContentRoot(
  handle: FileSystemDirectoryHandle,
  options: { onProgress?: (packagesRead: number) => void } = {},
): Promise<[true, Title[]] | [false, FolderHealth]> {
  let count = 0;
  const onFound = () => {
    count++;
    options.onProgress?.(count);
  };
  try {
    const partition = (await list(handle)).find(([name, entry]) => name === PUBLIC && entry.kind === 'directory');
    if (partition === undefined) return [true, []];
    const titles: Title[] = [];
    for (const [titleId, titleDir] of await hexDirectories(partition[1] as FileSystemDirectoryHandle)) {
      const found: Found[] = [];
      for (const [contentType, dir] of await hexDirectories(titleDir)) {
        found.push(...(await scanContentType(dir, titleId, contentType, onFound)));
      }
      if (found.length > 0) titles.push(buildTitle(titleId, found));
    }
    return [true, titles];
  } catch (error) {
    return [false, healthFromError(error)];
  }
}
