# Xbox 360 Content Utils

## Architecture

### `xcontent` package

The `xcontent` package uses **Vertical Slice Architecture**. Each vertical is self-contained and has no dependencies on other verticals. `index.ts` is the only place that composes across verticals.

Within the **parse-header** vertical, we use **pure function decomposition by field group** — each field or group of related fields is parsed by its own pure function with the signature `(bytes: Uint8Array) => T`. This keeps each parser independently testable with synthetic binary fixtures.
