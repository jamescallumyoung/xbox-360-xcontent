// The store: the app's single state object (docs/lib-design.md, ST1). It holds
// all state, exposes actions, and emits `change` after each one. Components only
// read it and call its actions. It never imports Lit, so it runs in Node tests.

import type { ContentRoot } from 'xcontent-fs-web';
import { applyOrder, runApply } from '../lib/apply.js';
import { checkFolder, openFolder } from '../lib/folder-health.js';
import { describeFailure } from '../lib/messages.js';
import { checkPartitionRoot, type PartitionRootCheck } from '../lib/partition-root.js';
import { removalRisk } from '../lib/removal-check.js';
import { buildApplyReport, reportChange, reportFileName, type ApplyReport, type ReportChange } from '../lib/report.js';
import { downloadReport, saveReportToDrive, type SaveFilePicker } from '../lib/report-files.js';
import { scanContentRoot } from '../lib/scan.js';
import type { Session } from '../lib/session.js';
import {
  canAdd,
  canRemove,
  changeKey,
  driveSummary,
  libraryTitles,
  packageBytes,
  packageKey,
  packageRows,
  parseLibraryUrl,
  resolveAppStatus,
} from '../lib/titles.js';
import type {
  AppStatus,
  ApplyProgress,
  Change,
  ChangeOp,
  DriveSummary,
  FolderHealth,
  LibraryTitle,
  Package,
  PackageLocation,
  PackageRow,
  Title,
  TitleFilters,
  TitleSort,
} from '../lib/types.js';

export type Role = 'vault' | 'drive';
export type Phase = 'starting' | 'welcome' | 'reconnect' | 'ready';
export type Page = 'discover' | 'library' | 'queue' | 'drive' | 'settings' | 'manage';

/** One side of setup: the folder picked, and whether it can be used. */
export interface FolderSelection {
  handle: FileSystemDirectoryHandle;
  /** The folder's own name: all the browser reveals. */
  name: string;
  status: 'checking' | 'valid' | 'invalid';
  message: string;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'info' | 'bad';
}

export interface ApplyState {
  startedAt: Date;
  /** The changes being applied, in the order they run (A1.1): what the queue page's rows follow. */
  order: Change[];
  progress: ApplyProgress | null;
  stopping: boolean;
  /** Set when the apply ended with a failure, until the error is dismissed. */
  failed?: { change: Change; message: string };
}

/** A removal waiting for the user to confirm the warning (ST1.8). */
export interface PendingRemoval {
  location: PackageLocation;
  risk: 'not-in-vault' | 'mismatch';
}

export type ReportSaveState =
  | { state: 'idle' }
  | { state: 'downloaded'; fileName: string }
  | { state: 'saved'; fileName: string }
  | { state: 'refused' };

export interface StoreOptions {
  /** How often to check both folders while ready; `null` never polls. Default 5 seconds. */
  pollMs?: number | null;
  /** How long a toast shows. Default 3.8 seconds. */
  toastMs?: number;
}

/** A health's message; a connected folder has none. */
const messageOf = (health: FolderHealth): string => ('message' in health ? health.message : '');

function describeCheck(role: Role, check: PartitionRootCheck): Pick<FolderSelection, 'status' | 'message'> {
  if (check.valid) {
    if (check.partitions === 0) return { status: 'valid', message: 'Empty folder. Titles will be copied here.' };
    const s = check.partitions === 1 ? '' : 's';
    return { status: 'valid', message: `Partition root with ${String(check.partitions)} partition${s}.` };
  }
  switch (check.reason) {
    case 'empty':
      return { status: 'invalid', message: `This folder is empty. The ${role} needs at least one partition.` };
    case 'is-partition':
      return {
        status: 'invalid',
        message: 'This is a partition, not a partition root. Choose the folder that contains it.',
      };
    case 'contains-content':
      return { status: 'invalid', message: 'This folder holds a Content folder. Choose that folder instead.' };
    case 'not-root':
      return {
        status: 'invalid',
        message: `This folder holds things that aren't partitions (${check.names.join(', ')}). Choose the Content folder inside it.`,
      };
  }
}

