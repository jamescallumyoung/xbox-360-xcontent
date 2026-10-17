# Xbox 360 Content Utils

## Architecture

### `xcontent-header` package

The new package for reading and verifying a single XContent header. It replaces the header work in `xcontent`. Its design is in `packages/xcontent-header/docs/xcontent-header-design-decision-record.md` and `packages/xcontent-header/docs/function-design-doc.md`; the format reference is `docs/xcontent-specification.md`.

It uses **Vertical Slice Architecture**, with three verticals: `src/parse/` (R1, R4, R50, R51), `src/compare/` (R60, R61) and `src/verify/` (V1). Verticals never import each other. `src/shared/` holds code that more than one vertical needs, and any vertical may import it. `index.ts` (the root export) and `extended.ts` (`xcontent-header/extended`) are the only places that compose across verticals.

**Public and internal code are kept apart by folder.** The top-level files of a vertical (or of `shared/`) are public: an API function, or a single-purpose function exported from `/extended`. Everything else goes in `<vertical>/internal/`, and is never exported. `index.ts` and `extended.ts` must not import from any `internal/` folder (enforced by ESLint).

All single-purpose field parsers live in `src/shared/`, each parsing one field or group of related fields as a pure function `(bytes) => value`. They have a precondition only (the bytes passed `precheckHeader`), and are exported from `/extended`. Each V1 check is its own single-purpose internal function, in `src/verify/internal/`. The library code uses only ECMAScript 2024 plus the Web APIs declared in `src/runtime.d.ts`, never Node APIs, so it runs in browsers and in Node.

Work follows TDD: tests first, then code. Tests cite the behaviour statements in `packages/xcontent-header/docs/function-design-doc.md` (for example `R1.12`).

Code is formatted with Prettier, configured in the package only (`printWidth` 120, single quotes, semicolons). Run `pnpm format` in `packages/xcontent-header` before finishing; `pnpm format:check` is part of the checks. Generated files are named `*.generated.ts`, start with an `@generated` comment, and aren't formatted.

### `xcontent-fs-web` package

Copies, deletes, reads headers of, locates and cleans packages in a `Content/` tree, through the File System Access API. As of October 2026 only Chromium-based browsers support the parts of that API it needs, so it's expected to work only in them. Its design is in `packages/xcontent-fs-web/docs/xcontent-fs-web-design-decision-record.md` and `packages/xcontent-fs-web/docs/function-design-doc.md`; the format reference is `docs/xcontent-specification.md`.

It does **not** use verticals: the package is small enough without them. Each exported function has its own file in `src/` (the root of `src/` holds public code only), and everything else goes in `src/internal/`, which is never exported. `index.ts` (the root export) and `extended.ts` (`xcontent-fs-web/extended`) must not import from `internal/` (enforced by ESLint). The root object's methods (`copyTo`, `deletePackage`, `readHeaderBytes`, `locatePackage`) are plain functions in their own `src/` files, bound onto the object by `openContentRoot`.

The browser's types come from TypeScript's `dom` lib. `src/runtime.d.ts` only adds the little `dom` lacks (such as `queryPermission`); keep it small. Dependencies are declared only once the package's code uses them.

Work follows TDD, function by function: tests first, citing the behaviour statements in `packages/xcontent-fs-web/docs/function-design-doc.md` (for example `C1.18`), then the code, whose JSDoc references the same statements. Tests run in Node against an in-memory file system.

Code is formatted with Prettier, configured in the package (`printWidth` 120, single quotes, semicolons). Run `pnpm format` in `packages/xcontent-fs-web` before finishing; `pnpm lint` and `pnpm format:check` are part of the checks.

### `loadout` package

A web app that copies Xbox 360 packages from a read-only vault `Content/` folder to a drive, and removes them from the drive. It's built on `xcontent-header` and `xcontent-fs-web`, with Lit 3 web components (standard decorators, `accessor` fields) bundled by esbuild. Chromium-based browsers only. Its design is in `packages/loadout/docs/`: `features.md`, `components.md`, and `lib-design.md`, whose numbered statements (for example `S1.4`) the tests cite.

- `src/lib/` holds the domain types and every function with behaviour worth testing (scan, partition-root check, folder health, apply, report, session).
- `src/app/store.ts` is the store: the app's single state object, which holds all state, exposes actions and emits `change`. It has no Lit import, so it's tested in Node.
- `src/components/` and `src/pages/` are views over the store. They must not import `xcontent-fs-web` or `xcontent-header` (enforced by ESLint).

Work follows TDD for `src/lib/` and the store, tested in Node with Vitest against memfs. Build the workspace packages first (`pnpm --filter loadout^... build`). Code is formatted with Prettier (`printWidth` 120, single quotes, semicolons). Run `pnpm format` in `packages/loadout` before finishing; `pnpm lint` and `pnpm format:check` are part of the checks. Loadout is deployed to GitHub Pages at `/loadout/`, beside the old app.

### `xcontent` package (deprecated)

The `xcontent` package uses **Vertical Slice Architecture**. Each vertical is self-contained and has no dependencies on other verticals. `index.ts` is the only place that composes across verticals.

Within the **parse-header** vertical, we use **pure function decomposition by field group** — each field or group of related fields is parsed by its own pure function with the signature `(bytes: Uint8Array) => T`. This keeps each parser independently testable with synthetic binary fixtures.

### `xcontent-web` package (deprecated)

The `xcontent-web` package also uses **Vertical Slice Architecture** with the same rules: each vertical is self-contained, no cross-vertical imports, `index.ts` is the only composition point.

`xcontent-web` wraps `xcontent` with Web API–specific functionality (e.g. `FileSystemDirectoryHandle`). It is the layer that connects the portable binary logic in `xcontent` to the browser environment. `xcontent` must never depend on `xcontent-web`.
