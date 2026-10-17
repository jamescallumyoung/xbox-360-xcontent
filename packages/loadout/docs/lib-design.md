# Loadout: `src/lib/` and store design

This document states what each module in `src/lib/`, and the store, must do, as numbered statements. Tests cite them (for example `S1.4`), and code documentation references them. The feature spec is `features.md`; the format reference is `docs/xcontent-specification.md` at the repo root (cited as "spec §n").

Conventions, shared by every module:

- **Results.** A function that can fail returns `[true, value]` or `[false, reason]`, like `xcontent-fs-web` and `xcontent-header`. Expected failures never throw.
- **Sizes are bytes,** as `number`. Times are milliseconds since the epoch.
- **Only the public partition** (`0000000000000000`) is read or written.
- **`PackageLocation`** is `xcontent-fs-web`'s type. A package's **key** is `<TitleID>/<ContentType>/<packageName>`, unique within a root.

---

## CT1 `content-types.ts`: content type names and kinds

- **CT1.1** `contentTypeName(id)` returns the name spec §4.2 gives for an 8-hex-digit content type ID, such as `GameOnDemand` for `00007000`.
- **CT1.2** An ID not in spec §4.2 gives `Unknown (<ID>)`.
- **CT1.3** `packageKind(id)` returns `game` for `00007000`, `00004000`, `000D0000`, `00005000`, `00080000`, `02000000` and `00001000`, `title-update` for `000B0000`, `dlc` for `00000002`, `save` for `00000001`, and `other` for every other ID.

## P1 `partition-root.ts`: is a folder a partition root? (X5)

`checkPartitionRoot(handle, { allowEmpty })` lists the folder once. It returns `[true, { valid: true, partitions }]`, `[true, { valid: false, reason, names }]`, or `[false, health]` when the folder can't be read. The rules apply in this order, and the first that matches decides.

- **P1.1** Hidden entries, whose names start with `.`, are ignored by every rule below. macOS writes `._<name>` beside each folder it creates on a FAT32 drive, and `.DS_Store` in folders Finder opens.
- **P1.2** A folder whose own name is 16 hex digits is invalid with reason `is-partition`: the user chose a partition, not the folder that contains it.
- **P1.3** An empty folder is valid with `allowEmpty` (`partitions: 0`), and invalid with reason `empty` without it.
- **P1.4** A folder holding a directory named `Content` (any case) is invalid with reason `contains-content`: the user chose the folder above the partition root.
- **P1.5** A folder holding any entry that isn't a directory named with 16 hex digits (either case) is invalid with reason `not-root`, and `names` lists those entries, sorted.
- **P1.6** Otherwise it is valid, and `partitions` counts them. `names` is empty except for `not-root`.
- **P1.7** When listing fails, it returns `[false, health]`, with the folder health of F1.2 to F1.4.

## F1 `folder-health.ts`: can a folder be used right now?

`checkFolder(handle, mode)` calls `xcontent-fs-web`'s `openContentRoot(handle, { mode })`.

- **F1.1** When it opens, the folder is `connected`.
- **F1.2** An `io-error` whose error name is `NotFoundError` means the folder is gone, typically because the drive was unplugged: `disconnected`.
- **F1.3** `permission-denied` is `error`, with the message "Loadout no longer has permission to use this folder."
- **F1.4** Any other failure is `error`, with a plain-language message: `NotReadableError` says the drive may be faulty or in use, `InvalidStateError` says the folder changed while being read, and anything else gives the browser's message.
- **F1.5** `healthFromError(error)` applies F1.2 to F1.4 to a caught exception, for code that reads the folder itself.

## S1 `scan.ts`: the per-package scan (X2)

`scanContentRoot(handle, { onProgress })` walks `0000000000000000/<TitleID>/<ContentType>/` and returns `[true, titles]`, or `[false, health]`. Entries that aren't packages are passed over silently: Loadout doesn't show them in this version.

**Walking**

- **S1.1** It reads only the public partition. Other entries in the root are not read. A root without the public partition gives no titles.
- **S1.2** Title ID and content type directories must be named with 8 **uppercase** hex digits (`xcontent-fs-web` locations reject lowercase). Any other entry at those levels is passed over.
- **S1.3** In a content type directory, each file is a package's header, except hidden files (names starting with `.`, such as `._<name>` and `.DS_Store`) and Chromium swap files (names ending in `.crswap`), which are passed over.
- **S1.4** A directory named `<name>.data` belongs to the package `<name>`, and isn't listed on its own. Any other directory is passed over (such as `BACKUP/`, spec §4.8).
- **S1.5** The Title ID and content type of a package come from its directories, not its header (spec §7.2).

**Reading each package**

