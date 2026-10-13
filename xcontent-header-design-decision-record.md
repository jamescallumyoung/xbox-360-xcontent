# `xcontent-header`: design decision record

**Status:** in design. No code yet. Last updated 2026-10-13.

This records the decisions made while designing the public API of `xcontent-header`, the first of the new packages that replace `xcontent`, `xcontent-web` and `app`. It's for James and for any agent continuing the work. The format reference is [xcontent-spec2.md](xcontent-spec2.md). Section numbers (§) below refer to it.

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

| ID | Function | Status |
|---|---|---|
| R1 | `parseHeader` | decided. R2 (format) and R3 (content type) are part of it. |
| R4 | `parseRestrictions` | decided |
| R50 | `parseConsoleCertificate` | decided (field types open, §4.3) |
| R51 | `hasEmptySignature` | decided |
| R60 | `equals` | decided |
| R61 | `diff` | decided |
| V1 | `verifyHeaderAsync` | findings design pending (§5) |
| V2 | verify an SVOD package | shelved; moves to the SVOD package (§7) |
| B1 | bulk-verify a title | shelved; may move to the web package |
| W1 | edit header fields | shelved |

---

## 2. Conventions

### 2.1 Function names

- **`parse…`** for every function that decodes bytes into values. They take data already in memory, like `JSON.parse`. Unlike `JSON.parse`, they never throw on bad input: they return failure reasons (§3).
- **`…Async`** only on V1, the only async function. There is no sync twin. The suffix marks it out from every other function, which is sync.
- **`equals` and `diff`**, without a `headers` qualifier. Consumers can rename on import (`import { diff as diffHeaders }`).
- **Exports:** the composite functions from the package root. The single-purpose parsers from a subpath, such as `xcontent-header/…`. Single-purpose verification checks stay internal.

### 2.2 How values are represented

There are no floating-point values in the header.

| Kind of value | Type | Rule |
|---|---|---|
| **Truly opaque identifiers** | `string` | uppercase hex, no `0x` prefix, zero-padded to the field's full width (2 digits per byte). They are strings that happen to look like hex, matching how directory names and the spec write them. Example: Title ID `0x1` is `00000001`. |
| **Quantities** (sizes, counts, versions, disc numbers) | `number` | |
| **Bit fields** (licence bits and flags, transfer flags) | `number` | so consumers can use bitwise operators |
| **Lookup codes** (content type, volume type, licensee type, metadata version) | `number` | |
| **Text** | `string \| null` | see §2.4 |
| **Images** | `Uint8Array \| null` | see §2.5 |

The identifiers, with their width in hex digits:

| Identifier | Digits |
|---|---|
| `declaredTitleId`, `mediaId`, `saveGameId` | 8 |
| console IDs (certificate owner `0x006`, creator `0x36C`) | 10 |
| `licenseeData` | 12 |
| `profileId`, `onlineCreator` | 16 |
| `deviceId`, `contentId` | 40 |

A profile ID of zero (eight zero bytes) is `0000000000000000`.

**64-bit quantities.** Content size (`0x34C`) and combined data file size (`0x3A1`) are 8-byte fields. Real values are far below 2⁵³ (the largest realistic package, a dual-layer GOD, is about 8 GiB), so they are `number`. A value above `Number.MAX_SAFE_INTEGER` is treated as malformed, and `parseHeader` fails with `value-exceeds-max-safe-integer` (§3.3). That reason carries the raw value, so a consumer who knows better can build a `bigint` themselves.

**Content type** is a `number` (for example `28672` for `0x00007000`), not an identifier.

### 2.3 Three naming patterns for header values

| Pattern | Meaning | Used for |
|---|---|---|
| `declared…` prefix | What the header **claims**, when something outside the header decides the truth (the directory, or the signature). | `declaredTitleId`, `declaredContentType`, `declaredSigning` |
| `{ declared, effective }` | The stored value, plus how readers **interpret** it under a known rule. | `metadataVersion` only |
| `{ raw, decoded }` | The stored value, plus a **lookup** of its meaning. | `format`, `licenseeType`, `transferFlags`, `consoleType` (proposed) |

Why not `{ declared, effective }` for lookups: "effective" would suggest the console treats the value differently from what's stored. Only the metadata version has such a rule (readers treat any value other than 2 as version 1, §6.1).

### 2.4 Text