export class LoadoutStore extends EventTarget {
  phase: Phase = 'starting';
  vault: FolderSelection | null = null;
  drive: FolderSelection | null = null;
  vaultHealth: FolderHealth = { state: 'connected' };
  driveHealth: FolderHealth = { state: 'connected' };
  vaultTitles: Title[] = [];
  driveTitles: Title[] = [];
  scanning = false;

  page: Page = 'discover';
  titleId: string | null = null;
  libraryFilters: TitleFilters = {};
  librarySort: TitleSort = 'name';
  query = '';

  queue: Change[] = [];
  apply: ApplyState | null = null;
  errors: string[] = [];
  toasts: Toast[] = [];
  pendingRemoval: PendingRemoval | null = null;
  confirmingReset = false;
  /** The report of the last successful apply; set while the summary dialog is open. */
  report: ApplyReport | null = null;
  reportSave: ReportSaveState = { state: 'idle' };

  private readonly pollMs: number | null;
  private readonly toastMs: number;
  private session: Session | null = null;
  private roots: { vault: ContentRoot; drive: ContentRoot } | null = null;
  private returnTo: Page = 'discover';
  private picks = { vault: 0, drive: 0 };
  private applying = false;
  private checking = false;
  /** Bumped by `reset()`: an async action that finds it changed drops its result (ST1.24). */
  private epoch = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly toastTimers = new Set<ReturnType<typeof setTimeout>>();
  private toastId = 0;

  constructor(options: StoreOptions = {}) {
    super();
    this.pollMs = options.pollMs === undefined ? 5000 : options.pollMs;
    this.toastMs = options.toastMs ?? 3800;
  }

  private emit(): void {
    this.dispatchEvent(new Event('change'));
  }

  // ---------- start-up and setup ----------

  /** Restores the tab's session: Reconnect when one was saved, else welcome (ST1.21). */
  async start(session: Session): Promise<void> {
    this.session = session;
    const saved = await session.load();
    if (saved === null) {
      this.phase = 'welcome';
    } else {
      const selection = (handle: FileSystemDirectoryHandle): FolderSelection => ({
        handle,
        name: handle.name,
        status: 'valid',
        message: '',
      });
      this.vault = selection(saved.vault);
      this.drive = selection(saved.drive);
      this.queue = saved.queue;
      this.phase = 'reconnect';
    }
    this.emit();
  }

  /** Checks a picked folder; a newer pick of the same side wins (ST1.1, ST1.2). */
  async pick(role: Role, handle: FileSystemDirectoryHandle): Promise<void> {
    if (this.scanning) return;
    const pick = ++this.picks[role];
    this.setSelection(role, { handle, name: handle.name, status: 'checking', message: 'Checking folder...' });
    this.emit();
    const selection = await this.check(role, handle);
    if (pick !== this.picks[role]) return;
    this.setSelection(role, selection);
    this.emit();
  }

  private async check(role: Role, handle: FileSystemDirectoryHandle): Promise<FolderSelection> {
    const [ok, result] = await checkPartitionRoot(handle, { allowEmpty: role === 'drive' });
    const outcome = ok ? describeCheck(role, result) : { status: 'invalid' as const, message: messageOf(result) };
    return { handle, name: handle.name, ...outcome };
  }

  private setSelection(role: Role, selection: FolderSelection | null): void {
    if (role === 'vault') this.vault = selection;
    else this.drive = selection;
  }

  get canContinue(): boolean {
    return this.vault?.status === 'valid' && this.drive?.status === 'valid';
  }

  /** Opens and scans both folders, then shows Discover (ST1.4, ST1.5). */
  async continue(): Promise<void> {
    if (this.phase !== 'welcome' || this.scanning || !this.canContinue) return;
    await this.enter(false);
  }

  /** After a reload: re-checks both saved folders, then continues with the saved queue (ST1.22). */
  async reconnect(): Promise<void> {
    const { vault, drive, epoch } = this;
    if (this.phase !== 'reconnect' || this.scanning || vault === null || drive === null) return;
    this.vault = { ...vault, status: 'checking', message: 'Checking folder...' };
    this.drive = { ...drive, status: 'checking', message: 'Checking folder...' };
    this.emit();
    const [v, d] = await Promise.all([this.check('vault', vault.handle), this.check('drive', drive.handle)]);
    if (epoch !== this.epoch) return;
    this.vault = v;
    this.drive = d;
    this.emit();
    if (this.canContinue) await this.enter(true);
  }