- **S1.6** For each header file it calls `getFile()` once, records the file's `size` as `headerFileBytes` and its `lastModified`, and parses the first `0xB000` bytes with `xcontent-header`'s `parseHeader`. (It reads the file it has already found, rather than walking again through `readHeaderBytes`.)
- **S1.7** From the parsed header it records `contentId`, `format` (`stfs`, `svod` or `unknown`), and, for SVOD, `dataFilesBytes` from the header's combined data size. For STFS, `dataFilesBytes` is 0.
- **S1.8** A package's `name` is its English display name, else the header's title name, else its file name.
- **S1.9** **Corrupt (lightweight).** A package whose header fails `parseHeader`, or can't be read for any reason but those in S1.19, is kept, marked `corrupt`, with `contentId` `null`, `format` `unknown` and `dataFilesBytes` 0. Its name is its file name.
- **S1.10** A `<name>.data` directory without a header file `<name>` is kept as a package `<name>`, marked `corrupt`, with `headerFileBytes` 0 and `lastModified` 0. This lists the leftovers of an interrupted copy so they can be removed.
- **S1.11** **A download in progress** (spec §4.4, §7.2) is passed over, along with its `.data` directory: a `CON` package whose header says Title ID `FFFE07D1` and content type `000B0000`, in any other directory than `FFFE07D1/000B0000/`.

**Titles**

- **S1.12** Packages are grouped into titles by their Title ID directory. A Title ID directory with no packages gives no title.
- **S1.13** A title's `name` is the first of these that isn't empty: the English display name of a `game` package's header, then that header's title name, then any package header's title name, in package order. Otherwise it is `UNKNOWN`.
- **S1.14** A title's `publisher` is a `game` package header's publisher name, else any package header's, else `null`.
- **S1.15** A title's `thumbnail` is the bytes of a `game` package's title thumbnail, else its thumbnail, else any package's title thumbnail or thumbnail, else `null`.
- **S1.16** A title's `addedAt` is the newest `lastModified` among its packages.
- **S1.17** Titles are sorted by Title ID, and each title's packages by content type, then name.

**Progress, abort and failure**

- **S1.18** `onProgress` is called after each package, with the number of packages read so far.
- **S1.19** When the browser throws while listing a directory, or throws `NotFoundError` or `InvalidStateError` while reading a header (the drive was pulled), the scan stops and returns `[false, health]`, with the health of F1.5.

## T1 `titles.ts`: library views (from the POC)

- **T1.0** `packageKey(location)` is `<TitleID>/<ContentType>/<packageName>`, and `changeKey(change)` is `<op>|<packageKey>`.
- **T1.1** `packageBytes(p)` is `headerFileBytes + dataFilesBytes`.
- **T1.2** `titleBytes(t)` is the sum of its packages' bytes.
- **T1.3** `formatSize(bytes)` gives `n MB` (at least 1) below 1 GB, and `n.n GB` from there, with no decimal from 100 GB. The unit and the decimal are chosen after rounding, so a size just under 1 GB shows `1.0 GB`, not `1024 MB`. As in the POC, 1 MB is 2^20 bytes and 1 GB is 2^30.
- **T1.4** `titleFlags(t)` says whether a title has a `game`, `title-update`, `dlc` or `other` package. `save` packages count for none of them.
- **T1.5** `gameType(t)` is `GOD` when the title has a `00007000` package, and `Other` otherwise.
- **T1.6** A vault package **is on the drive** when the drive has a package with the same key that isn't corrupt. A corrupt drive copy doesn't count: it's a broken copy to remove.
- **T1.6a** `titleStatus(vaultTitle, driveTitle, queued)` is `queued` when the title has queued changes, else `on-drive` when every one of its vault packages is on the drive, `partial` when some are, and `not-on-drive` when none are. Saves don't count: Loadout never copies them.
- **T1.6b** `packageRows(vaultTitle, driveTitle)` lists every package of the title in either place, once per key, with `vault` and `drive` (each the package or `undefined`), sorted by kind (game, title update, DLC, other), then name. `save` packages are left out.
- **T1.6c** `canAdd(row)` is true when the vault has the package, it isn't corrupt, and the drive has nothing at its key, corrupt or not. `canRemove(row)` is true when the drive has it.
- **T1.6d** `libraryTitles(vault, drive, queue)` gives each vault title with its status, and `corrupt` when any of its vault packages is.
- **T1.6e** `driveSummary(drive)` gives the drive's playable title count (titles with a `game` package), other title count, total bytes, and one entry per title (Title ID, name, playable).
- **T1.7** `applyFilters(items, filters)` combines every set filter with AND. Status `on-drive` also matches `partial`. Unset filters match everything. There is no saves filter. `hasOtherContent` matches `other` packages only.
- **T1.8** `sortTitles(items, sort)` sorts a copy by name (case-insensitive), size in both directions, or `addedAt` in both directions. Ties fall back to name.
- **T1.9** `describeEmpty(filters)` gives a sentence describing the filters, as in the POC.
- **T1.10** `libraryUrl(filters, sort)` and `parseLibraryUrl(url)` round-trip every filter and sort. A "has" flag is set only by the value `1`. Unknown values are ignored.
- **T1.11** `resolveAppStatus(...)` gives one status with the priority error, vault disconnected, drive disconnected, copying, ready, OK.
- **T1.12** `searchTitles(titles, query)` matches a case-insensitive substring of the name, or a Title ID prefix. Names that start with the query come first, then the rest by name. It returns at most 8. An empty or blank query returns none.
- **T1.13** `coverPalette(titleId)` is deterministic, as in the POC.

