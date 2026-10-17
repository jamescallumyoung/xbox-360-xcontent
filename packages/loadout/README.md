# Loadout

Copy Xbox 360 titles from a read-only vault to the drive of a soft-modded console, and remove them from the drive.

Loadout is a web app. You pick two `Content/` folders: a **vault**, which Loadout only reads, and a **drive**, usually a FAT32 USB drive the console reads. Loadout lists the titles in the vault, shows which are on the drive, and lets you queue packages to copy to the drive or remove from it, then apply the queue.

> **Status: 0.1.0, the first version.** See `docs/features.md` for what it does, and its section 10 for what's planned.

## Requirements

- **A Chromium-based browser,** such as Chrome or Edge. Only they let a web page pick a real folder and write to it.
- **A drive with a PC file system,** such as FAT32 or exFAT. Loadout can't write to an Xbox 360's own FATX file system: see the `xcontent-fs-web` README.

## Docs

- `docs/features.md`: what Loadout does.
- `docs/components.md`: its components.
- `docs/lib-design.md`: what `src/lib/` and the store must do, as numbered statements the tests cite.
- The Xbox 360 content format is in `docs/xcontent-specification.md` at the repo root.

## Using it

1. Open Loadout in Chrome or Edge.
2. Choose the **vault**: the `Content` folder of your backups. Loadout only reads it.
3. Choose the **drive**: the `Content` folder on the drive you plug into the console, or an empty folder there. The browser asks for permission to change it.
4. Browse **Discover** and the **Library**, and open a title to manage it.
5. On a title's page, **Add** packages from the vault, or **Remove** packages from the drive. Removing something the vault can't restore asks first.
6. On the **Queue** page, **Apply** the changes. Removals run first, then copies. **Stop** finishes the current change and stops.
7. Eject the drive safely before you plug it into the console.

After a reload, **Reconnect** asks for permission again with one click, and your queue is kept. A hard refresh, or a new tab, starts afresh.

### What to know

- **Only the public partition** (`0000000000000000`) is managed. Saves and profiles aren't shown.
- **Removal safety compares headers, not data.** A removal goes ahead without asking only when the vault has the same package with the same content ID. That doesn't check an SVOD package's data files (a planned fast-hash check will).
- **"Corrupt" is a light check.** It means a header that can't be parsed, or a `.data` folder without its header, such as a copy that was cut off. A broken copy on the drive can be removed, then copied again.
- **Drive space can't be read** by the browser, so a full drive shows up as an error part-way through a copy.

## Development

Loadout lives in the `xbox360-content-utils` monorepo and uses pnpm. It depends on the workspace packages `xcontent-header` and `xcontent-fs-web`, which must be built first.

```sh
pnpm --filter loadout^... build   # build the workspace packages Loadout uses
pnpm dev           # serve on http://localhost:3000, rebuilding on change
pnpm typecheck
pnpm lint
pnpm format:check  # or `pnpm format` to fix
pnpm test          # Vitest, in Node, against in-memory folders
pnpm build         # dist/, ready to serve from any path
```

- **Layout:** `src/lib/` holds the logic, tested first; `src/app/store.ts` is the app's single state object, also tested; `src/components/` and `src/pages/` are Lit views over the store. See `docs/lib-design.md`.
- **Restart `pnpm dev`** after changing `index.html`, `public/` or `tokens.css`: only the code is rebuilt on change.
- **Deployment:** the repo's Pages workflow builds Loadout and serves it at `/loadout/`, beside the old app.
- **Manual testing:** `docs/manual-test-checklist.md` lists what to check by hand in Chrome, on real drives.

## Use of AI

**Loadout is vibe-coded.** Its code, tests and docs were written by AI agents, and each stage was reviewed by other AI agents. A human set its requirements and design, and reviewed the finished result, but not each change as it was made.

This differs from the libraries it uses, `xcontent-header` and `xcontent-fs-web`, which were written with AI assistance under human review at every stage.

## Licence

[AGPL-3.0-only](./LICENSE).
