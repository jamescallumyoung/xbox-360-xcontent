# Loadout: feature spec

Status: **v4, the first real version.** v3 described the clickable proof of concept (POC) on branch `feature/session_context_for_loader`. v4 folds in the decisions of 2026-10-17: the app is built on `xcontent-header` and `xcontent-fs-web`, some POC features are out of scope, and the hash check is replaced by a content ID check. Open items are marked **❓**.

## Tech stack

- The package **`packages/loadout`** in the `xbox360-content-utils` monorepo. The app and the package are both called **Loadout**.
- Lit 3, TypeScript, esbuild and pnpm. **No component library:** Loadout's own components are used throughout.
- All file work goes through **`xcontent-fs-web`**, and all header parsing through **`xcontent-header`**. What those packages don't cover is in Loadout's own `src/lib/` (§12).
- Chromium-based browsers only, because only they let a page pick a real folder and write to it (`xcontent-fs-web` README).

## Domain model

| Term               | Meaning                                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**          | A game, app or other bundle of Xbox 360 content, identified by a **Title ID**.                                                                                                     |
| **Package**        | One XContent package inside a title: a header file, plus a `<name>.data/` folder for SVOD packages. Each package has exactly one Content Type, and several packages may share one. |
| **Content Type**   | One of a known, finite list, each with a numeric ID. Packages live in a folder named for the ID as 8 hex digits (`00007000`).                                                      |
| **Partition**      | A 16-hex-digit folder directly under a partition root: `0000000000000000` (public) or a profile ID.                                                                                |
| **Partition root** | A folder that contains **only** partitions. Usually named `Content`, but that isn't required.                                                                                      |
| **Vault**          | A read-only partition root holding backups.                                                                                                                                        |
| **Drive**          | A writable partition root on the external drive.                                                                                                                                   |
| **Change**         | One queued action on one package: **add** (vault to drive) or **remove** (from the drive).                                                                                         |

Path: `<partition root>/<partition>/<TitleID>/<ContentType>/<package header>`, plus `<package header>.data/` for SVOD.

**Scope.** Loadout manages **only the public partition** (`0000000000000000`) in this version. Profile partitions are ignored.

## 1. Welcome and setup

1. On load, a near-full-page **Welcome modal** opens. It can't be dismissed.
2. It shows a short welcome message and two **Folder Pickers**, Vault and Drive, each with a hint.
3. **Vault**
   - Picked with `showDirectoryPicker({ mode: 'read' })`.
   - Valid when it's a partition root: at least one partition, and nothing else.
4. **Drive**
   - Picked with `showDirectoryPicker({ mode: 'readwrite' })`.
   - Valid when it's empty, or a partition root under the same rule.
5. In both, macOS AppleDouble files (`._<name>`) are tolerated: macOS writes one beside every folder it creates on a FAT32 drive.
6. Picking the same folder for both is rejected. The picker checks this with `handle.isSameEntry(other)`, never by name.
7. **Continue** is enabled when both are valid. Clicking it scans both and opens Discover.

**Persistence.**

| Event                                                                                                    | Result                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Normal reload (Cmd+R, F5, the reload button)                                                             | State restored. The welcome modal shows **Reconnect**, one click, because the browser must re-grant folder access. |
| **Hard refresh** (Cmd+Shift+R, Ctrl+Shift+R, Shift-click reload, DevTools "Empty cache and hard reload") | Fresh start, the same as a first visit.                                                                            |
| Opening Loadout in a new tab                                                                             | Fresh start. Other tabs keep their own state.                                                                      |
| Reset in Settings, or the sidebar **x**                                                                  | Fresh start.                                                                                                       |

**How**

