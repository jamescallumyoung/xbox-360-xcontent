// Builders for packages in a test drive's tree. Packages are synthetic: no
// function in this package reads a header's contents, so any bytes will do.

import { DIR, type TreeSpec } from './tree.js';

/** Where a package sits: the directories above it (spec §1, §7.1). */
export interface PackageAt {
  partition: string;
  titleId: string;
  contentType: string;
}

/** The public partition, *Halo 3*'s Title ID, and Games on Demand. */
export const DEFAULT_AT: PackageAt = {
  partition: '0000000000000000',
  titleId: '4D5307E6',
  contentType: '00007000',
};

/** The size of an SVOD header file (spec §3.2). */
export const SVOD_HEADER_SIZE = 0xb000;

/** The path of a content-type directory, such as `0000000000000000/4D5307E6/00007000`. */
export function contentTypePath(at: PackageAt = DEFAULT_AT): string {
  return `${at.partition}/${at.titleId}/${at.contentType}`;
}

/** The path of an entry in a content-type directory. */
export function packagePath(name: string, at: PackageAt = DEFAULT_AT): string {
  return `${contentTypePath(at)}/${name}`;
}

/** A package's location, in the shape the package's functions take. */
export function locationOf(packageName: string, at: PackageAt = DEFAULT_AT): PackageAt & { packageName: string } {
  return { ...at, packageName };
}

/** `Data0000`, `Data0001` and so on (spec §6.7). */
export function dataFileName(index: number): string {
  return `Data${String(index).padStart(4, '0')}`;
}

/** Each data file's size: small, and different for every index. */
export function dataFileSize(index: number): number {
  return 1024 + index * 16;
}

interface PackageOptions {
  at?: PackageAt;
  /** The header file's size. */
  headerSize?: number;
}

interface DataOptions {
  at?: PackageAt;
  /**
   * Which data files exist: a count (`Data0000` up to one less than it), or a list
   * of indices, to leave gaps. Default 3. With 0 or `[]`, `name.data/` is empty.
   */
  dataFiles?: number | readonly number[];
}

/** An STFS package: one file. Also an orphan SVOD header (spec §7.3). Default size 0x2000. */
export function stfsPackage(name: string, options: PackageOptions = {}): TreeSpec {
  return { [packagePath(name, options.at)]: options.headerSize ?? 0x2000 };
}

/** An SVOD header with no `.data/` directory (spec §7.3). */
export function headerOnly(name: string, options: PackageOptions = {}): TreeSpec {
  return { [packagePath(name, options.at)]: options.headerSize ?? SVOD_HEADER_SIZE };
}

/** A `name.data/` directory with no header (spec §7.3). */
export function dataOnly(name: string, options: DataOptions = {}): TreeSpec {
  const dir = packagePath(`${name}.data`, options.at);
  const wanted = options.dataFiles ?? 3;
  const indices = typeof wanted === 'number' ? Array.from({ length: wanted }, (_, i) => i) : wanted;
  if (indices.length === 0) return { [dir]: DIR };
  return Object.fromEntries(indices.map((index) => [`${dir}/${dataFileName(index)}`, dataFileSize(index)]));
}

/** An SVOD package: a header plus `name.data/` with its data files (spec §3.2). */
export function svodPackage(name: string, options: PackageOptions & DataOptions = {}): TreeSpec {
  return { ...headerOnly(name, options), ...dataOnly(name, options) };
}
