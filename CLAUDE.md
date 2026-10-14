# Xbox 360 Content Utils

## Architecture

### `xcontent-header` package

The new package for reading and verifying a single XContent header. It replaces the header work in `xcontent`. Its design is in `xcontent-header-design-decision-record.md` and `function-design-doc.md`; the format reference is `xcontent-spec2.md`.

It uses **Vertical Slice Architecture**, with three verticals: `src/parse/` (R1, R4, R50, R51), `src/compare/` (R60, R61) and `src/verify/` (V1). Verticals never import each other. `src/shared/` holds code that more than one vertical needs, and any vertical may import it. `index.ts` (the root export) and `extended.ts` (`xcontent-header/extended`) are the only places that compose across verticals.

**Public and internal code are kept apart by folder.** The top-level files of a vertical (or of `shared/`) are public: an API function, or a single-purpose function exported from `/extended`. Everything else goes in `<vertical>/internal/`, and is never exported. `index.ts` and `extended.ts` must not import from any `internal/` folder (enforced by ESLint).

All single-purpose field parsers live in `src/shared/`, each parsing one field or group of related fields as a pure function `(bytes) => value`. They have a precondition only (the bytes passed `precheckHeader`), and are exported from `/extended`. Each V1 check is its own single-purpose internal function, in `src/verify/internal/`. The library code uses only ECMAScript 2024 plus the Web APIs declared in `src/runtime.d.ts`, never Node APIs, so it runs in browsers and in Node.

Work follows TDD: tests first, then code. Tests cite the behaviour statements in `function-design-doc.md` (for example `R1.12`).

Code is formatted with Prettier, configured in the package only (`printWidth` 120, single quotes, semicolons). Run `pnpm format` in `packages/xcontent-header` before finishing; `pnpm format:check` is part of the checks. Generated files are named `*.generated.ts`, start with an `@generated` comment, and aren't formatted.

### `xcontent` package (deprecated)

The `xcontent` package uses **Vertical Slice Architecture**. Each vertical is self-contained and has no dependencies on other verticals. `index.ts` is the only place that composes across verticals.

Within the **parse-header** vertical, we use **pure function decomposition by field group** — each field or group of related fields is parsed by its own pure function with the signature `(bytes: Uint8Array) => T`. This keeps each parser independently testable with synthetic binary fixtures.

### `xcontent-web` package (deprecated)

The `xcontent-web` package also uses **Vertical Slice Architecture** with the same rules: each vertical is self-contained, no cross-vertical imports, `index.ts` is the only composition point.

`xcontent-web` wraps `xcontent` with Web API–specific functionality (e.g. `FileSystemDirectoryHandle`). It is the layer that connects the portable binary logic in `xcontent` to the browser environment. `xcontent` must never depend on `xcontent-web`.