  private async enter(keepQueue: boolean): Promise<void> {
    const { vault, drive, epoch } = this;
    if (vault === null || drive === null) return;
    this.scanning = true;
    this.emit();
    const fail = (role: Role, health: FolderHealth): void => {
      const selection = role === 'vault' ? vault : drive;
      this.setSelection(role, { ...selection, status: 'invalid', message: messageOf(health) });
      this.scanning = false;
      this.emit();
    };
    const [[vaultOpened, vaultRoot], [driveOpened, driveRoot]] = await Promise.all([
      openFolder(vault.handle, 'read'),
      openFolder(drive.handle, 'readwrite'),
    ]);
    if (epoch !== this.epoch) return;
    if (!vaultOpened) {
      fail('vault', vaultRoot);
      return;
    }
    if (!driveOpened) {
      fail('drive', driveRoot);
      return;
    }
    const [[vaultScanned, vaultTitles], [driveScanned, driveTitles]] = await Promise.all([
      scanContentRoot(vault.handle),
      scanContentRoot(drive.handle),
    ]);
    if (epoch !== this.epoch) return;
    if (!vaultScanned) {
      fail('vault', vaultTitles);
      return;
    }
    if (!driveScanned) {
      fail('drive', driveTitles);
      return;
    }

    this.roots = { vault: vaultRoot, drive: driveRoot };
    this.vaultTitles = vaultTitles;
    this.driveTitles = driveTitles;
    this.vaultHealth = { state: 'connected' };
    this.driveHealth = { state: 'connected' };
    this.phase = 'ready';
    this.page = 'discover';
    this.scanning = false;
    if (keepQueue) this.pruneQueue();
    else this.queue = [];
    this.save();
    this.startPolling();
    this.emit();
  }

  /** Drops queued changes that no longer apply, with a toast saying how many (ST1.22a). */
  private pruneQueue(): void {
    const kept = this.queue.filter((change) => this.stillApplies(change));
    const dropped = this.queue.length - kept.length;
    if (dropped === 0) return;
    this.queue = kept;
    this.save();
    const s = dropped === 1 ? ' no longer applies, and was' : 's no longer apply, and were';
    this.toast(`${String(dropped)} queued change${s} dropped.`, 'info');
  }

  private stillApplies(change: Change): boolean {
    const row = this.row(change.location);
    return change.op === 'add' ? canAdd(row) : canRemove(row);
  }

  // ---------- folder status ----------

  /**
   * Checks both folders, emitting only when a state changes; skipped while
   * applying, or while a check is running (ST1.18, ST1.19). A folder that comes
   * back is rescanned (ST1.25).
   */
  async checkFolders(): Promise<void> {
    const { vault, drive, epoch } = this;
    if (this.applying || this.checking || this.phase !== 'ready' || vault === null || drive === null) return;
    this.checking = true;
    const [vaultHealth, driveHealth] = await Promise.all([
      checkFolder(vault.handle, 'read'),
      checkFolder(drive.handle, 'readwrite'),
    ]);
    this.checking = false;
    // An apply may have started during the check (TypeScript can't see that across the await).
    if (epoch !== this.epoch || this.isApplying()) return;
    const back = (before: FolderHealth, after: FolderHealth) =>
      before.state !== 'connected' && after.state === 'connected';
    const rescan = { vault: back(this.vaultHealth, vaultHealth), drive: back(this.driveHealth, driveHealth) };
    if (JSON.stringify([vaultHealth, driveHealth]) === JSON.stringify([this.vaultHealth, this.driveHealth])) return;
    this.vaultHealth = vaultHealth;
    this.driveHealth = driveHealth;
    this.emit();
    if (rescan.vault) await this.rescanSide('vault');
    if (rescan.drive) await this.rescanSide('drive');
    if (rescan.vault || rescan.drive) {
      this.pruneQueue();
      this.emit();
    }
  }

  private isApplying(): boolean {
    return this.applying;
  }

  private startPolling(): void {
    this.stopPolling();
    if (this.pollMs !== null) this.timer = setInterval(() => void this.checkFolders(), this.pollMs);
  }

