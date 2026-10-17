// Loadout's domain types. See docs/features.md ("Domain model") and docs/lib-design.md.

import type { PackageLocation } from 'xcontent-fs-web';

export type { PackageLocation };

/** What a package holds, from its content type (CT1.3). */
export type PackageKind = 'game' | 'title-update' | 'dlc' | 'save' | 'other';

/** The package format its header declares; `unknown` when it can't be read. */
export type PackageFormat = 'stfs' | 'svod' | 'unknown';

/** One package found by a scan (S1). */
export interface Package {
  location: PackageLocation;
  kind: PackageKind;
  /** The English display name, else the title name, else the file name (S1.8). */
  name: string;
  /** The header's content ID, 40 hex digits; `null` when the package is corrupt. */
  contentId: string | null;
  format: PackageFormat;
  /** The header file's size. 0 for a `.data/` folder without its header. */
  headerFileBytes: number;
  /** The combined size of an SVOD package's data files, from its header. 0 for STFS. */
  dataFilesBytes: number;
  /** The header file's last-modified time, in milliseconds since the epoch. */
  lastModified: number;
  /** Lightweight corrupt marker (S1.9, S1.10). */
  corrupt: boolean;
}

/** A title found by a scan: its packages under one Title ID directory (S1.12). */
export interface Title {
  titleId: string;
  /** From the headers, or `UNKNOWN` (S1.13). */
  name: string;
  publisher: string | null;
  /** PNG bytes from a header (S1.15). */
  thumbnail: Uint8Array | null;
  /** The newest last-modified time of its packages (S1.16). */
  addedAt: number;
  packages: Package[];
}

/** "GOD" when the title has a Games on Demand package (T1.5). */
export type GameType = 'GOD' | 'Other';

/** Where a vault title stands relative to the drive (T1.6a). */
export type DriveStatus = 'not-on-drive' | 'on-drive' | 'partial' | 'queued';

/** A vault title with its drive status: what the Title Grid and Game Tile show (T1.6d). */
export interface LibraryTitle {
  title: Title;
  status: DriveStatus;
  /** True when any of the title's vault packages is corrupt. */
  corrupt: boolean;
}

/** One package of a title, in either place (T1.6b). */
export interface PackageRow {
  key: string;
  vault: Package | undefined;
  drive: Package | undefined;
}

export type StatusFilter = 'all' | 'on-drive' | 'not-on-drive' | 'queued';

export interface TitleFilters {
  status?: StatusFilter;
  gameType?: GameType;
  hasTitleUpdate?: boolean;
  hasDlc?: boolean;
  hasOtherContent?: boolean;
}

/** Every sort, in the order the Library offers them. */
export const TITLE_SORTS = ['name', 'size-desc', 'size-asc', 'added-desc', 'added-asc'] as const;

export type TitleSort = (typeof TITLE_SORTS)[number];

/** What the Drive Widget shows about the drive (T1.6e). */
export interface DriveSummary {
  playable: number;
  other: number;
  bytes: number;
  entries: { titleId: string; name: string; playable: boolean }[];
}

/** Whether a chosen folder can be used right now (F1). */
export type FolderState = 'connected' | 'disconnected' | 'error';

/** `disconnected` and `error` always carry a plain-language message. */
export type FolderHealth = { state: 'connected' } | { state: 'disconnected' | 'error'; message: string };

/** The header's one status (T1.11). */
export type AppStatus = 'error' | 'no-vault' | 'no-drive' | 'copying' | 'ready' | 'ok';

/** How far an apply has got (A1.7). */
export interface ApplyProgress {
  /** The change in progress. */
  change: Change;
  /** The index of the change in progress, in apply order. */
  index: number;
  /** The number of changes being applied. */
  total: number;
  /** 0 to 1, within the change in progress. */
  changeFraction: number;
  /** 0 to 1, across the whole apply. */
  fraction: number;
}

export type ChangeOp = 'add' | 'remove';

/** One queued action on one package. */
export interface Change {
  op: ChangeOp;
  location: PackageLocation;
}

/** Whether a removal needs the warning (R1). */
export type RemovalRisk = 'none' | 'not-in-vault' | 'mismatch';