- **Encoding:** UTF-16BE (§6.5).
- **Termination:** a string ends at the first `0x0000` code unit, like a C `char16_t[]`. If a field has no `0x0000`, the string uses the field's full width. Code units are read in 2-byte steps from the field's start, so a character such as "0" (`00 30`) is never mistaken for the terminator.
- **Empty fields** (first unit `0x0000`) are `null`.
- **Lossless:** every code unit is kept exactly as stored, including unpaired surrogates (the only way UTF-16 can be malformed). No replacement with U+FFFD, and no failure. Consumers can use `String.prototype.isWellFormed()` and `toWellFormed()` (ES2024, Node 20+, current browsers). V1 can report unpaired surrogates.
- **No repair:** text stored as UTF-8 inside UTF-16BE (the *South Park* fixture) is returned as decoded. Undoing it would be a heuristic.

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
  English: 0, Japanese: 1, German: 2, French: 3, Spanish: 4,
  Italian: 5, Korean: 6, TraditionalChinese: 7, Portuguese: 8,
  Polish: 10, Russian: 11,
} as const
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

| Reason | Raised by | Returned by |
|---|---|---|
| `insufficient-bytes` | magic check, header size check | all functions. **One shared type** for R1, R4, R50 and R51. |
| `not-a-package` | magic check | all functions |
| `header-size-invalid` | header size check | all functions |
| `value-exceeds-max-safe-integer` | parsing | `parseHeader` only |
| `value-out-of-range` | parsing | `parseHeader` only |

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

| Condition | Result |
|---|---|
| metadata version other than 0, 1 or 2 | `{ declared: 7, effective: 1 }` |
| volume type other than 0 or 1 | `format: { raw: 5, decoded: 'unknown' }` |
| unknown content type | its `number` |
| unknown licensee type | `{ raw, decoded: 'unknown' }` |
| any identifier, including all zeros | its hex string |
| unpaired surrogates in text | kept as they are (§2.4) |
| text stored as UTF-8 inside UTF-16BE | returned as decoded (§2.4) |

**What parsing can't detect.** The header has no markers between fields: a byte's meaning comes only from its offset. So parsing can't tell whether an image spilled past its space while declaring a size that fits. V1 can find most such cases indirectly: an image whose PNG structure doesn't end at the declared size, or, in version 1, a title thumbnail that no longer starts with the PNG signature.

Type names follow the pattern `ParseHeaderFailureReason`, `ParseRestrictionsFailureReason` and so on.

---

## 4. Functions

### 4.1 R1 `parseHeader`

Answers "what is this package?": the identity steps of §6.9 plus the display information.

| Field | Type | Source |
|---|---|---|
| `declaredSigning` | `'CON' \| 'LIVE' \| 'PIRS'` | `0x000` |
| `contentId` | identifier (40) | `0x32C` |
| `headerSize` | `number` | `0x340` |
| `declaredContentType` | `number` | `0x344` |
| `metadataVersion` | `{ declared: number, effective: 1 \| 2 }` | `0x348` |
| `contentSize` | `number` | `0x34C` |
| `mediaId` | identifier (8) | `0x354` |
| `version`, `baseVersion` | `number` | `0x358`, `0x35C` |
| `declaredTitleId` | identifier (8) | `0x360` |
| `platform`, `executableType`, `discNumber`, `discCount` | `number` | `0x364`–`0x367` |
| `saveGameId` | identifier (8) | `0x368` |
| `dataFileCount` | `number` | `0x39D` |
| `dataFilesSize` | `number` | `0x3A1` |
| `format` | `{ raw: number, decoded: 'stfs' \| 'svod' \| 'unknown' }` | `0x3A9` |
| `onlineCreator` | identifier (16) | `0x3AD` |
| `category` | `number` | `0x3B5` |
| `mediaOrAvatarData` | `Uint8Array \| null` (a copy; `null` in version 1) | `0x3D9`, version 2 only |
| `displayNames`, `descriptions` | `(string \| null)[]` (9 or 12) | `0x411`, `0xD11`, plus `0x541A`, `0x941A` in version 2 |
| `publisherName`, `titleName` | `string \| null` | `0x1611`, `0x1691` |
| `thumbnail`, `titleThumbnail` | `Uint8Array \| null` | `0x1712` + `0x171A`, `0x1716` + `0x571A` |
| `installerMetadata` | `Uint8Array \| null` (a copy; `null` for `0x971A` headers) | `0x971A`, only when the header size is `0xAD0E` |

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