- The queue and the folder handles are stored in **IndexedDB**, one record per tab. A tab ID in `sessionStorage` tells a reload (ID present) from a new tab (no ID). Reopening a closed tab, or restoring tabs after a browser restart, brings its state back too, because the browser restores its `sessionStorage`. Records not saved for 7 days are deleted. If IndexedDB can't be used, as in some private windows, Loadout still works, but nothing survives a reload.
- **Detecting a hard refresh.** A minimal **service worker** does nothing except claim its clients: `skipWaiting()` on install, `clients.claim()` on activate, and no fetch handler. Browsers bypass service workers on a force refresh, so afterwards `navigator.serviceWorker.controller` is `null`. On start-up, an **active** registration with an **uncontrolled** page means a hard refresh, and the session is cleared.
- **Backup:** a `keydown` listener for Cmd/Ctrl + Shift + R sets a "fresh start" flag in `sessionStorage` just before the reload, for the rare case where the service worker hasn't activated yet.
- **Not used:** the Navigation Timing `type`, which reports `reload` for both kinds of refresh.
- The service worker exists **only** for this detection. It caches nothing (Q22, decided 2026-10-17).

## 2. Navigation

- **Sidebar** (desktop only)
  - Logo and "Loadout" at the top.
  - Then **Discover, Library, Queue** (with the queued count), **Drive** and **Settings**.
  - **Vault and drive status indicators** at the bottom: Connected, Disconnected or Error (§7b). Hovering either shows an **x**, which opens the reset dialog (§9).
- **Tab bar** (mobile only): the same five pages. It doesn't show the vault and drive status, and that's accepted.
- **Header**
  - Search and the status indicator.
  - Search results appear in a dropdown under the search box. Clicking one opens that title's Manage page.
  - Search covers **vault titles only**.
- **URLs.** Each page has a hash URL, such as `#/library?dlc=1&sort=added-desc` or `#/title/4D5307E6`, kept in the address bar as you move around. Each page change, title opened and Library filter change adds a history entry, so Back and Forward move through them without leaving Loadout. Editing the URL opens that page. After a reload, the page in the URL opens once Reconnect is done.

## 3. Discover page

- Drive Widget, mini mode.
- **Queue section**: a Discover Section of titles with queued changes, plus an **Apply N changes** button. Its "See all" opens the Queue page.
- **Recently added to the vault**: a Discover Section sorted by date added, newest first.

## 4. Library page

- Filter and sort controls above the Title Grid:
  - status
  - type
  - has title updates, has DLC, has other content
  - five sorts: alphabetical, size (both directions), date added (both directions)
- Its URL carries its filters and sort, the same as the "See all" links.
- Shows **vault titles only**.
- The **"Has saves" filter is removed** in this version (Q24, decided 2026-10-17): saves live in profile partitions, which Loadout doesn't manage, so it could never match.

## 5. Drive page

- Drive Widget, full mode, with the file tree.
- A Title Grid of the vault's titles that are on the drive.

## 6. Manage Title page (not in the sidebar)

Clicking any Game Tile opens it, and so does a search result.

**Shows**

- Art: the header thumbnail as a crisp icon on generated art.
- Name, publisher and **Title ID**.
- The title's packages, grouped:
  - **Game or app**, and its type (GOD or Other).
  - **Title updates**, listing each one. Older ones are kept: there's no "remove old TUs" prompt.
  - **DLC**, listing each one.
  - **Other content**, with its Content Type name.
- **Saves are not shown.**
- For each package:
  - its size: the header file's size for STFS, and the header plus the data files' size from the header for SVOD
  - where it is: vault only, drive only, or both
  - a **Corrupt** marker (see below)

**Corrupt marker (lightweight).** A package is marked corrupt when its header can't be read, or `parseHeader` fails on it. A fuller check, such as the SVOD completeness rules of spec §7.3, will replace it later.

**Queue adds.** Select any package that's in the vault, isn't corrupt there, and has nothing at its location on the drive.

**Queue removals.** Select any package that's on the drive.

- A **blocking warning modal** opens unless the same package is in the vault **and** the two headers have the same **content ID**.
- The modal says the content isn't in the vault, or differs from the vault copy, so removing it can't be undone.
- You must click through to queue the removal.

> **The content ID check is a weaker stand-in for a planned feature.** The POC compared packages by fast hash (size plus the last 4 KB of every file, X4). That is out of scope for this version. The content ID is a SHA-1 of the header (spec §6.3), and both headers are already parsed by the scan, so it costs nothing extra. For an STFS package it should mean the same contents (spec §7.5, 🔶). For an SVOD package it covers only the header and the first data file's first hash table, so damaged or missing data files go unnoticed. A corrupt package on either side always gets the warning.

