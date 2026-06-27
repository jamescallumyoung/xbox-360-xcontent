# Xbox 360 Content Utils

## Architecture

### `xcontent` package

The `xcontent` package uses **Vertical Slice Architecture**. Each vertical is self-contained and has no dependencies on other verticals. `index.ts` is the only place that composes across verticals.

Within the **parse-header** vertical, we use **pure function decomposition by field group** — each field or group of related fields is parsed by its own pure function with the signature `(bytes: Uint8Array) => T`. This keeps each parser independently testable with synthetic binary fixtures.

### `xcontent-web` package

The `xcontent-web` package also uses **Vertical Slice Architecture** with the same rules: each vertical is self-contained, no cross-vertical imports, `index.ts` is the only composition point.

`xcontent-web` wraps `xcontent` with Web API–specific functionality (e.g. `FileSystemDirectoryHandle`). It is the layer that connects the portable binary logic in `xcontent` to the browser environment. `xcontent` must never depend on `xcontent-web`.
