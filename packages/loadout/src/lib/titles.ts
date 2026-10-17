// Library views over scanned titles (docs/lib-design.md, T1). Pure functions.

import {
  TITLE_SORTS,
  type AppStatus,
  type Change,
  type ApplyProgress,
  type DriveStatus,
  type DriveSummary,
  type GameType,
  type LibraryTitle,
  type Package,
  type PackageKind,
  type PackageLocation,
  type PackageRow,
  type Title,
  type TitleFilters,
  type TitleSort,
} from './types.js';

const MB = 2 ** 20;
const GB = 2 ** 30;

/** A package's key, unique within a root: `<TitleID>/<ContentType>/<packageName>`. */
export function packageKey(location: PackageLocation): string {
  return `${location.titleId}/${location.contentType}/${location.packageName}`;
}

/** A change's key: its op and its package's key. */
export function changeKey(change: Change): string {
  return `${change.op}|${packageKey(change.location)}`;
}

/** The header file plus the data files (T1.1). */
export function packageBytes(p: Package): number {
  return p.headerFileBytes + p.dataFilesBytes;
}

/** The sum of a title's packages (T1.2). */
export function titleBytes(t: Title): number {
  return t.packages.reduce((sum, p) => sum + packageBytes(p), 0);
}

/** `n MB` below 1 GB, `n.n GB` from there, with no decimal from 100 GB, judged after rounding (T1.3). */
export function formatSize(bytes: number): string {
  const mb = Math.max(1, Math.round(bytes / MB));
  if (mb < 1024) return `${String(mb)} MB`;
  const gb = Math.round((bytes / GB) * 10) / 10;
  return gb >= 100 ? `${String(Math.round(bytes / GB))} GB` : `${gb.toFixed(1)} GB`;
}

const has = (t: Title, kind: PackageKind) => t.packages.some((p) => p.kind === kind);

/** Which kinds of package a title has. Saves count for none (T1.4). */
export function titleFlags(t: Title): {
  playable: boolean;
  hasTitleUpdate: boolean;
  hasDlc: boolean;
  hasOtherContent: boolean;
} {
  return {
    playable: has(t, 'game'),
    hasTitleUpdate: has(t, 'title-update'),
    hasDlc: has(t, 'dlc'),
    hasOtherContent: has(t, 'other'),
  };
}

/** `GOD` when the title has a Games on Demand package (T1.5). */
export function gameType(t: Title): GameType {
  return t.packages.some((p) => p.location.contentType === '00007000') ? 'GOD' : 'Other';
}

/** Keys of the drive packages that count as on the drive: corrupt copies don't (T1.6). */
function soundKeys(driveTitle: Title | undefined): Set<string> {
  return new Set(driveTitle?.packages.filter((p) => !p.corrupt).map((p) => packageKey(p.location)));
}

/** Where a vault title stands relative to the drive; saves don't count (T1.6a). */
export function titleStatus(vaultTitle: Title, driveTitle: Title | undefined, queued: boolean): DriveStatus {
  if (queued) return 'queued';
  const onDrive = soundKeys(driveTitle);
  const packages = vaultTitle.packages.filter((p) => p.kind !== 'save');
  const count = packages.filter((p) => onDrive.has(packageKey(p.location))).length;
  if (count === 0) return 'not-on-drive';
  return count === packages.length ? 'on-drive' : 'partial';
}

const KIND_ORDER: readonly PackageKind[] = ['game', 'title-update', 'dlc', 'other'];

/** Every package of a title in either place, once per key, saves left out (T1.6b). */
export function packageRows(vaultTitle: Title | undefined, driveTitle: Title | undefined): PackageRow[] {
  const rows = new Map<string, PackageRow>();
  const row = (p: Package): PackageRow => {
    const key = packageKey(p.location);
    let found = rows.get(key);
    if (found === undefined) {
      found = { key, vault: undefined, drive: undefined };
      rows.set(key, found);
    }
    return found;
  };
  for (const p of vaultTitle?.packages ?? []) row(p).vault = p;
  for (const p of driveTitle?.packages ?? []) row(p).drive = p;
  const either = (r: PackageRow) => (r.vault ?? r.drive) as Package;
  return [...rows.values()]
    .filter((r) => either(r).kind !== 'save')
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(either(a).kind) - KIND_ORDER.indexOf(either(b).kind) ||
        either(a).name.localeCompare(either(b).name, 'en', { sensitivity: 'base' }) ||
        a.key.localeCompare(b.key),
    );
}