## R1 `removal-check.ts`: may a removal be queued silently?

`removalRisk(vaultPackage, drivePackage)` compares the vault's package at the same location (or `undefined`) with the drive's.

- **R1.1** No vault package gives `not-in-vault`.
- **R1.2** Either package corrupt, or a missing content ID, gives `mismatch`.
- **R1.3** Different content IDs give `mismatch`.
- **R1.4** Otherwise it gives `none`, and the removal is queued without a warning.
- **R1.5** This is a **weaker stand-in for the fast-hash check (X4)**. Equal content IDs show the headers match, but not the SVOD data files (spec §7.5). The code's documentation says so.

## M1 `messages.ts`: failure reasons in plain language

`describeFailure(op, reasons)` turns `xcontent-fs-web` failure reasons into one sentence for the UI. A reason's root is its `root` field for an add (`source` is the vault, `target` the drive), and always the drive for a removal.

- **M1.1** `target-exists`: the package is already on the drive; remove it first.
- **M1.2** `io-error` with `NotFoundError` or `InvalidStateError`: the vault or drive (from the reason's `root`, when given) was disconnected.
- **M1.3** `permission-denied`: Loadout lost permission to use the vault or drive.
- **M1.4** `not-found` or `orphaned-data`: the package has changed on that root since the last scan; rescan.
- **M1.4a** `wrong-case`: a folder on that root has the same name in different letter case, giving the name found.
- **M1.4b** `junk`: the package has leftover files Loadout can't remove.
- **M1.5** `name-too-long`: the package's name is too long for the browser to write.
- **M1.6** `io-error` with any other error name gives the root and the browser's message, or the error's name when the message is empty. Any other reason gives a generic sentence naming its `kind`.
- **M1.7** Only the first reason is described.

## A1 `apply.ts`: running the queue

`runApply(changes, { vault, drive, bytesOf, shouldStop, onProgress })` takes opened roots. There's no abort: Stop takes effect between changes.

- **A1.1** It runs every removal first, then every add, each group in queue order.
- **A1.2** A removal runs `clean(drive, location)`, then `drive.deletePackage(location)`.
- **A1.3** An add runs `vault.copyTo(drive, location)`, which cleans its own output.
- **A1.4** After each change, `shouldStop()` is checked. If it returns `true` and changes remain, the run ends with `stopped: true`.
- **A1.5** On the first failure, the run ends. The result names the failed change and its reasons, and no later change is attempted.
- **A1.6** The result lists the applied changes in order.
- **A1.7** `onProgress` reports the current change's index, the fraction of it done, and the overall fraction. An add weighs its `bytesOf` value, and a removal weighs 1 MiB. The current change's fraction comes from `copyTo`'s bytes or `deletePackage`'s files.
- **A1.8** An empty queue returns at once, with nothing applied.
- **A1.9** **A failed add cleans up after itself** when its first reason is an `io-error` on the target during `create`, `write`, `close` or `verify-size`. `copyTo` does those only after checking the target was free, so everything at the location was written by this copy. It runs `clean`, then `deletePackage`, ignoring their results: if the drive is gone, the next scan lists the leftover as corrupt (S1.9, S1.10). Any other failure leaves the drive alone.

## RP1 `report.ts`: the apply report (from the POC)

- **RP1.1** `reportChange(op, titleName, package)` records the op, the Title ID from the package's location, title name, the package's name, content type ID and name, file name, SVOD flag and bytes, and its path `0000000000000000/<TitleID>/<ContentType>/<file>`.
- **RP1.2** `buildApplyReport(...)` has format `loadout.apply-report`, version 1, the finish time as ISO text, the duration in whole seconds (never negative), the two folder names, and counts and bytes of adds and removals, and of distinct titles.
- **RP1.3** `reportFileName(report)` is `loadout-report-YYYY-MM-DD-HHMM.json`, in local time.

## RF1 `report-files.ts`: getting the report out (from the POC)

- **RF1.1** `saveReportToDrive(report, driveHandle, picker)` opens the save dialog starting at the drive, with the report's file name.
- **RF1.2** A cancelled dialog returns `cancelled`.
- **RF1.3** A file inside the drive's partition root (`driveHandle.resolve(file)` isn't `null`) isn't written: the empty file the browser made is removed if it can be, and it returns `inside-partition-root`.
- **RF1.4** Otherwise it writes the report's JSON and returns `saved` with the file's name.
- **RF1.5** `downloadReport(report)` downloads it through a temporary link. It isn't unit-tested.

