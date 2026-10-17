# Loadout: manual test checklist

What the automated tests can't cover: the browser's folder and save dialogs, permission prompts, real drives, reloads and deployment. Run it in Chrome, with `pnpm dev` (http://localhost:3000) or the deployed site.

**Folders to use**

- **Vault:** the gitignored `fixtures/` folder's `Content/` (real, anonymised packages), or a copy of part of a real vault.
- **Drive:** first an empty scratch folder on the Mac's own disk (APFS), then the same on a FAT32 USB drive, as in the `xcontent-fs-web` design record, section 2.5.

## 1. Setup

- [ ] The welcome screen shows; Continue is disabled.
- [ ] Choosing the vault's parent folder (the one holding `Content`) says "This folder holds a Content folder".
- [ ] Choosing a partition (`0000000000000000`) says it's a partition, not a partition root.
- [ ] Choosing the same folder for both is refused, and Continue stays disabled.
- [ ] An empty drive folder says "Empty folder. Titles will be copied here."
- [ ] Continue scans both and opens Discover. The drive widget counts match the drive.

## 2. Browsing

- [ ] Discover's "Recently added" shows vault titles, newest first. Thumbnails appear.
- [ ] Library filters and sorts work, and "See all" links open the Library with the same filters.
- [ ] Search finds titles by name and by Title ID; Enter opens the first.
- [ ] A title without a name in its headers shows `UNKNOWN`.
- [ ] Phone width (Chrome's device toolbar): the tab bar replaces the sidebar, and nothing scrolls sideways.

## 3. Queue and apply

- [ ] On a title, Add queues a package; the tile and header show it queued.
- [ ] Remove on a package the vault has, unchanged: queued with no warning.
- [ ] Remove on a drive-only package: the "can't be restored" warning shows; Keep it cancels.
- [ ] Apply runs removals, then copies, with per-row and overall progress.
- [ ] An SVOD (Games on Demand) copy has its `.data` folder with every `Data####` file, the same sizes as the vault.
- [ ] On FAT32, no `._` AppleDouble files are left beside the copy.
- [ ] The summary dialog opens; Download JSON saves the report.
- [ ] Save to drive... refuses the `Content` folder and leaves no empty file there; saving at the drive's top level works.
- [ ] Stop during a multi-file copy stops after the current change; the rest stay queued.

## 4. Failures

- [ ] Pull the USB drive during a copy: the apply stops with "The drive was disconnected", the sidebar shows Disconnected, and Apply is disabled.
- [ ] Plug it back in (re-plugging is untested so far): does the drive show Connected again within about 5 seconds, without picking it again? Note what happens.
- [ ] After a cut-off copy, the package shows "Broken on drive"; removing it, then adding it again, works.

## 5. Reloads

- [ ] A normal reload (Cmd+R) shows Reconnect with the queue saved. One click on Reconnect asks for both folders and restores the queue.
- [ ] A hard refresh (Cmd+Shift+R) starts afresh at the welcome screen.
- [ ] A new tab starts afresh, and the first tab keeps its queue.
- [ ] Settings' "Re-select vault and drive" clears everything after the warning.

## 6. Deployed site

- [ ] After merging to `main`, `/loadout/` loads, and the old app at `/` still works.
- [ ] A reload of `/loadout/` shows Reconnect; a hard refresh starts afresh.