/** An add needs a sound vault copy and nothing at its location on the drive (T1.6c). */
export function canAdd(row: PackageRow): boolean {
  return row.vault !== undefined && !row.vault.corrupt && row.drive === undefined;
}

/** Anything on the drive can be removed (T1.6c). */
export function canRemove(row: PackageRow): boolean {
  return row.drive !== undefined;
}

/** Each vault title with its status and corrupt flag (T1.6d). */
export function libraryTitles(
  vault: readonly Title[],
  drive: readonly Title[],
  queue: readonly Change[],
): LibraryTitle[] {
  const driveById = new Map(drive.map((t) => [t.titleId, t]));
  const queued = new Set(queue.map((c) => c.location.titleId));
  return vault.map((title) => ({
    title,
    status: titleStatus(title, driveById.get(title.titleId), queued.has(title.titleId)),
    corrupt: title.packages.some((p) => p.corrupt),
  }));
}

/** Playable and other title counts, total bytes and one entry per title (T1.6e). */
export function driveSummary(drive: readonly Title[]): DriveSummary {
  const entries = drive.map((t) => ({ titleId: t.titleId, name: t.name, playable: titleFlags(t).playable }));
  const playable = entries.filter((e) => e.playable).length;
  return {
    playable,
    other: entries.length - playable,
    bytes: drive.reduce((sum, t) => sum + titleBytes(t), 0),
    entries,
  };
}

/** Every set filter combines with AND; on-drive includes partial (T1.7). */
export function applyFilters(items: readonly LibraryTitle[], f: TitleFilters = {}): LibraryTitle[] {
  return items.filter(({ title, status }) => {
    const flags = titleFlags(title);
    const want = f.status ?? 'all';
    if (want !== 'all' && status !== want && !(want === 'on-drive' && status === 'partial')) return false;
    if (f.gameType !== undefined && gameType(title) !== f.gameType) return false;
    if (f.hasTitleUpdate === true && !flags.hasTitleUpdate) return false;
    if (f.hasDlc === true && !flags.hasDlc) return false;
    if (f.hasOtherContent === true && !flags.hasOtherContent) return false;
    return true;
  });
}

const byName = (a: Title, b: Title) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/** Sorts a copy; ties fall back to name (T1.8). */
export function sortTitles(items: readonly LibraryTitle[], sort: TitleSort = 'name'): LibraryTitle[] {
  const size = (x: LibraryTitle) => titleBytes(x.title);
  const compare: Record<TitleSort, (a: LibraryTitle, b: LibraryTitle) => number> = {
    name: () => 0,
    'size-desc': (a, b) => size(b) - size(a),
    'size-asc': (a, b) => size(a) - size(b),
    'added-desc': (a, b) => b.title.addedAt - a.title.addedAt,
    'added-asc': (a, b) => a.title.addedAt - b.title.addedAt,
  };
  return [...items].sort((a, b) => compare[sort](a, b) || byName(a.title, b.title));
}

/** What the Library calls each sort. */
export const SORT_LABELS: Readonly<Record<TitleSort, string>> = {
  name: 'Alphabetical',
  'size-desc': 'Size: largest first',
  'size-asc': 'Size: smallest first',
  'added-desc': 'Date added: newest first',
  'added-asc': 'Date added: oldest first',
};

function listJoin(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
}

