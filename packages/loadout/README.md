# Loadout

Copy Xbox 360 titles from a read-only vault to the drive of a soft-modded console, and remove them from the drive.

Loadout is a web app. You pick two `Content/` folders: a **vault**, which Loadout only reads, and a **drive**, usually a FAT32 USB drive the console reads. Loadout lists the titles in the vault, shows which are on the drive, and lets you queue packages to copy to the drive or remove from it, then apply the queue.

> **Status: 0.1.0, the first version.** See `docs/features.md` for what it does, and its §10 for what's planned.

## Requirements

- **A Chromium-based browser,** such as Chrome or Edge. Only they let a web page pick a real folder and write to it.
- **A drive with a PC file system,** such as FAT32 or exFAT. Loadout can't write to an Xbox 360's own FATX file system: see the `xcontent-fs-web` README.

## Docs

- `docs/features.md`: what Loadout does.
- `docs/components.md`: its components.
- `docs/lib-design.md`: what `src/lib/` and the store must do, as numbered statements the tests cite.
- The Xbox 360 content format is in `docs/xcontent-specification.md` at the repo root.

## Use of AI

**Loadout is vibe-coded.** Its code, tests and docs were written by AI agents, and each stage was reviewed by other AI agents. A human set its requirements and design, and reviewed the finished result, but not each change as it was made.

This differs from the libraries it uses, `xcontent-header` and `xcontent-fs-web`, which were written with AI assistance under human review at every stage.

## Licence

[AGPL-3.0-only](./LICENSE).