## SE1 `session.ts`: surviving a reload

The session holds the vault and drive handles and the queue, in one record. Storage is injected: `tab` is `sessionStorage`-like, and `db` is a small async key-value store (IndexedDB in the app). The record lives under one fixed key, so nothing is left behind when a tab closes. A tab marker in `tab` tells a reload from a new tab.

- **SE1.1** `isHardRefresh({ registered, controlled, flaggedAt, now })` is true when a service worker registration is active but the page isn't controlled, or when the Cmd/Ctrl+Shift+R flag was set less than 5 seconds ago. An older flag is ignored, so a cancelled reload doesn't wipe a later one.
- **SE1.2** `openSession(tab, db, { fresh })` deletes the stored record when `fresh` is set or the tab has no marker (a new tab), then sets the marker and clears the flag.
- **SE1.3** `load()` returns the saved vault, drive and queue, or `null`.
- **SE1.4** `save(state)` stores them.
- **SE1.5** `clear()` deletes them.
- **SE1.6** A duplicated tab shares the record with the tab it came from. That's accepted: two tabs writing one drive isn't supported.

## ST1 `app/store.ts`: the store

The store is the app's single state object. It holds all state, exposes actions, and emits `change` after each one. Components only read it and call its actions. It uses `src/lib/` directly. Only the session and the folder-poll interval are injected.

**Setup**

- **ST1.1** `pick(role, handle)` sets that side to `checking`, then checks it with P1 (`allowEmpty` for the drive only), and sets `valid` or `invalid` with a message.
- **ST1.2** A result for a pick that has since been replaced is ignored.
- **ST1.3** `canContinue` is true only when both sides are valid.
- **ST1.4** `continue()` opens both roots (`read` for the vault, `readwrite` for the drive), scans both, saves the session and shows Discover. While scanning, `scanning` is set.
- **ST1.5** A failed open or scan leaves the welcome screen up, with the side's error.

**Queue**

- **ST1.6** `toggleAdd(location)` queues an add when T1.6c's `canAdd` allows it, or removes a queued one.
- **ST1.7** A change for the same op and location is never queued twice.
- **ST1.8** `requestRemove(location)` does nothing unless `canRemove` allows it. It uses R1: with `none` it queues the removal; otherwise it sets `pendingRemoval` with the risk. A queued removal is removed instead.
- **ST1.9** `confirmPendingRemoval()` queues it; `cancelPendingRemoval()` drops it.
- **ST1.10** `undo(change)` removes one change.
- **ST1.11** Every queue change is saved to the session.
- **ST1.12** `queuedAddBytes` and `queuedRemoveBytes` add up the queued packages' bytes.

**Applying**

- **ST1.13** `startApply()` does nothing while `applyBlocked` is set, while an apply runs, or with an empty queue.
- **ST1.14** On success, the queue is emptied, the drive is rescanned (ST1.23), and `report` is set.
- **ST1.15** `stopApply()` makes the run stop after the current change. The applied changes leave the queue; the rest stay. The drive is rescanned. No report is set; a toast says how many were applied.
- **ST1.16** On failure, the applied changes leave the queue, the rest stay, and `errors` holds the M1 sentence. The drive is rescanned, and both folders' health is checked.
- **ST1.17** `applyBlocked` gives the reason when the vault or drive isn't connected.

**Folder status**

- **ST1.18** While ready, the store checks both folders with F1 every poll interval, and whenever `checkFolders()` is called (on tab visibility). It emits `change` only when a state changes.
- **ST1.19** Polling is skipped while an apply runs.

**Reset and reload**

- **ST1.20** `reset()` clears all state and the session, and shows the welcome screen.
- **ST1.21** `restore()` loads the session. With saved handles it shows the Reconnect screen; otherwise the welcome screen.
- **ST1.22** `reconnect()` runs after the component has asked for permission on both handles. Each side is checked with P1, like a pick (ST1.1). A side that isn't usable (permission not granted, folder missing, or no longer a partition root) shows its problem, and the Reconnect screen stays, so the user can click again or start over.
- **ST1.22a** When both sides are usable, it continues as ST1.4, keeping the saved queue except changes that no longer apply: an add the vault no longer has, or whose package is now on the drive, and a removal the drive no longer has. A toast says how many were dropped.
- **ST1.23** `rescan()` scans the drive again. It does nothing while applying or scanning. If it fails, the drive's health is set from the failure, and the previous scan is kept.