| Offset | Size | Key | Parsed by |
|---|---|---|---|
| `0x000` | 4 | `declaredSigning` | R1 |
| *`CON`:* `0x004` | `0x1A8` | `certificate` | R50 |
| *`CON`:* `0x1AC` | `0x80` | `signature` | (R51) |
| *`LIVE`/`PIRS`:* `0x004` | `0x100` | `signature` | (R51) |
| *`LIVE`/`PIRS`:* `0x104` | `0x128` | `signaturePadding` | not exposed |
| `0x22C` | `0x100` | `licences` | R4 |
| `0x32C` | `0x14` | `contentId` | R1 |
| `0x340` | 4 | `headerSize` | R1 |
| `0x344` | 4 | `declaredContentType` | R1 |
| `0x348` | 4 | `metadataVersion` | R1 |
| `0x34C` | 8 | `contentSize` | R1 |
| `0x354` | 4 | `mediaId` | R1 |
| `0x358` | 4 | `version` | R1 |
| `0x35C` | 4 | `baseVersion` | R1 |
| `0x360` | 4 | `declaredTitleId` | R1 |
| `0x364` | 1 | `platform` | R1 |
| `0x365` | 1 | `executableType` | R1 |
| `0x366` | 1 | `discNumber` | R1 |
| `0x367` | 1 | `discCount` | R1 |
| `0x368` | 4 | `saveGameId` | R1 |
| `0x36C` | 5 | `creatorConsoleId` | R4 |
| `0x371` | 8 | `profileId` | R4 |
| `0x379` | `0x24` | `volumeDescriptor` | not exposed |
| `0x39D` | 4 | `dataFileCount` | R1 |
| `0x3A1` | 8 | `dataFilesSize` | R1 |
| `0x3A9` | 4 | `format` | R1 |
| `0x3AD` | 8 | `onlineCreator` | R1 |
| `0x3B5` | 4 | `category` | R1 |
| `0x3B9` | `0x20` | `reserved` | not exposed |
| `0x3D9` | `0x24` | `mediaOrAvatarData` | R1 |
| `0x3FD` | `0x14` | `deviceId` | R4 |
| `0x411` | `0x900` | `displayNames` | R1 |
| `0xD11` | `0x900` | `descriptions` | R1 |
| `0x1611` | `0x80` | `publisherName` | R1 |
| `0x1691` | `0x80` | `titleName` | R1 |
| `0x1711` | 1 | `transferFlags` | R4 |
| `0x1712` + `0x171A` | 4 + space | `thumbnail` (size field and image space) | R1 |
| `0x1716` + `0x571A` | 4 + space | `titleThumbnail` (size field and image space) | R1 |
| `0x971A` | `0x15F4` | `installerMetadata`, only for `0xAD0E` headers | R1 |

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

- **Crypto:** `globalThis.crypto.subtle`. No bundled crypto code.
- **`engines`:** `"node": ">=20"`, the actual minimum that can run the package.
- **README notice:** "Works in browsers and any runtime that ships `globalThis.crypto.subtle`, including Node >= 20, Deno, and Bun." Also note that browsers only expose `crypto.subtle` in secure contexts (https or localhost). It must also note the package-wide rules in §3.3: pre-check failures end a function early, and the order of reasons is not part of the contract.
- **Browser compatibility comes from:** ESM only, no imports of Node's built-in modules, only standard globals.
- **TypeScript:** public types use only `Uint8Array`, `Promise` and plain types, so consumers need no DOM or Node type libraries. The package's own `tsconfig` needs a `lib` that declares `crypto`.
- **Open:** project setup (monorepo location, test framework, build).

---

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

- **§6.5 languages:** metadata version 2's slots 9–11 researched. Slot 10 is Polish and slot 11 Russian (✅, confirmed by the *South Park* fixture); slot 9 is Simplified Chinese (🔶). There are no slots beyond language ID 12. Sources added to §8.9.
- **§6.5:** "a reader should skip them" (empty slots) changed to "should treat them as empty", to match keeping empty slots as `null`.

---

## 9. Fixture note

The four real-header fixtures in the old `xcontent` package are data from real drives, not old code. Whether to reuse them is part of project setup. If they are reused:

- **`dlc-halo-reach-anniversary` is incomplete:** the file is `0x6000` bytes (24 KiB), but its header size is `0xAD0E`, and its title thumbnail is cut off. Under §3.1, `parseHeader` returns `insufficient-bytes` for it. Replace it with the first `0xB000` bytes of the same package.
- In the other three, both thumbnails fit their space, and each PNG's chunks add up exactly to the declared size.
