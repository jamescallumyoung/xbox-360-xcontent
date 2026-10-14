# `xcontent-header`: design decision record

**Status:** in design. No code yet. Last updated 2026-10-13.

This records the decisions made while designing the public API of `xcontent-header`, the first of the new packages that replace `xcontent`, `xcontent-web` and `app`. It's for James and for any agent continuing the work. The format reference is [xcontent-specification.md](../../../docs/xcontent-specification.md). Section numbers (§) below refer to it.

Items marked **Open** are not decided yet. Everything else is decided.

---

## 1. Context and scope

- **The old packages are deprecated entirely.** `xcontent`, `xcontent-web` and `app` are not a reference for the new design. The new packages are below 1.0.0, so breaking changes are expected.
- **`xcontent-header`** holds everything about a single package header (§6.1–§6.5). It works on bytes in memory and does no I/O.
- **Other packages, planned separately:**
  - an SVOD package, with its own parsing, verification and comparison functions
  - an STFS package, if needed (for example `parseStfsVolumeDescriptor`)
  - `xcontent-types`, which may ship a content type table
  - a web package for File System Access I/O, to be designed later

### Function IDs

Each function has an ID, used in discussion. IDs are never renumbered. When functions merge, the merged function keeps the existing number. When one splits, the parts get new numbers (R5 → R50, R51).

| ID  | Function                  | Status                                                     |
| --- | ------------------------- | ---------------------------------------------------------- |
| R1  | `parseHeader`             | decided. R2 (format) and R3 (content type) are part of it. |
| R4  | `parseRestrictions`       | decided                                                    |
| R50 | `parseConsoleCertificate` | decided (field types open, §4.3)                           |
| R51 | `hasEmptySignature`       | decided                                                    |
| R60 | `equals`                  | decided                                                    |
| R61 | `diff`                    | decided                                                    |
| V1  | `verifyHeaderAsync`       | findings design pending (§5)                               |
| V2  | verify an SVOD package    | shelved; moves to the SVOD package (§7)                    |
| B1  | bulk-verify a title       | shelved; may move to the web package                       |
| W1  | edit header fields        | shelved                                                    |

---

## 2. Conventions

### 2.1 Function names

- **`parse…`** for every function that decodes bytes into values. They take data already in memory, like `JSON.parse`. Unlike `JSON.parse`, they never throw on bad input: they return failure reasons (§3).
- **`…Async`** only on V1, the only async function. There is no sync twin. The suffix marks it out from every other function, which is sync.
- **`equals` and `diff`**, without a `headers` qualifier. Consumers can rename on import (`import { diff as diffHeaders }`).
- **Exports:** the API functions from the package root. The single-purpose field parsers and `precheckHeader` from `xcontent-header/extended` (§4.7). Single-purpose verification checks stay internal.

### 2.2 How values are represented

There are no floating-point values in the header.

| Kind of value                                                                 | Type                 | Rule                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Truly opaque identifiers**                                                  | `string`             | uppercase hex, no `0x` prefix, zero-padded to the field's full width (2 digits per byte). They are strings that happen to look like hex, matching how directory names and the spec write them. Example: Title ID `0x1` is `00000001`. |
| **Quantities** (sizes, counts, versions, disc numbers)                        | `number`             |                                                                                                                                                                                                                                       |
| **Bit fields** (licence bits and flags, transfer flags)                       | `number`             | so consumers can use bitwise operators                                                                                                                                                                                                |
| **Lookup codes** (content type, volume type, licensee type, metadata version) | `number`             |                                                                                                                                                                                                                                       |
| **Text**                                                                      | `string \| null`     | see §2.4                                                                                                                                                                                                                              |
| **Images**                                                                    | `Uint8Array \| null` | see §2.5                                                                                                                                                                                                                              |

The identifiers, with their width in hex digits:

| Identifier                                               | Digits |
| -------------------------------------------------------- | ------ |
| `declaredTitleId`, `mediaId`, `saveGameId`               | 8      |
| console IDs (certificate owner `0x006`, creator `0x36C`) | 10     |
| `licenseeData`                                           | 12     |
| `profileId`, `onlineCreator`                             | 16     |
| `deviceId`, `contentId`                                  | 40     |

A profile ID of zero (eight zero bytes) is `0000000000000000`.

**64-bit quantities.** Content size (`0x34C`) and combined data file size (`0x3A1`) are 8-byte fields. Real values are far below 2⁵³ (the largest realistic package, a dual-layer GOD, is about 8 GiB), so they are `number`. A value above `Number.MAX_SAFE_INTEGER` is treated as malformed, and `parseHeader` fails with `value-exceeds-max-safe-integer` (§3.3). That reason carries the raw value, so a consumer who knows better can build a `bigint` themselves.

**Content type** is a `number` (for example `28672` for `0x00007000`), not an identifier.

### 2.3 Three naming patterns for header values

| Pattern                   | Meaning                                                                                                            | Used for                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `declared…` prefix        | What the header **claims**, when something outside the header decides the truth (the directory, or the signature). | `declaredTitleId`, `declaredContentType`, `declaredSigning`         |
| `{ declared, effective }` | The stored value, plus how readers **interpret** it under a known rule.                                            | `metadataVersion` only                                              |
| `{ raw, decoded }`        | The stored value, plus a **lookup** of its meaning.                                                                | `format`, `licenseeType`, `transferFlags`, `consoleType` (proposed) |

Why not `{ declared, effective }` for lookups: "effective" would suggest the console treats the value differently from what's stored. Only the metadata version has such a rule (readers treat any value other than 2 as version 1, §6.1).

