# Xbox 360 Content Utils

## Architecture

### `xcontent-header` package

The new package for reading and verifying a single XContent header. It replaces the header work in `xcontent`. Its design is in `xcontent-header-design-decision-record.md` and `function-design-doc.md`; the format reference is `xcontent-spec2.md`.

It uses **Vertical Slice Architecture**: one slice per public function. Slices never import each other. The one exception is `src/shared/`, which holds internal code every slice needs (pre-checks, the field table, `toHex`, text decoding), and which any slice may import. `index.ts` (the root export) and `extended.ts` (`xcontent-header/extended`) are the only places that compose across slices.

Within a slice, each field or group of related fields is parsed by its own pure function, and each V1 check is its own single-purpose internal function. The library code uses only ECMAScript 2024 plus the Web APIs declared in `src/runtime.d.ts`, never Node APIs, so it runs in browsers and in Node.

### `xcontent` package (deprecated)

The `xcontent` package uses **Vertical Slice Architecture**. Each vertical is self-contained and has no dependencies on other verticals. `index.ts` is the only place that composes across verticals.

Within the **parse-header** vertical, we use **pure function decomposition by field group** — each field or group of related fields is parsed by its own pure function with the signature `(bytes: Uint8Array) => T`. This keeps each parser independently testable with synthetic binary fixtures.

### `xcontent-web` package (deprecated)

The `xcontent-web` package also uses **Vertical Slice Architecture** with the same rules: each vertical is self-contained, no cross-vertical imports, `index.ts` is the only composition point.

`xcontent-web` wraps `xcontent` with Web API–specific functionality (e.g. `FileSystemDirectoryHandle`). It is the layer that connects the portable binary logic in `xcontent` to the browser environment. `xcontent` must never depend on `xcontent-web`.