**Not in this version:** the "Check vault and drive match" button, the Match and Mismatch capsules, and **Replace from vault** (S2), which only appeared after a mismatch.

## 7. Queue page: grouped list

Git-like: one card per title, with its changes listed underneath.

- **`+` rows** (green) for adds and **`-` rows** (red) for removals. Each shows the package name, its Content Type and its size.
- Each row has an undo control that takes it out of the queue.
- A sticky summary bar at the bottom shows:
  - **+X GB to copy, -Y GB to remove**
  - **Apply N changes**
- **Apply**
  - Runs every removal first, then every add.
  - A removal runs `clean` then `deletePackage`. An add runs `copyTo`, which also cleans macOS's AppleDouble files from the copy.
  - Shows progress for each row and overall, and a **Stop** button that stops after the current change.
  - On the **first error, everything stops.** The error is shown in place and on the header indicator, and changes that weren't applied stay in the queue.
- When everything has applied, the queue empties, the drive is rescanned and the **Apply summary** dialog opens (§7a).
- When you stop an apply part-way, the **Apply summary** dialog opens too, marked as stopped, listing only the changes that were applied. A notice says how many were applied, and stays for 15 seconds.
- When an apply fails, the error banner shows. There's no dialog.

**Recovering from a failed add.** When a copy fails part-way, Loadout removes what it wrote, if the drive is still there. If it isn't, the leftover (an empty header file, or a `.data/` folder without its header) shows after the next scan as a **corrupt** package on the drive. A corrupt drive copy doesn't count as on the drive, and the package can't be added while it's there. The user removes it (the warning shows, since it's corrupt) and applies, then adds the package again. The failed add stays in the queue meanwhile; applying it before the leftover is removed fails with "already on the drive".

## 7a. Apply summary dialog

**When stopped.** If you stop an apply part-way, the dialog is headed "Apply stopped", and its header warns that you stopped the queue but some changes were applied (or none, if none were). The footer says how many are still in the queue. The report records it (`stopped: true`).

**Shows**

- When complete, "All changes applied", with the change count, the drive's name, how long it took, and a reminder to eject the drive safely.
- Three figures: size copied (and count), size removed (and count), and number of titles.
- Every change grouped by title, with git-style `+` and `-` lines and sizes.
- **Done** closes it. Escape closes it too.

**Keep a record: the JSON report** (`lib/report.ts`, format `loadout.apply-report`, version 1)

- The file is named `loadout-report-YYYY-MM-DD-HHMM.json`, in local time.
- Contents: when it was applied and how long it took, the vault and drive **folder names**, a summary of counts and bytes, and every change in the order applied, with its path inside the partition root.
- **Download JSON** saves to the downloads folder.
- **Save to drive...** opens the browser's save dialog on the drive. It **refuses a location inside the drive's partition root**, removes any empty file Chromium created there, and asks for another place. The file handle is never stored, so permission is one-off.
- A preview of the JSON is available in the dialog.

**What the browser reveals about the folders.** Only a folder handle's own name (`FileSystemHandle.name`). The UI never shows paths: folders appear as **"Directory name: <name>"**, and the Drive Widget's heading is simply **"Drive"**.

## 7b. Vault and drive status

| State            | When                                                                                      | Shown                                             |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Connected**    | Permission granted and the folder can be read                                             | Green dot                                         |
| **Disconnected** | Reading the folder gives `NotFoundError`, typically because the drive was unplugged       | Amber pulsing dot, plus "Plug the drive back in." |
| **Error**        | Any other failure: permission withdrawn, unreadable media, `InvalidStateError`, and so on | Red dot, plus a plain-language message            |

- **Checking:** the store re-checks both folders every 5 seconds and whenever the tab becomes visible again, using `checkFolder` in `lib/folder-health.ts`, which is built on `openContentRoot`. It's paused while applying.
- **Reconnect after a reload** asks for permission on both folders in one click. If a folder isn't granted, is missing, or is no longer a partition root, the Reconnect screen says which, and the user clicks again or starts over.
- ❓ **Reconnecting a re-plugged drive:** whether its handle works again in Chrome is untested. James will test it. If it does, the next check flips the state back to Connected. If it doesn't, the user resets and picks the folder again.
- **Elsewhere:**
  - The **header** shows "Vault disconnected" or "Drive disconnected". Folder errors count towards the header's error count.
  - The **Drive Widget's** status icon turns amber or red, with a message. **Rescan** is disabled.
  - **Apply** is disabled on Discover and the Queue page, with the reason shown.
  - A folder that disconnects **during an apply** makes the change in progress fail, which stops the apply. Folder checks pause during an apply, and run again when it ends.

## 8. Drive space

- The browser can't read a drive's capacity or free space, so neither is shown.
- The Drive Widget's bar is a **proportion bar** of two segments, **Titles** and **Queued**.

## 9. Settings and reset

- Settings has **Re-select vault and drive**, and **Show notifications**, which lists every notification shown in this tab, newest first. The list isn't cleared by a reset, but a reload or a new tab starts it afresh.
- It opens a confirmation dialog with a prominent warning that the queue will be cleared.
- Confirming clears all app state and the stored session, and shows the welcome modal.
- The sidebar's **x** on the vault or drive opens the same dialog.

## 10. Deferred, to add later

- **Release dates** and the two release-date sorts. They need a data source.
- **Title names from a table.** Titles whose headers carry no name show **UNKNOWN** for now. A table of retail Title IDs needs decisions that are out of scope.
- **Real cover art.** It will replace the header thumbnail.
- **Bulk actions**, which replace the "Queue all missing" idea (S5).
- **Error handling during apply** beyond stop-on-first-error.
- **Fast-hash compare (X4)**: the Manage page's match check, Match and Mismatch capsules, Replace from vault (S2), and a stronger removal safety check.
- **A fuller corrupt check**, using spec §7.3.
- **Removing other leftovers**, such as `BACKUP/` folders, from Loadout.
- **S6 and S7** on the Manage page: space impact per title, and a header inspector link.
- **Profile partitions**, including saves and the "Has saves" filter.
- **Drive-only titles** in the Library and search. Until then, a title that is only on the drive can't be opened, so its packages can't be removed from Loadout.
- **"Other" usage** in the Drive Widget's bar.
- **Clicking the header's status indicator**, and which header errors exist.

## 11. Component changes from the POC

| Component       | Change                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| Library Filters | No "Has saves" chip.                                                         |
| Manage page     | No hash check, no Match and Mismatch capsules, no Replace from vault.        |
| Folder Picker   | Calls `showDirectoryPicker` and checks `isSameEntry`; no sample-folder menu. |
| Apply Summary   | Calls the real save dialog; no sample-location list.                         |
| Settings        | No demo panel.                                                               |

## 12. What does the file and header work

| #   | Need                                 | Where                                                                                                                                                               |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1  | Copy SVOD `.data/` folders           | `xcontent-fs-web` `copyTo`                                                                                                                                          |
| X2  | Scan a tree into titles and packages | Loadout `lib/scan.ts`                                                                                                                                               |
| X3  | Copy and remove one package          | `xcontent-fs-web` `copyTo`, `clean`, `deletePackage`                                                                                                                |
| X4  | Compare packages by fast hash        | **Deferred.** The removal check uses content IDs instead (§6).                                                                                                      |
| X5  | Check a folder is a partition root   | Loadout `lib/partition-root.ts`                                                                                                                                     |
| X6  | Parse the content ID                 | `xcontent-header` `parseHeader`                                                                                                                                     |
| -   | Read and parse headers               | `xcontent-header` `parseHeader`, on bytes the scan reads from the header files it finds (one read per package, rather than a second walk through `readHeaderBytes`) |
| -   | Folder status                        | Loadout `lib/folder-health.ts`, on `xcontent-fs-web` `openContentRoot`                                                                                              |