### 2.4 Text

- **Encoding:** UTF-16BE (§6.5).
- **Decoding uses `TextDecoder('utf-16be', { ignoreBOM: true })`** in its default (replacement) mode, not hand-written code. `ignoreBOM: true` keeps a leading U+FEFF, which the default would remove, so text is returned exactly as decoded (decided 2026-10-14). Decided 2026-10-13, replacing an earlier "lossless" decision.
- **Unpaired surrogates become U+FFFD** (`�`), the standard replacement character. This is the only way UTF-16 can be malformed. The exact value of a broken code unit is lost. That was judged acceptable: nobody has needed it, U+FFFD is the well-understood standard representation, and it avoids decoding UTF-16 by hand. Strings returned by the package are therefore always well-formed.
- **Termination:** a string ends at the first U+0000 character (found with `indexOf('\0')` on the decoded text), like a C `char16_t[]`. U+0000 only comes from a `00 00` code unit, so a character such as "0" (`00 30`) is never mistaken for the terminator. If a field has no U+0000, the string uses the field's full width.
- **Empty fields** (first code unit `0x0000`) are `null`.
- **V1** detects unpaired surrogates with a second `TextDecoder('utf-16be', { fatal: true })`, which throws on malformed text. That becomes a `text-unpaired-surrogate` finding.
- **ASCII fields** (the certificate's part number and date) use `TextDecoder('latin1')`.
- **No repair:** text stored as UTF-8 inside UTF-16BE (the _South Park_ fixture) is returned as decoded. Undoing it would be a heuristic.

### 2.5 Thumbnails

- Returned as `Uint8Array`, holding exactly the declared number of bytes from the thumbnail's space. `null` when the declared size is 0.
- **Copies, not views** (`slice`, not `subarray`), so a parse result doesn't change if the caller later changes their buffer.
- Not decoded or checked. "PNG" only describes what the bytes claim to be. Checking them is V1's job. Turning them into an image is the consumer's job (for example `new Blob([bytes], { type: 'image/png' })`).
- Browser image types (`Blob`, `ImageBitmap`) are not used, because the package runs outside browsers too.

### 2.6 Language slots

Display names and descriptions are arrays that keep each slot's position, because the position is the language:

- 9 entries for metadata version 1, 12 for version 2. Empty slots are `null`.
- A shipped `LanguageSlot` object maps languages to array indices. It's an `as const` object plus a type, not a TypeScript `enum`: Node's type stripping rejects `enum`, and bundlers can't remove it when unused.
- **Slot 9 is omitted**, because its language is not confirmed (§6.5: xenia, rom-properties and Free60 say Simplified Chinese; xenia-canary changed this in 2026). Its value is still reachable by index.

```ts
export const LanguageSlot = {
  English: 0,
  Japanese: 1,
  German: 2,
  French: 3,
  Spanish: 4,
  Italian: 5,
  Korean: 6,
  TraditionalChinese: 7,
  Portuguese: 8,
  Polish: 10,
  Russian: 11,
} as const;
```

---

## 3. Input and failure outcomes

### 3.1 Every function requires the full header

Every function needs bytes from `0x000` up to the header size stated at `0x340` (`0x971A` or `0xAD0E`). A partial header, such as the first `0x2000` bytes, is not accepted.

- **Why:** V1, `equals` and `diff` need the whole header anyway. It also removes "parsed, but some fields unavailable" states from every result type.
- **For callers:** the header size is unknown before reading, so read `0xB000` bytes, which also covers V1's need for the padded header. Extra bytes, such as the rest of an STFS package, are ignored.
- **Cost:** a full header is 37.8 KiB (`0x971A`) or 43.3 KiB (`0xAD0E`), against 8 KiB for `0x2000`. For 591 packages that's about 26 MB against 4.7 MB, still one read per package.

### 3.2 Pre-checks, run first by every function

Two internal functions, run in this order. The first failure returns immediately, without parsing anything.

1. **Magic check**
   1. buffer shorter than 4 bytes → `insufficient-bytes`
   2. magic is not `CON `, `LIVE` or `PIRS` → `not-a-package`
2. **Header size check**
   1. buffer shorter than `0x344`, so the size at `0x340` can't be read → `insufficient-bytes`
   2. header size is not `0x971A` or `0xAD0E` → `header-size-invalid`
   3. buffer shorter than the header size → `insufficient-bytes`

The magic is checked first because "not a package" is a more useful answer than "insufficient bytes" for a short file read by mistake.

### 3.3 Failure outcomes

**Principle:** a parse function fails only when a field has no truthful representation. Values that are unusual but representable are returned as they are, and judging them is V1's job. A failed parse never returns a partial result.

**Result tuples.** R1, R4, R50, R51 and R61 return `[true, result]` on success and `[false, reasons]` on failure, where `reasons` is a list. The caller checks the first element to know what the second holds. (R51's result is itself a `boolean`: `[true, isEmpty]`. R60 returns three elements: `[success, isEqual, differences | reasons]`, see §4.5.)

| Reason                           | Raised by                      | Returned by                                                 |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------- |
| `insufficient-bytes`             | magic check, header size check | all functions. **One shared type** for R1, R4, R50 and R51. |
| `not-a-package`                  | magic check                    | all functions                                               |
| `header-size-invalid`            | header size check              | all functions                                               |
| `value-exceeds-max-safe-integer` | parsing                        | `parseHeader` only                                          |
| `value-out-of-range`             | parsing                        | `parseHeader` only                                          |

**Pre-check failures end a function early.** It parses or compares nothing else, so `reasons` holds exactly one pre-check reason. This applies to every function, and goes in the package's API documentation.

**Parsing failures** list **every** bad field, one reason per field:

```ts
| { kind: 'value-exceeds-max-safe-integer'; field: 'contentSize' | 'dataFilesSize'; raw: string }  // '0x' + 16 hex digits
| { kind: 'value-out-of-range'; field: 'thumbnail' | 'titleThumbnail'; declaredSize: number; availableSpace: number }
```

- **`value-exceeds-max-safe-integer`:** `contentSize` or `dataFilesSize` above `Number.MAX_SAFE_INTEGER`. `raw` is the field's 8 bytes as `0x` + 16 hex digits. The `0x` prefix is deliberate here: the value is a number too large for `number`, not an identifier, and `BigInt(raw)` accepts it directly. The name follows the threshold, `MAX_SAFE_INTEGER` (2⁵³ − 1), not `Number.MAX_VALUE`.
- **`value-out-of-range`:** `thumbnail` or `titleThumbnail` whose declared size (`0x1712`, `0x1716`) is larger than its `availableSpace`: `0x4000` in metadata version 1, `0x3D00` in version 2 (by `metadataVersion.effective`). This detection is reliable: it compares two values the header itself states.

**The order of reasons is not part of the contract.** It's deterministic between runs, but may change between versions without warning. This applies to every function, and goes in the package's API documentation.

**Not failures** (they have a truthful representation):

| Condition                             | Result                                       |
| ------------------------------------- | -------------------------------------------- |
| metadata version other than 0, 1 or 2 | `{ declared: 7, effective: 1 }`              |
| volume type other than 0 or 1         | `format: { raw: 5, decoded: 'unknown' }`     |
| unknown content type                  | its `number`                                 |
| unknown licensee type                 | `{ raw, decoded: 'unknown' }`                |
| any identifier, including all zeros   | its hex string                               |
| unpaired surrogates in text           | replaced with U+FFFD by `TextDecoder` (§2.4) |
| text stored as UTF-8 inside UTF-16BE  | returned as decoded (§2.4)                   |

**What parsing can't detect.** The header has no markers between fields: a byte's meaning comes only from its offset. So parsing can't tell whether an image spilled past its space while declaring a size that fits. V1 can find most such cases indirectly: an image whose PNG structure doesn't end at the declared size, or, in version 1, a title thumbnail that no longer starts with the PNG signature.

Type names follow the pattern `ParseHeaderFailureReason`, `ParseRestrictionsFailureReason` and so on.

---

## 4. Functions

### 4.1 R1 `parseHeader`

Answers "what is this package?": the identity steps of §6.9 plus the display information.

| Field                                                   | Type                                                       | Source                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `declaredSigning`                                       | `'CON' \| 'LIVE' \| 'PIRS'`                                | `0x000`                                                |
| `contentId`                                             | identifier (40)                                            | `0x32C`                                                |
| `headerSize`                                            | `number`                                                   | `0x340`                                                |
| `declaredContentType`                                   | `number`                                                   | `0x344`                                                |
| `metadataVersion`                                       | `{ declared: number, effective: 1 \| 2 }`                  | `0x348`                                                |
| `contentSize`                                           | `number`                                                   | `0x34C`                                                |
| `mediaId`                                               | identifier (8)                                             | `0x354`                                                |
| `version`, `baseVersion`                                | `number`                                                   | `0x358`, `0x35C`                                       |
| `declaredTitleId`                                       | identifier (8)                                             | `0x360`                                                |
| `platform`, `executableType`, `discNumber`, `discCount` | `number`                                                   | `0x364`–`0x367`                                        |
| `saveGameId`                                            | identifier (8)                                             | `0x368`                                                |
| `dataFileCount`                                         | `number`                                                   | `0x39D`                                                |
| `dataFilesSize`                                         | `number`                                                   | `0x3A1`                                                |
| `format`                                                | `{ raw: number, decoded: 'stfs' \| 'svod' \| 'unknown' }`  | `0x3A9`                                                |
| `onlineCreator`                                         | identifier (16)                                            | `0x3AD`                                                |
| `category`                                              | `number`                                                   | `0x3B5`                                                |
| `mediaOrAvatarData`                                     | `Uint8Array \| null` (a copy; `null` in version 1)         | `0x3D9`, version 2 only                                |
| `displayNames`, `descriptions`                          | `(string \| null)[]` (9 or 12)                             | `0x411`, `0xD11`, plus `0x541A`, `0x941A` in version 2 |
| `publisherName`, `titleName`                            | `string \| null`                                           | `0x1611`, `0x1691`                                     |
| `thumbnail`, `titleThumbnail`                           | `Uint8Array \| null`                                       | `0x1712` + `0x171A`, `0x1716` + `0x571A`               |
| `installerMetadata`                                     | `Uint8Array \| null` (a copy; `null` for `0x971A` headers) | `0x971A`, only when the header size is `0xAD0E`        |

- **Signature:** `parseHeader(bytes): [true, Header] | [false, ParseHeaderFailureReason[]]`.
- **`declaredSigning`** has no trailing space: the magic `CON ` becomes `'CON'`.
- **Format (R2):** `stfs | svod | unknown`, from the volume type at `0x3A9`. `not-a-package` is a separate outcome (§3.2). **PEC is not identified:** it has no magic, exists only inside profile packages, and detecting it would need a heuristic. Reading inside STFS packages is out of scope.
- **Content type and Title ID (R3):** named `declared…` because the directory decides both (§7.2). Content types are returned as numbers only; a names table may come later in `xcontent-types`.
- **Volume descriptor** (`0x379`): not parsed by R1 and not exposed. Its layout differs between STFS and SVOD, and functions with different return shapes are avoided. `parseSvodVolumeDescriptor` and `parseStfsVolumeDescriptor` may follow in the SVOD and STFS packages.

### 4.2 R4 `parseRestrictions`

Returns decoded facts, never verdicts such as `canUse`. Whether a modded console honours licences is ❓ (§2.2), so a verdict would claim more than is known. It is kept separate from R1.

- **Signature:** `parseRestrictions(bytes): [true, Restrictions] | [false, ParseRestrictionsFailureReason[]]`. Once the pre-checks pass, it always succeeds.

- **`licences`**: all 16 entries, including unused ones, so the function doesn't decide what counts as "unused" for the consumer.

  ```ts
  {
    index: number,                                    // 0–15
    licenseeType: { raw: number, decoded: LicenseeTypeName },  // raw e.g. 61440 (0xF000)
    licenseeData: string,                             // identifier (12): the low 48 bits
    bits: number,                                     // meaning not confirmed
    flags: number,                                    // meaning unknown
  }
  ```

  Licensee types (Velocity, ✅): `0xFFFF` unrestricted, `0x0009` Xbox Live account (XUID), `0x0003` Windows Live account, `0xF000` console, `0xE000` media flags, `0xD000` keyvault privilege, `0xC000` hypervisor flags, `0xB000` user privilege, `0x0000` unused, anything else unknown. The `decoded` names are `'unrestricted' | 'xboxLiveAccount' | 'windowsLiveAccount' | 'console' | 'mediaFlags' | 'keyvaultPrivilege' | 'hypervisorFlags' | 'userPrivilege' | 'unused' | 'unknown'`. Both `'unused'` and `'unknown'` are kept, because they mean different things: `'unused'` is the documented empty-entry type `0x0000`, and `'unknown'` is any undocumented type.

- **`transferFlags`** (`0x1711`): decoded. The bit order is 🔶 (§6.4); if it turns out wrong, that's a bug to fix later.

  ```ts
  transferFlags: {
    raw: number,          // e.g. 192 (0xC0); the unknown bits 0x02 and 0x01 stay visible here
    decoded: {
      canMoveToProfile: boolean,        // 0x80
      canMoveToDevice: boolean,         // 0x40
      moveOnly: boolean,                // 0x20: can be moved but not copied
      kinectEnabled: boolean,           // 0x10
      networkStorageDisabled: boolean,  // 0x08
      deepLinksSupported: boolean,      // 0x04
    },
  }
  ```

- **`creatorConsoleId`** (`0x36C`, identifier 10), **`profileId`** (`0x371`, identifier 16), **`deviceId`** (`0x3FD`, identifier 40).

### 4.3 R50 `parseConsoleCertificate`

Returns the `CON` certificate fields (§6.2), or `null` for `LIVE` and `PIRS`. Kept separate from R1, because it is needed less often and only applies to `CON`.

- **Signature:** `parseConsoleCertificate(bytes): [true, ConsoleCertificate | null] | [false, ParseConsoleCertificateFailureReason[]]`. No options.
- **Field types (agreed):** `publicKeyCertificateSize` (`number`), `ownerConsoleId` (identifier 10), `consolePartNumber` (text), `consoleType` (`{ raw, decoded: 'devkit' | 'retail' | 'unknown' }`: `0x01` devkit, `0x02` retail), `certificateDate` (text), `publicExponent` (`number`), `publicModulus` and `certificateSignature` (`Uint8Array` copies).
- **`certificateDate` is a `string`, never parsed into a date.** Its format is not known: the spec's §6.2 ("The certificate date field") records the evidence. Real values such as `11-06-09` could be month-day-year or day-month-year, with a two-digit year and no time zone. Parsing into a `Temporal.PlainDate` was considered and dropped for this reason, along with a `{ noTemporal }` option. The package has no dependency on `Temporal`, and never uses `Date`.

### 4.4 R51 `hasEmptySignature`

Says whether the signature is all zeros, which marks a tool-made package (§2.3).

- **Signature:** `hasEmptySignature(bytes): [true, boolean] | [false, HasEmptySignatureFailureReason[]]`. The second element on success is the answer.
- `LIVE` and `PIRS`: the `0x100` bytes at `0x004`
- `CON`: the `0x80`-byte package signature at `0x1AC`

Not provided: raw signature bytes, or recognising unlocker markers such as `ByromWasHereUnlockingYourGODGame` (§4.8). Consumers can slice `0x004`–`0x104` themselves. Revisit if a real need appears.

### 4.7 The `/extended` contract (decided 2026-10-14)

`xcontent-header/extended` exports the single-purpose field parsers and the pre-check, so callers can compose their own parsing.

- **`precheckHeader(bytes)`** runs the shared pre-checks (§3.2). It returns `[true, { declaredSigning, headerSize }] | [false, [PrecheckFailureReason]]`. Internally, V1 uses `precheckPaddedHeader`, which shares the magic and size steps but requires the padded header (`0xA000` or `0xB000` bytes). That one isn't exported.
- **Field parsers have a precondition only.** Each takes `(bytes)` and returns a plain value, not a result tuple. They assume the caller has run `precheckHeader` and it passed. On unchecked input, their behaviour is undefined, and they may throw. So the package-wide "no exceptions for bad input" rule applies to the API functions (R1 to V1) only.
- **`parseContentSize` and `parseDataFilesSize` return `bigint`,** which is always exact. R1 converts the value to `number`, and fails with `value-exceeds-max-safe-integer` if it doesn't fit.
- **`parseThumbnail` and `parseTitleThumbnail`** return a copy of the declared number of image bytes (from `0x171A` or `0x571A`), or `null` when the declared size is 0. A second precondition applies: the declared size must fit its space. Otherwise the copy would include bytes from the next field. **`parseThumbnailSizes(bytes)`** returns both declared sizes and the available space, so callers can check that precondition first.

### 4.5 R60 `equals`

Byte-for-byte equality of two headers, from `0x000` up to each header's size.

```ts
equals(a, b):
  | [true,  true,  []]                      // compared: identical
  | [true,  false, EqualsDifference[]]      // compared: not identical, with every reason
  | [false, false, EqualsFailureReason[]]   // a pre-check failed: nothing compared

type EqualsDifference =
  | { kind: 'header-size-differs'; a: number; b: number }
  | { kind: 'bytes-differ' }

type EqualsFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number }
```

- **Three elements:** success (`true` means the comparison ran, as in every other function: truthy is good), the answer, then the differences or the failure reason.
- **Differences are all listed** and never empty when the headers differ. When header sizes differ, the shared length is still compared, and `bytes-differ` is added if it differs too.
- **Fail fast:** `a`'s pre-checks run first, then `b`'s. The first failure ends the function, nothing is compared, and the single reason doesn't say which buffer failed. A caller who needs to know checks each buffer with a parse function.
- **Never compares past `0xAD0E`**, whatever the header claims and however long the buffer is.
- **No byte ranges.** `diff` says what differs. Without ranges, `equals` can stop at the first differing byte. (For reference, the worst case with ranges was measured at 22,151 ranges, about 0.3 ms and 1.6 MB.)

### 4.6 R61 `diff`

A field-by-field comparison. Each field is only `'same'` or `'different'`. The values themselves come from the parse functions.

```ts
diff(a, b): [true, Record<FieldName, 'same' | 'different'>] | [false, DiffFailureReason[]]
```

- **Same result pattern as the parse functions.** The failure reasons are the shared pre-check reasons, with no buffer tag. A comparison where fields differ is still a success: `[true, fields]`.
- **Fail fast,** exactly as `equals`.

**Contract: `diff` reports every field `'same'` exactly when `equals` returns `[true, true, []]`.** To keep it:

- Each key covers a range of raw bytes, padding included (string slot padding, thumbnail space after the image).
- The keys cover every byte of the header, from `0x000` up to the header size.
- One key per top-level property (for example `licences`, not `licences.0` to `licences.15`).
- Keys match parse result property names where one exists.

**Keys that apply to only some headers:** present in one header and not the other is `different`; present in both or absent from both is compared or `same`.

| Offset                   | Size      | Key                                            | Parsed by   |
| ------------------------ | --------- | ---------------------------------------------- | ----------- |
| `0x000`                  | 4         | `declaredSigning`                              | R1          |
| _`CON`:_ `0x004`         | `0x1A8`   | `certificate`                                  | R50         |
| _`CON`:_ `0x1AC`         | `0x80`    | `signature`                                    | (R51)       |
| _`LIVE`/`PIRS`:_ `0x004` | `0x100`   | `signature`                                    | (R51)       |
| _`LIVE`/`PIRS`:_ `0x104` | `0x128`   | `signaturePadding`                             | not exposed |
| `0x22C`                  | `0x100`   | `licences`                                     | R4          |
| `0x32C`                  | `0x14`    | `contentId`                                    | R1          |
| `0x340`                  | 4         | `headerSize`                                   | R1          |
| `0x344`                  | 4         | `declaredContentType`                          | R1          |
| `0x348`                  | 4         | `metadataVersion`                              | R1          |
| `0x34C`                  | 8         | `contentSize`                                  | R1          |
| `0x354`                  | 4         | `mediaId`                                      | R1          |
| `0x358`                  | 4         | `version`                                      | R1          |
| `0x35C`                  | 4         | `baseVersion`                                  | R1          |
| `0x360`                  | 4         | `declaredTitleId`                              | R1          |
| `0x364`                  | 1         | `platform`                                     | R1          |
| `0x365`                  | 1         | `executableType`                               | R1          |
| `0x366`                  | 1         | `discNumber`                                   | R1          |
| `0x367`                  | 1         | `discCount`                                    | R1          |
| `0x368`                  | 4         | `saveGameId`                                   | R1          |
| `0x36C`                  | 5         | `creatorConsoleId`                             | R4          |
| `0x371`                  | 8         | `profileId`                                    | R4          |
| `0x379`                  | `0x24`    | `volumeDescriptor`                             | not exposed |
| `0x39D`                  | 4         | `dataFileCount`                                | R1          |
| `0x3A1`                  | 8         | `dataFilesSize`                                | R1          |
| `0x3A9`                  | 4         | `format`                                       | R1          |
| `0x3AD`                  | 8         | `onlineCreator`                                | R1          |
| `0x3B5`                  | 4         | `category`                                     | R1          |
| `0x3B9`                  | `0x20`    | `reserved`                                     | not exposed |
| `0x3D9`                  | `0x24`    | `mediaOrAvatarData`                            | R1          |
| `0x3FD`                  | `0x14`    | `deviceId`                                     | R4          |
| `0x411`                  | `0x900`   | `displayNames`                                 | R1          |
| `0xD11`                  | `0x900`   | `descriptions`                                 | R1          |
| `0x1611`                 | `0x80`    | `publisherName`                                | R1          |
| `0x1691`                 | `0x80`    | `titleName`                                    | R1          |
| `0x1711`                 | 1         | `transferFlags`                                | R4          |
| `0x1712` + `0x171A`      | 4 + space | `thumbnail` (size field and image space)       | R1          |
| `0x1716` + `0x571A`      | 4 + space | `titleThumbnail` (size field and image space)  | R1          |
| `0x971A`                 | `0x15F4`  | `installerMetadata`, only for `0xAD0E` headers | R1          |

In metadata version 2, each thumbnail's space is `0x3D00`. The freed `0x300` bytes belong to the extra languages: `0x541A`–`0x571A` to `displayNames`, and `0x941A`–`0x971A` to `descriptions`. The ranges were checked to be contiguous in all four layouts (`CON` or `LIVE`/`PIRS`, metadata version 1 or 2).

**Not exposed** means there is no public parse function: `signaturePadding`, `reserved` and `volumeDescriptor` have no meaning worth parsing now. V1 will use internal functions for them.

---

## 5. V1 `verifyHeaderAsync`

The full design, including the check table, is in [function-design-doc.md](function-design-doc.md) (V1). Decided:

- **Async**, because the content ID check needs SHA-1 from `globalThis.crypto.subtle`. It's the only async function.
- **Result follows `equals`:** `Promise<[true, valid, Finding[]] | [false, false, VerifyFailureReason[]]>`. A pre-check failure is the usual separate outcome, not a finding, and V1 fails fast like every other function.
- **Needs the padded header.** The content ID is the SHA-1 of `0x344` up to the padded end (`0xA000` or `0xB000`), not up to the header size. This was confirmed on 2026-10-13 against all 772 available real packages (591 on the USB drive, 181 in the local copy), and the spec's §6.1, §6.3 and §8.3 were corrected. V1's last size pre-check therefore requires `0xA000` or `0xB000` bytes. Every other function still requires only the header size, so they don't need more bytes. The README tells callers to read `0xB000` bytes.
- **Detects the format from the header.** It doesn't accept an expected format.
- **Collects every finding,** skipping checks that depend on one that failed.
- **Findings have a single shape:** `code`, `severity` (`error | warning | info`), `confidence` (`verified | widely-reported | unconfident`, the spec's ✅ 🔶 ❓), `specRef`, `field` (a `diff` key) and `message`. Details specific to a check go in the brief English `message`. A hex value longer than 16 digits is truncated to its first 6 and last 6 digits, with its length noted: `1BD319…4E02C3 (40 digits, truncated)`.
- **Severity reflects how strictly a requirement is enforced** by the console and other projects (xenia and Velocity in particular), not the spec's confidence marks, which turned out to be a poor guide. Non-strict mode is permissive: an error only when we're quite certain the header is incorrect. Severities will be tuned by hand over time. Any finding that isn't an error or a warning is `info`, and `info` never fails validation. (An earlier rule, ✅ → error and 🔶/❓ → warning, was replaced.)
- **`{ strictMode: true }`** makes warnings fail validation too (`[true, false, …]`). Off by default.
- **Each check is an internal single-purpose function,** whose JSDoc points to its spec section and states the rule's confidence as `verified`, `widely-reported` or `unconfident`. No emoji in source code.
- **The check list is agreed** (see the design doc). Dropped: "an SVOD header file is exactly `0xB000` bytes", which moves to the SVOD package.
- **Severities are agreed** (2026-10-13), from the severity chart in the design doc (V1), researched from the source of Velocity, xenia, rom-properties, py360, acceleration, emoose's template, iso2god-rs, Iso2God and XeBuild, plus kernel patch sources. Errors: `content-id-mismatch`, `thumbnail-exceeds-space`, `volume-type-unknown`, `console-type-unknown`. Warnings: `volume-descriptor-length`, `stfs-has-data-files`, `metadata-version-unknown`, `text-unpaired-surrogate`, `licensee-type-unknown`, `value-exceeds-max-safe-integer`. Info: `thumbnail-not-png`, `thumbnail-truncated` (tool-made GODs commonly have non-PNG thumbnails), `content-type-unknown`, `transfer-flags-unknown-bits`, `reserved-not-zero`, `signature-padding-not-zero`, `signature-empty`.

**JSDoc states the bytes each function requires, per header size:** for V1, `0xA000` bytes when the header size at `0x340` is `0x971A` and `0xB000` when it is `0xAD0E`; for every other function, `0x971A` and `0xAD0E` bytes respectively. `0xB000` bytes always suffices.

**JSDoc style:** no parameter or return types (the source is TypeScript). Plain-English commentary on what, why and how. A short first paragraph, since editors show it on hover; extra context in later paragraphs, only when genuinely useful.

## 6. Runtime and packaging

### 6.1 Runtime

- **Node:** `"engines": { "node": ">=22" }`. Node 22 supports ES2024 in full, and Vitest 5 needs Node 22.12+ to run the tests. (Node 20, considered earlier, is end of life and can't run Vitest 5.)
- **`target` and `lib`:** `es2024`. The browser minimum is therefore roughly Chrome 119, Firefox 121 and Safari 17.4 (early 2024).
- **Web APIs** are declared in a small `src/runtime.d.ts`, not through a `lib` such as `dom` or `types` such as `node`, which would allow a whole platform's globals:
  - `globalThis.crypto.subtle.digest('SHA-1', …)`, used only by V1
  - `TextDecoder`, used for all text
- **No bundled crypto code.**
- **Prefer documented APIs to hand-written code.** For example, `TextDecoder` rather than decoding UTF-16 by hand.
- **Hex identifiers:** `Uint8Array.prototype.toHex()` would do this, but isn't available before Node 25. A shared util `toHex(bytes)` does the same, with JSDoc pointing to `Uint8Array.prototype.toHex`, so it can be swapped out later. It uses `Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase()`. `Number.prototype.toString(16)` alone can't do it: identifiers are up to 20 bytes, far beyond a `number`, and leading zero bytes must be kept.
- **Browser compatibility comes from:** ESM only, no imports of Node's built-in modules, and only the globals in `runtime.d.ts`.
- **Public types** use only `Uint8Array`, `Promise` and plain types, so consumers need no DOM or Node type libraries.

### 6.2 README requirements

- "Works in browsers and any runtime that ships `globalThis.crypto.subtle` and `TextDecoder`, including Node >= 22, Deno, and Bun." Browsers only expose `crypto.subtle` in secure contexts (https or localhost).
- For developers: running the tests needs Node 22.12+ (Vitest 5).
- Callers should read `0xB000` bytes, which covers every function.
- The package-wide rules in §3.3: pre-check failures end a function early, and the order of reasons is not part of the contract.

### 6.3 Project setup (decided 2026-10-13)

- **Location:** `packages/xcontent-header/`. The name `xcontent-header` is free on npm.
- **Licence (decided 2026-10-14):** `AGPL-3.0-only`, for `xcontent-header` only. The package has its own `LICENSE` (the GNU AGPL v3 text from gnu.org), which ships in the npm tarball. The rest of the repo isn't licensed yet.
- **Package manager:** pnpm 12 for the whole repo, pinned with the `packageManager` field (Corepack isn't bundled with Node 25+). CI's pnpm version (`deploy.yml`, currently 11.1.3) moves to 12 too.
- **TypeScript 7** (the native Go compiler) builds and type-checks. typescript-eslint doesn't support 7 yet, because 7.0 has no programmatic API, so TypeScript 6 is installed alongside: `"typescript": "npm:@typescript/typescript6@^6.0.2"` (used by typescript-eslint; its binary is `tsc6`) and `"@typescript/native": "npm:typescript@^7.0.2"` (binary `tsc`). Drop the alias once typescript-eslint supports 7.
- **Linting:** typescript-eslint's strictest bundled config, `strictTypeChecked`.
- **Formatting (decided 2026-10-14):** Prettier 3.9, still the most widely used formatter (Biome and oxfmt are gaining ground, mainly on speed). It applies to `xcontent-header` only, and to every file type Prettier supports there. Config: `printWidth: 120`, `singleQuote: true`, `arrowParens: 'always'`; otherwise Prettier's defaults (semicolons, trailing commas `all`). `format:check` is part of the gate.
- **Imports and exports (decided 2026-10-14):** one statement per module, for imports and `export ... from` alike (ESLint's `no-duplicate-imports` with `includeExports`). When a module provides both values and types, the types get an inline `type` marker; a statement with only types uses `import type` / `export type` (enforced by `@typescript-eslint/no-import-type-side-effects`). `tsc` itself requires the `type` markers, under `verbatimModuleSyntax`, so `consistent-type-imports` and `consistent-type-exports` aren't used.
- **Generated files** are named `*.generated.ts`, start with an `@generated` header comment, are marked `linguist-generated` in the package's `.gitattributes` (so GitHub collapses them in pull request diffs), and are skipped by Prettier.
- **Two tsconfigs:**
  - `tsconfig.json`: `src/` without tests, `types: []`, emits JS and source maps to `dist/js/`, and `.d.ts` and declaration maps to `dist/types/`.
  - `tsconfig.test.json`: `src/` with tests, `types: ["node"]` so tests can read fixture files, no emit. Library code can never use Node APIs.
- **Strict options** (on top of TypeScript 6+'s default `strict`): `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `verbatimModuleSyntax`, `isolatedModules`, `isolatedDeclarations`, `erasableSyntaxOnly`, `forceConsistentCasingInFileNames`, `skipLibCheck: false`. `module: nodenext`.
- **`package.json`:** `"type": "module"`; `"sideEffects": false` (lets bundlers drop unused modules; the package has no import-time side effects); `exports` with `types` and `default` conditions for `.` and `./extended`; `"files": ["dist", "src"]` without tests, since the source maps point at `src/`.
- **Exports:** API functions from the root; single-purpose field parsers and `precheckHeader` from `xcontent-header/extended` (§4.7). V1's checks stay internal; more can be exported later if needed.
- **Tests:** Vitest 5, with explicit imports from `vitest` (no globals).
- **Structure (decided 2026-10-14):** three verticals, as folders: `src/parse/` (R1, R4, R50, R51), `src/compare/` (R60, R61) and `src/verify/` (V1), plus `src/shared/` for code that more than one vertical needs.
  - **Imports:** verticals never import each other; any vertical may import `shared/`. `src/index.ts` and `src/extended.ts` are the only composition points.
  - **Field parsers:** all single-purpose field parsers live in `src/shared/`, because compare and verify need them as well as parse.
  - **Public and internal code are kept apart by folder.** A vertical's (or `shared/`'s) top-level files are public: an API function, or a function exported from `/extended`. Everything else goes in `<vertical>/internal/` and is never exported. An ESLint `no-restricted-imports` rule stops `index.ts` and `extended.ts` from importing any `internal/` path.
  - **For example:** `src/shared/` holds the field parsers, `parseThumbnailSizes` and `precheckHeader`. `src/shared/internal/` holds the byte readers, `toHex`, text decoding, layout constants, `precheckPaddedHeader` and the field range table. `src/verify/internal/` holds V1's checks.
  - `CLAUDE.md` says the same.
- **Fixtures:** the first `0xB000` bytes of 11 real packages, in `src/__tests__/fixtures/` (see §9).

## 7. Shelved

- **W1 (edit header fields).** Shelved to keep the first scope small. Notes for later: editing metadata changes the content ID, which must then be recomputed. Any edit breaks the signature. `LIVE` and `PIRS` can't be re-signed, and re-signing `CON` needs a console keyvault, which is out of scope. Structural fields (header size, volume descriptor, data file count, combined size, volume type, metadata version) must not be editable.
- **B1 (bulk-verify a title).** May move to the web package. Notes: a header's Title ID or content type disagreeing with its directory is an observation, not an error (§7.2). The §7.3 invalid layouts belong here.
- **V2 (verify an SVOD package).** Moves to the SVOD package. Notes:
  - Input: the `.data` directory's entries as `{ name, kind, size }[]`, or `null` when the directory is missing (a different finding from an empty directory, §7.3).
  - Structural checks need only those entries. An optional first `0x2014` bytes of `Data0000` would allow an ownership check (the SHA-1 of its first hash table against the header) and a disc magic check.
  - The data file layout (a level-1 hash table, then 203 × (level-0 table + `0x198` blocks of `0x800`)) was reconstructed from §6.7's numbers and must be verified against xenia and added to the spec first. It's also unknown whether each file's table chains to the next file.
  - Full hash verification is a separate, later, streaming function.
- **PEC identification.** Dropped (§4.1).

---

## 8. Spec changes made during this design

- **§6.5 languages:** metadata version 2's slots 9–11 researched. Slot 10 is Polish and slot 11 Russian (✅, confirmed by the _South Park_ fixture); slot 9 is Simplified Chinese (🔶). There are no slots beyond language ID 12. Sources added to §8.9.
- **§6.5:** "a reader should skip them" (empty slots) changed to "should treat them as empty", to match keeping empty slots as `null`.

---

## 9. Fixtures

The first `0xB000` bytes of 11 real packages, in `packages/xcontent-header/src/__tests__/fixtures/` (copied 2026-10-13; not staged or committed). Eight come from the local real-content copy (`fixtures/Content`, a symlink to `~/Documents/XboxContent/`, now in `.gitignore`), and three are the good fixtures from the old `xcontent` package:

| Fixture                              | Covers                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `con-971a-mv2-xna-save`              | `CON`, `0x971A` header, metadata version 2, an XNA indie save                    |
| `con-971a-mv0-download-in-progress`  | `CON`, `0x971A`, metadata version 0, a download in progress (§4.4), no thumbnail |
| `con-ad0e-svod-disc-install`         | `CON` with a `0xAD0E` header, SVOD, a disc install                               |
| `live-stfs-dlc-non-ascii`            | `LIVE` STFS DLC, display name with `™`                                           |
| `live-stfs-mv0-title-update`         | `LIVE` STFS title update, metadata version 0, display name with `®`              |
| `live-svod-god-empty-signature`      | `LIVE` SVOD GOD made by a tool: all-zero signature                               |
| `pirs-stfs-dlc-non-ascii`            | `PIRS` STFS DLC, display name with `’`                                           |
| `pirs-stfs-avatar-item-no-thumbnail` | `PIRS` avatar item, thumbnail size 0                                             |
| `live-stfs-dlc-halo-wars`            | `LIVE` STFS DLC (old fixture, trimmed to `0xB000`)                               |
| `live-svod-god-dead-island-riptide`  | `LIVE` SVOD GOD (old fixture)                                                    |
| `live-svod-god-south-park-mojibake`  | `LIVE` SVOD GOD with UTF-8 stored as UTF-16BE (old fixture)                      |

- **Not covered:** a non-PNG thumbnail (none in the local copy; Iso2God-made GODs on the USB drive would have one) and a profile partition package.
- **The old `dlc-halo-reach-anniversary` fixture was dropped:** it is only `0x6000` bytes, but its header size is `0xAD0E`.
- **Personal identifiers were removed** (2026-10-13), and replaced with obvious placeholders:

  | Field                                                                   | Placeholder                                     |
  | ----------------------------------------------------------------------- | ----------------------------------------------- |
  | console IDs: certificate `0x006`, creator `0x36C`, and console licences | `0123456789`                                    |
  | `CON` public modulus, certificate signature and package signature       | `0xA5` repeated, so the signature isn't "empty" |
  | XUID licences' licensee data                                            | `000000000001`                                  |
  | profile ID `0x371`                                                      | `0009000000000001`                              |
  | device ID `0x3FD` (a drive serial number, in ASCII)                     | `FIXTURE0DEVICE0ID000`                          |

  Where a placeholder sits inside the content ID's range (`0x344` on), the content ID was recomputed, so every fixture still passes V1's content ID check. Signatures no longer match, but nothing verifies them. The `0x971A` `CON` fixtures were trimmed to `0xA000`, the end of their padded header, which drops the start of their data area. A search of every fixture, at every offset, found none of the original identifiers or key material. Certificate part numbers and dates were kept: they identify a hardware model and batch, not a console.
