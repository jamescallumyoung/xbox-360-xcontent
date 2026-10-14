# xcontent-header

Read XContent package headers.

Almost everything an Xbox 360 stores (games, DLC, title updates, saves, profiles) is an XContent **package** that starts with a header. The header says what the package is, which game or app it belongs to, how it's signed, who may use it, and how to display it. This package decodes that header from bytes in memory. It does no file I/O, so it works with any way of reading files.

> **Status: pre-1.0.** The API may change between minor versions.
>
> - **Available now:** `parseHeader`, `parseRestrictions`, `parseConsoleCertificate`, `hasEmptySignature` and the single-purpose parsers in `xcontent-header/extended`.
> - **Still to come:** `equals` and `diff` (compare two headers), and `verifyHeaderAsync` (check a header against the format).

The format is documented in the [Xbox 360 Content Specification](https://github.com/jamescallumyoung/xbox360-content-utils/blob/main/docs/xcontent-specification.md). Section references below (§) point to it.

## Requirements

Works in browsers and any runtime that ships `globalThis.crypto.subtle` and `TextDecoder`, including Node >= 22, Deno, and Bun.

Browsers only expose `crypto.subtle` in secure contexts (https or localhost). Only `verifyHeaderAsync` uses it.

## Install

```sh
npm install xcontent-header
```

## Quick start

Read the first `0xB000` bytes of a package file, then parse them. That's always enough for every function in this package: a header is at most `0xAD0E` bytes, padded to `0xB000`.

In a browser:

```ts
import { parseHeader } from 'xcontent-header';

async function readHeader(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 0xb000).arrayBuffer());
  return parseHeader(bytes);
}
```

In Node (or Deno or Bun):

```ts
import { open } from 'node:fs/promises';
import { parseHeader } from 'xcontent-header'; // or npm:xcontent-header in Deno

async function readHeader(path: string) {
  const file = await open(path);
  try {
    const { buffer, bytesRead } = await file.read(new Uint8Array(0xb000), 0, 0xb000, 0);
    return parseHeader(buffer.subarray(0, bytesRead));
  } finally {
    await file.close();
  }
}
```

## How values are represented

- **Identifiers** (Title ID, media ID, content ID, console, profile and device IDs) are uppercase hex strings with no prefix, at their full width. A Title ID of 1 is `00000001`, matching its directory name.
- **Everything else numeric** (sizes, counts, versions, content types, flags) is a `number`.
- **Text** is decoded from UTF-16BE. It ends at the first U+0000, and an empty field is `null`. Unpaired surrogates become U+FFFD; nothing else is changed.
- **Language slots:** `displayNames` and `descriptions` have one entry per slot (9, or 12 in metadata version 2), with empty slots as `null`. Index them with `LanguageSlot`, for example `displayNames[LanguageSlot.French]`. Slot 9 has no `LanguageSlot` entry, because its language isn't confirmed.
- **Thumbnails** are the image bytes (PNG, unchecked) as a `Uint8Array`, or `null` when there's none.
- **`declared...` values are claims.** The magic says which kind of signature a package claims, not that it's genuine. A package's directory decides its real Title ID and content type, and headers often disagree with it (§7.2).
- **`{ raw, decoded }`** pairs a stored value with what it means, such as `format: { raw: 1, decoded: 'svod' }`. **`{ declared, effective }`** pairs a stored value with how readers interpret it: `metadataVersion: { declared: 0, effective: 1 }`.

## The API

The API functions are exported from `xcontent-header`. Each checks its input, and never throws on bad input.

### How results work

Every API function returns a tuple whose first element says whether it succeeded:

- `[true, result]` on success.
- `[false, reasons]` on failure, where `reasons` is a list of failure reasons.

Check the first element before using the second. TypeScript narrows the second element when both are declared with `const`:

```ts
import { parseRestrictions } from 'xcontent-header';

declare const bytes: Uint8Array;

const [ok, value] = parseRestrictions(bytes);
if (ok) {
  console.log(value.licences.length); // value is Restrictions
} else {
  console.log(value[0]?.kind); // value is a list of failure reasons
}
```

A few more rules apply to every API function:

- **Pre-checks run first, and end the function early.** Every API function first checks that the bytes hold a whole header: at least 4 bytes, a magic of `CON `, `LIVE` or `PIRS`, a header size of `0x971A` or `0xAD0E` at `0x340`, and at least that many bytes. When one of these fails, the function returns that one reason straight away.
- **No exceptions for bad input.** Malformed, truncated or unrelated bytes produce failure reasons, never thrown errors. (The parsers in `xcontent-header/extended` work differently: see below.)
- **The order of reasons isn't part of the contract.** When there's more than one, their order is the same for the same input, but may change between versions.
- **Results don't depend on the input afterwards.** Byte fields such as thumbnails are copies, so changing your buffer later doesn't change a result.

The pre-check failure reasons, which every API function can return, are:

| `kind`                | Meaning                                               | Extra fields    |
| --------------------- | ----------------------------------------------------- | --------------- |
| `insufficient-bytes`  | Too few bytes for the next step                       | `needed`, `got` |
| `not-a-package`       | The magic isn't `CON `, `LIVE` or `PIRS`              |                 |
| `header-size-invalid` | The header size at `0x340` isn't `0x971A` or `0xAD0E` | `declared`      |

### Functions

#### `parseHeader(bytes)`

What the package is, and how it's displayed: its declared signing type, format (STFS or SVOD), content type, Title ID, metadata version, sizes, IDs, display names and descriptions in every language, and thumbnails.

It fails, as well as on a pre-check, when a field has no truthful value. It reports every such field:

| `kind`                           | Meaning                                                             | Extra fields                                                                 |
| -------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `value-exceeds-max-safe-integer` | `contentSize` or `dataFilesSize` is above `Number.MAX_SAFE_INTEGER` | `field`, `raw` (`0x` and 16 hex digits; `BigInt(raw)` gives the exact value) |
| `value-out-of-range`             | A thumbnail's declared size is larger than its space                | `field`, `declaredSize`, `availableSpace`                                    |

#### `parseRestrictions(bytes)`

Who may use the package, and how it may be moved: all 16 licence entries, the transfer flags, and the IDs of the console that created it, the profile that owns it and the storage device it's tied to.

These are facts from the header, not verdicts such as "can be used". Whether a modded console honours licences is unknown (§2.2).

#### `parseConsoleCertificate(bytes)`

The certificate of the console that signed a `CON` package, or `null` for `LIVE` and `PIRS` packages. It isn't verified. The certificate date is returned as text, because its format is unknown (§6.2).

#### `hasEmptySignature(bytes)`

Whether the signature is all zero bytes, which marks a package made by a tool (such as a Disc to GOD rip) rather than signed by Microsoft or a console. It returns `[true, isEmpty]`: `[true, false]` means "checked, and not empty". A non-empty signature isn't necessarily genuine: it isn't verified.

## `xcontent-header/extended`

The single-purpose parsers behind the API functions, for callers who want only a few fields, or want to compose their own parsing. Each takes the header bytes and returns one value, or a small group of values.

**They have different prerequisites from the API functions, and the API's rules above don't apply to them:**

- **A precondition instead of pre-checks.** `precheckHeader(bytes)` must have passed before a parser is called. The parsers don't check it themselves.
- **Plain values, not result tuples.** Each parser returns its value directly.
- **Exceptions are possible.** On input that doesn't meet the precondition, a parser's behaviour is undefined: it may return a wrong value or throw.

`precheckHeader` itself runs the API's pre-checks and returns a result tuple. Each parser's documentation states its preconditions.

```ts
import { parseDeclaredTitleId, parseDisplayNames, parseFormat, precheckHeader } from 'xcontent-header/extended';

declare const bytes: Uint8Array;

const [ok, header] = precheckHeader(bytes);
if (ok) {
  console.log(header.declaredSigning, parseDeclaredTitleId(bytes), parseFormat(bytes).decoded);
  console.log(parseDisplayNames(bytes)[0]);
}
```

Some parsers also differ from the matching field of `parseHeader`:

- `parseContentSize` and `parseDataFilesSize` return an exact `bigint`, where `parseHeader` returns a `number` and fails when it doesn't fit.
- `parseThumbnail` and `parseTitleThumbnail` have a second precondition: the declared size must fit its space. Check it with `parseThumbnailSizes`.
- The certificate parsers have a second precondition: the magic is `CON `.

## Development

This package lives in the [xbox360-content-utils](https://github.com/jamescallumyoung/xbox360-content-utils) monorepo, and uses pnpm.

Running the tests needs **Node 22.12 or later** (for Vitest 5), even though the package itself runs on Node 22.

```sh
pnpm build         # compile to dist/js and dist/types
pnpm typecheck     # library and tests
pnpm lint
pnpm format:check  # or `pnpm format` to fix
pnpm test
```

The tests use real headers from `src/__tests__/fixtures/`, with their expected values in a generated manifest. After changing a fixture, regenerate it with `python3 generate_manifest.py > manifest.generated.ts` in that folder.

## Use of AI

Development of this package is **AI-assisted**. AI tools helped write its code, tests and documentation. However, development was still driven by a human (beyond just prompting) and human input and review was involved in every stage of development.

This package is **not** **"vibe-coded"**. No code was generated without human oversight.

## Contributing

This project doesn't accept pull requests from the public. Many open-source projects are flooded with low-effort, vibe-coded submissions that easily exhaust the maintainers' efforts to review them.

If you'd like to contribute, you're welcome to contact the maintainers and ask for access.

The project is open source, so anyone may fork it without asking first.

## Licence

[AGPL-3.0-only](./LICENSE).
