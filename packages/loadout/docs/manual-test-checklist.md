# Loadout: manual test checklist

What the automated tests can't cover: the browser's folder and save dialogs, permission prompts, real drives, reloads and deployment. Run it in Chrome, with `pnpm dev` (http://localhost:3000) or the deployed site.

**Folders to use**

- **Vault:** the gitignored `fixtures/` folder's `Content/` (real, anonymised packages), or a copy of part of a real vault.
- **Drive:** first an empty scratch folder on the Mac's own disk (APFS), then the same on a FAT32 USB drive, as in the `xcontent-fs-web` design record, section 2.5.

## 1. Setup

- [x] The welcome screen shows; Continue is disabled.
- [x] Choosing the vault's parent folder (the one holding `Content`) is refused: "This folder holds a Content folder. Choose that folder instead."
- [x] Choosing a partition (`0000000000000000`) says it's a partition, not a partition root.
- [x] Choosing the same folder for both is refused, and Continue stays disabled.
- [x] An empty drive folder says "Empty folder. Titles will be copied here."
- [x] The vault picker asks for read access only; the drive picker asks to save changes.
- [ ] A FAT32 drive folder with macOS `._` files beside its partitions still counts as valid.
- [x] Continue scans both and opens Discover. The drive widget counts match the drive.

## 2. Browsing

- [x] Discover's "Recently added" shows vault titles, newest first. Thumbnails appear.
- [ ] Library filters and sorts work, and "See all" links open the Library with the same filters.
- [ ] "See all" from "Recently added": the address bar shows `#/library?sort=added-desc`, and the sort dropdown reads "Date added: newest first".
- [ ] Moving between pages, opening a title and changing Library filters each update the address bar (`#/discover`, `#/title/<TitleID>`, `#/library?...`).
- [ ] Back and Forward step through those pages and filter changes, staying in Loadout.
- [ ] Editing the hash in the address bar opens that page, such as `#/queue`.
- [ ] Cmd+click on "See all" opens the Library in a new tab (which starts at the welcome screen, then opens the Library after setup).
- [x] Search finds titles by name and by Title ID; Enter opens the first.
- [x] A title without a name in its headers shows `UNKNOWN`.
- [x] Phone width (Chrome's device toolbar): the tab bar replaces the sidebar, and nothing scrolls sideways.

## 3. Queue and apply

- [x] On a title, Add queues a package; the tile and header show it queued.
- [x] Remove on a package the vault has, unchanged: queued with no warning.
- [ ] Remove on a package that's on the drive but not in the vault (under a title the vault has): the "can't be restored" warning shows; Keep it cancels.
- [x] Undo on a queued row takes it out; the bar shows the right +/- totals.
- [ ] A "Corrupt in vault" package has no Add button.
- [x] Apply runs removals, then copies, with per-row and overall progress.
- [ ] An SVOD (Games on Demand) copy has its `.data` folder with every `Data####` file, the same sizes as the vault.
- [ ] On FAT32, no `._` AppleDouble files are left beside the copy.
- [x] The summary dialog opens; Download JSON saves the report; the JSON preview shows; Escape and Done close it.
- [x] Save to drive... refuses anywhere inside the drive's `Content` folder, subfolders too ("Loadout can't save inside the drive's partition folder"), and leaves no empty file there; saving at the drive's top level works.
- [ ] Stop, with several changes queued, stops after the current change; the rest stay queued.
- [ ] After Stop, the summary dialog opens headed "Apply stopped". Its header warns "You stopped the queue, but some changes were applied", it lists only the applied changes, and its footer says how many are still queued.
- [ ] After Stop, the toast "Stopped. Applied X of N changes." shows above the dialog and stays about 15 seconds.
- [ ] Settings' "Show notifications" lists past notifications, newest first, with their times; Escape and Close shut it.

## 4. Failures

- [ ] Pull the USB drive during a copy: the apply stops with "The drive was disconnected", the sidebar shows Disconnected, and Apply is disabled.
- [ ] Plug it back in (re-plugging is untested so far): does the drive show Connected again within about 5 seconds, without picking it again? Note what happens.
- [ ] With the drive unplugged, the header shows "Drive disconnected" and Rescan is disabled.
- [ ] Revoke the drive's permission in Chrome's site settings: the sidebar shows Error, and Apply is disabled with "The drive is reporting an error." on Discover and the Queue page.
- [ ] Switching away from the tab and back re-checks the folders at once.
- [ ] After a cut-off copy, the package shows "Broken on drive". Applying the add again first says "The package is already on the drive. Remove it first, then add it again." Removing it (with the warning), then adding it again, works.

## 5. Reloads

- [x] A normal reload (Cmd+R) shows Reconnect with the queue saved. One click on Reconnect asks for both folders and restores the queue.
- [ ] A reload with the drive unplugged: Reconnect says which folder can't be used.
- [x] Reopening a closed tab (Cmd+Shift+T) brings its state back.
- [x] A hard refresh (Cmd+Shift+R), and DevTools' "Empty cache and hard reload", start afresh at the welcome screen. Try one on the very first visit too.
- [x] A private window behaves like a normal tab: a reload restores the session. (Chrome's private windows keep IndexedDB until the window closes.)
- [x] A new tab starts afresh, and the first tab keeps its queue.
- [ ] A reload on a Library URL with filters returns to that Library view after Reconnect.
- [x] Settings' "Re-select vault and drive", and the sidebar's hover x, clear everything after the warning.

## 6. Deployed site

- [ ] After merging to `main`, https://loadout.jych.io loads over HTTPS.
- [ ] A reload of https://loadout.jych.io shows Reconnect; a hard refresh starts afresh.