/** A sentence describing an empty result (T1.9). */
export function describeEmpty(f: TitleFilters = {}): string {
  const status = f.status ?? 'all';
  const prefix = status === 'queued' ? 'queued ' : '';
  const noun =
    f.gameType === 'GOD'
      ? 'Games on Demand titles'
      : f.gameType === 'Other'
        ? 'titles other than Games on Demand'
        : 'titles';
  const where = status === 'on-drive' ? ' on the drive' : status === 'not-on-drive' ? ' that are not on the drive' : '';
  const kinds: string[] = [];
  if (f.hasTitleUpdate === true) kinds.push('title updates');
  if (f.hasDlc === true) kinds.push('DLC');
  if (f.hasOtherContent === true) kinds.push('other content');
  const withPart = kinds.length > 0 ? ` with ${listJoin(kinds)}` : '';
  if (prefix === '' && noun === 'titles' && where === '' && withPart === '') return 'There are no titles to show.';
  return `There are no ${prefix}${noun}${withPart}${where}.`;
}

/** The Library URL for a set of filters and a sort (T1.10). */
export function libraryUrl(f: TitleFilters = {}, sort: TitleSort = 'name'): string {
  const q = new URLSearchParams();
  if (f.status !== undefined && f.status !== 'all') q.set('status', f.status);
  if (f.gameType !== undefined) q.set('type', f.gameType === 'GOD' ? 'god' : 'other');
  if (f.hasTitleUpdate === true) q.set('tu', '1');
  if (f.hasDlc === true) q.set('dlc', '1');
  if (f.hasOtherContent === true) q.set('other', '1');
  if (sort !== 'name') q.set('sort', sort);
  const s = q.toString();
  return s === '' ? '/library' : `/library?${s}`;
}

/** Reads filters and a sort back from a Library URL, ignoring unknown values (T1.10). */
export function parseLibraryUrl(url: string): { filters: TitleFilters; sort: TitleSort } {
  const q = new URL(url, 'https://loadout.invalid').searchParams;
  const filters: TitleFilters = {};
  const status = q.get('status');
  if (status === 'on-drive' || status === 'not-on-drive' || status === 'queued') filters.status = status;
  const type = q.get('type');
  if (type === 'god') filters.gameType = 'GOD';
  if (type === 'other') filters.gameType = 'Other';
  if (q.get('tu') === '1') filters.hasTitleUpdate = true;
  if (q.get('dlc') === '1') filters.hasDlc = true;
  if (q.get('other') === '1') filters.hasOtherContent = true;
  const sort = TITLE_SORTS.find((s) => s === q.get('sort')) ?? 'name';
  return { filters, sort };
}

/** The header's one status, highest priority first (T1.11). */
export function resolveAppStatus(input: {
  errorCount: number;
  vaultReady: boolean;
  driveReady: boolean;
  copying: ApplyProgress | null;
  queuedCount: number;
}): AppStatus {
  if (input.errorCount > 0) return 'error';
  if (!input.vaultReady) return 'no-vault';
  if (!input.driveReady) return 'no-drive';
  if (input.copying !== null) return 'copying';
  if (input.queuedCount > 0) return 'ready';
  return 'ok';
}

/** Up to 8 titles matching a name substring or Title ID prefix; name prefixes first (T1.12). */
export function searchTitles(titles: readonly Title[], query: string): Title[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  const startsWith = (t: Title) => t.name.toLowerCase().startsWith(q);
  return titles
    .filter((t) => t.name.toLowerCase().includes(q) || t.titleId.toLowerCase().startsWith(q))
    .sort((a, b) => Number(startsWith(b)) - Number(startsWith(a)) || byName(a, b))
    .slice(0, 8);
}

/** A deterministic set of colours for a title's generated cover (T1.13). */
export function coverPalette(titleId: string): { c1: string; c2: string; c3: string; c4: string; angle: string } {
  let h = 0;
  for (const ch of titleId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return {
    c1: `hsl(${String(hue)} 42% 26%)`,
    c2: `hsl(${String((hue + 35) % 360)} 65% 42%)`,
    c3: `hsl(${String((hue + 190) % 360)} 55% 38% / .7)`,
    c4: `hsl(${String((hue + 320) % 360)} 45% 9%)`,
    angle: `${String((h % 4) * 30 + 105)}deg`,
  };
}