  private stopPolling(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Scans the drive again; a failure keeps the previous scan (ST1.23). */
  async rescan(): Promise<void> {
    if (this.applying || this.scanning || this.phase !== 'ready') return;
    this.scanning = true;
    this.emit();
    await this.rescanSide('drive');
    this.scanning = false;
    this.emit();
  }

  /** Scans one side, setting its titles and health; a failure keeps the previous scan. */
  private async rescanSide(role: Role): Promise<void> {
    const selection = role === 'vault' ? this.vault : this.drive;
    if (selection === null) return;
    const { epoch } = this;
    const [ok, result] = await scanContentRoot(selection.handle);
    if (epoch !== this.epoch) return;
    if (role === 'vault') {
      if (ok) this.vaultTitles = result;
      this.vaultHealth = ok ? { state: 'connected' } : result;
    } else {
      if (ok) this.driveTitles = result;
      this.driveHealth = ok ? { state: 'connected' } : result;
    }
  }

  // ---------- navigation ----------

  navigate(page: Page): void {
    this.page = page;
    if (page !== 'manage') this.titleId = null;
    this.emit();
  }

  openTitle(titleId: string): void {
    if (this.page !== 'manage') this.returnTo = this.page;
    this.titleId = titleId;
    this.page = 'manage';
    this.query = '';
    this.emit();
  }

  back(): void {
    this.navigate(this.returnTo);
  }

  /** Follows a Discover Section's "See all" link (`features.md` §3). */
  seeAll(url: string): void {
    if (url.startsWith('/queue')) {
      this.navigate('queue');
      return;
    }
    const { filters, sort } = parseLibraryUrl(url);
    this.libraryFilters = filters;
    this.librarySort = sort;
    this.navigate('library');
  }

  setLibrary(filters: TitleFilters, sort: TitleSort): void {
    this.libraryFilters = filters;
    this.librarySort = sort;
    this.emit();
  }

  setQuery(query: string): void {
    this.query = query;
    this.emit();
  }

  // ---------- derived ----------

  /** Vault titles with their drive status: what the Library shows (T1.6d). */
  get library(): LibraryTitle[] {
    return libraryTitles(this.vaultTitles, this.driveTitles, this.queue);
  }

  vaultTitle(titleId: string): Title | undefined {
    return this.vaultTitles.find((t) => t.titleId === titleId);
  }

  driveTitle(titleId: string): Title | undefined {
    return this.driveTitles.find((t) => t.titleId === titleId);
  }

  /** A title's packages in either place: what the Manage page lists (T1.6b). */
  rows(titleId: string): PackageRow[] {
    return packageRows(this.vaultTitle(titleId), this.driveTitle(titleId));
  }

  private row(location: PackageLocation): PackageRow {
    const key = packageKey(location);
    const find = (title: Title | undefined) => title?.packages.find((p) => packageKey(p.location) === key);
    return {
      key,
      vault: find(this.vaultTitle(location.titleId)),
      drive: find(this.driveTitle(location.titleId)),
    };
  }

  titleName(titleId: string): string {
    return this.vaultTitle(titleId)?.name ?? this.driveTitle(titleId)?.name ?? 'UNKNOWN';
  }

  /** The package a change acts on: the vault's for an add, the drive's for a removal. */
  packageFor(change: Change): Package | undefined {
    const row = this.row(change.location);
    return change.op === 'add' ? row.vault : row.drive;
  }

  queuedOp(location: PackageLocation): ChangeOp | undefined {
    const key = packageKey(location);
    return this.queue.find((c) => packageKey(c.location) === key)?.op;
  }

  get driveSummary(): DriveSummary {
    return driveSummary(this.driveTitles);
  }

  private queuedBytes(op: ChangeOp): number {
    return this.queue
      .filter((c) => c.op === op)
      .reduce((sum, c) => {
        const p = this.packageFor(c);
        return sum + (p === undefined ? 0 : packageBytes(p));
      }, 0);
  }

  /** The bytes queued to copy (ST1.12). */
  get queuedAddBytes(): number {
    return this.queuedBytes('add');
  }

  /** The bytes queued to remove (ST1.12). */
  get queuedRemoveBytes(): number {
    return this.queuedBytes('remove');
  }

  get queuedTitleCount(): number {
    return new Set(this.queue.map((c) => c.location.titleId)).size;
  }

  /** Why Apply can't run, or `null` (ST1.17). */
  get applyBlocked(): string | null {
    for (const [role, health] of [
      ['vault', this.vaultHealth],
      ['drive', this.driveHealth],
    ] as const) {
      if (health.state === 'disconnected') return `The ${role} is disconnected.`;
      if (health.state === 'error') return `The ${role} is reporting an error.`;
    }
    return null;
  }

  /** Apply errors plus folder errors: what the header counts. */
  get errorCount(): number {
    return this.errors.length + [this.vaultHealth, this.driveHealth].filter((h) => h.state === 'error').length;
  }

  /** The header's one status (T1.11). */
  get status(): AppStatus {
    return resolveAppStatus({
      errorCount: this.errorCount,
      vaultReady: this.vaultHealth.state !== 'disconnected',
      driveReady: this.driveHealth.state !== 'disconnected',
      copying: this.applying ? (this.apply?.progress ?? null) : null,
      queuedCount: this.queuedTitleCount,
    });
  }

  // ---------- queueing ----------

  private setQueue(queue: Change[]): void {
    this.queue = queue;
    this.save();
    this.emit();
  }

  private save(): void {
    const { session, vault, drive } = this;
    if (session === null || vault === null || drive === null) return;
    void session.save({ vault: vault.handle, drive: drive.handle, queue: this.queue });
  }

  private queueChange(change: Change): void {
    const key = changeKey(change);
    this.setQueue([...this.queue.filter((c) => changeKey(c) !== key), change]);
  }

  undo(change: Change): void {
    if (this.applying) return;
    const key = changeKey(change);
    this.setQueue(this.queue.filter((c) => changeKey(c) !== key));
  }

  /** Queues an add if the package can be added, or removes a queued one (ST1.6). */
  toggleAdd(location: PackageLocation): void {
    if (this.applying) return;
    const change: Change = { op: 'add', location };
    if (this.queuedOp(location) === 'add') this.undo(change);
    else if (canAdd(this.row(location))) this.queueChange(change);
  }

  /** Queues a removal, or asks first when the vault can't restore it (ST1.8). */
  requestRemove(location: PackageLocation): void {
    if (this.applying) return;
    const change: Change = { op: 'remove', location };
    if (this.queuedOp(location) === 'remove') {
      this.undo(change);
      return;
    }
    const row = this.row(location);
    if (row.drive === undefined) return;
    const risk = removalRisk(row.vault, row.drive);
    if (risk === 'none') {
      this.queueChange(change);
    } else {
      this.pendingRemoval = { location, risk };
      this.emit();
    }
  }

  confirmPendingRemoval(): void {
    const pending = this.pendingRemoval;
    if (pending === null || this.applying) return;
    this.pendingRemoval = null;
    this.queueChange({ op: 'remove', location: pending.location });
  }

  cancelPendingRemoval(): void {
    this.pendingRemoval = null;
    this.emit();
  }

  // ---------- applying ----------

  /** Applies the queue: removals, then adds (ST1.13-ST1.16). */
  async startApply(): Promise<void> {
    const { roots } = this;
    if (roots === null || this.applying || this.scanning || this.applyBlocked !== null || this.queue.length === 0) {
      return;
    }
    const changes = [...this.queue];
    const startedAt = new Date();
    // A removed package is gone from the next scan, so keep each one now (A1.10).
    const known = new Map(
      changes.map((c) => [changeKey(c), { pkg: this.packageFor(c), titleName: this.titleName(c.location.titleId) }]),
    );
    this.applying = true;
    this.errors = [];
    this.apply = { startedAt, order: applyOrder(changes), progress: null, stopping: false };
    this.page = 'queue';
    this.emit();

    const result = await runApply(changes, {
      vault: roots.vault,
      drive: roots.drive,
      bytesOf: (c) => {
        const p = known.get(changeKey(c))?.pkg;
        return p === undefined ? 0 : packageBytes(p);
      },
      shouldStop: () => this.apply?.stopping === true,
      onProgress: (progress) => {
        if (this.apply !== null) this.apply = { ...this.apply, progress };
        this.emit();
      },
    });

    const finishedAt = new Date();
    this.applying = false;
    const applied = new Set(result.applied.map(changeKey));
    this.queue = this.queue.filter((c) => !applied.has(changeKey(c)));
    this.save();
    const log: ReportChange[] = result.applied.flatMap((c) => {
      const entry = known.get(changeKey(c));
      return entry?.pkg === undefined ? [] : [reportChange(c.op, entry.titleName, entry.pkg)];
    });
    await this.rescanSide('drive');
    const apply = this.apply;

    if (result.failed !== undefined) {
      const { change, reasons } = result.failed;
      const name = known.get(changeKey(change))?.pkg?.name ?? change.location.packageName;
      const message = `Couldn't ${change.op === 'add' ? 'copy' : 'remove'} ${name}. ${describeFailure(change.op, reasons)}`;
      this.errors = [message];
      this.apply = { ...apply, failed: { change, message } };
      this.emit();
      await this.checkFolders();
    } else if (result.stopped) {
      this.apply = null;
      this.toast(`Stopped. Applied ${String(result.applied.length)} of ${String(changes.length)} changes.`, 'ok');
    } else {
      this.apply = null;
      this.report = buildApplyReport({
        changes: log,
        startedAt,
        finishedAt,
        vaultFolderName: this.vault?.name ?? '',
        driveFolderName: this.drive?.name ?? '',
      });
      this.reportSave = { state: 'idle' };
      this.emit();
    }
  }

  /** Stops after the current change (ST1.15). */
  stopApply(): void {
    if (this.apply === null || !this.applying) return;
    this.apply = { ...this.apply, stopping: true };
    this.emit();
  }

  /** Clears an apply failure (ST1.16). */
  dismissError(): void {
    if (this.applying) return;
    this.apply = null;
    this.errors = [];
    this.emit();
  }

  // ---------- reset ----------

  requestReset(): void {
    if (this.applying) return;
    this.confirmingReset = true;
    this.emit();
  }

  cancelReset(): void {
    this.confirmingReset = false;
    this.emit();
  }

  /** Clears all state and the session, and shows the welcome screen (ST1.20). */
  async reset(): Promise<void> {
    if (this.applying) return;
    this.epoch++;
    this.stopPolling();
    for (const timer of this.toastTimers) clearTimeout(timer);
    this.toastTimers.clear();
    this.returnTo = 'discover';
    this.checking = false;
    this.picks = { vault: this.picks.vault + 1, drive: this.picks.drive + 1 };
    Object.assign(this, {
      phase: 'welcome',
      vault: null,
      drive: null,
      vaultHealth: { state: 'connected' },
      driveHealth: { state: 'connected' },
      vaultTitles: [],
      driveTitles: [],
      scanning: false,
      page: 'discover',
      titleId: null,
      libraryFilters: {},
      librarySort: 'name',
      query: '',
      queue: [],
      apply: null,
      errors: [],
      toasts: [],
      pendingRemoval: null,
      confirmingReset: false,
      report: null,
      reportSave: { state: 'idle' },
      roots: null,
    });
    await this.session?.clear();
    this.emit();
  }

  // ---------- the report ----------

  closeReport(): void {
    this.report = null;
    this.emit();
  }

  downloadReport(): void {
    if (this.report === null) return;
    downloadReport(this.report);
    this.reportSave = { state: 'downloaded', fileName: reportFileName(this.report) };
    this.emit();
  }

  async saveReportToDrive(picker: SaveFilePicker): Promise<void> {
    if (this.report === null || this.drive === null) return;
    const result = await saveReportToDrive(this.report, this.drive.handle, picker);
    if (result.status === 'saved') this.reportSave = { state: 'saved', fileName: result.fileName };
    if (result.status === 'inside-partition-root') this.reportSave = { state: 'refused' };
    this.emit();
  }

  // ---------- toasts ----------

  toast(text: string, tone: Toast['tone'] = 'ok'): void {
    const toast = { id: ++this.toastId, text, tone };
    this.toasts = [...this.toasts, toast];
    this.emit();
    const timer = setTimeout(() => {
      this.toastTimers.delete(timer);
      this.toasts = this.toasts.filter((t) => t.id !== toast.id);
      this.emit();
    }, this.toastMs);
    this.toastTimers.add(timer);
  }
}
