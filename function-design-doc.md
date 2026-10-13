# `xcontent-header`: function design

One design per public function of `xcontent-header`. Each section stands on its own: it repeats every convention it relies on, so it can be read, reviewed or implemented without the others. The package-wide rules below are also repeated in each section where they apply.

- **Format reference:** [xcontent-spec2.md](xcontent-spec2.md). "§" means a section of it.
- **Decision history and rationale:** [xcontent-header-design-decision-record.md](xcontent-header-design-decision-record.md).
- **Status:** in design, no code yet. Last updated 2026-10-13.

Every statement in this document is one of:

- **Decided:** agreed during design. No marker.
- **Inferred:** follows from decisions already made, but was never discussed on its own. Marked *(inferred)*. Confirm before implementing.
- **Open:** not decided. Marked **Open**.

| ID | Function | Section |
|---|---|---|
| R1 | `parseHeader` | [R1](#r1-parseheader) |
| R4 | `parseRestrictions` | [R4](#r4-parserestrictions) |
| R50 | `parseConsoleCertificate` | [R50](#r50-parseconsolecertificate) |
| R51 | `hasEmptySignature` | [R51](#r51-hasemptysignature) |
| R60 | `equals` | [R60](#r60-equals) |
| R61 | `diff` | [R61](#r61-diff) |
| V1 | `verifyHeaderAsync` | [V1](#v1-verifyheaderasync) |

---

## Package-wide API rules

These rules apply to every function. They belong in the package's API documentation (the README), as well as here.

1. **Result tuples.** Every synchronous function returns a tuple whose first element says whether it succeeded. `true` always means success. R1, R4, R50, R51 and R61 return two elements. When the first is `true`, the second element is the result. When it's `false`, the second element is a list of failure reasons. Callers check the first element to know what the second holds:

   ```ts
   const [ok, value] = parseHeader(bytes)
   if (ok) { /* value is a Header */ } else { /* value is a list of failure reasons */ }
   ```

   TypeScript narrows `value` from `ok` when both are declared with `const`.

   `equals` (R60) returns three elements: success, then the answer, then the differences or the failure reason. See R60.

2. **Pre-checks end a function early.** Every function first checks its input (enough bytes, a valid magic, a valid header size). When a pre-check fails, the function returns straight away. It parses or compares nothing else.

3. **The order of reasons is not part of the contract.** When a function returns more than one reason, their order is deterministic: the same input gives the same order every time. But it may change between versions without warning, so callers must not rely on it.

4. **No exceptions for bad input.** Malformed, truncated or unrelated bytes produce failure reasons, never thrown errors.

5. **JSDoc states the bytes each function requires,** for each header size, so callers don't have to infer it:
   - **V1:** `0xA000` bytes when the header size stored at `0x340` is `0x971A`; `0xB000` bytes when it is `0xAD0E`.
   - **Every other function:** `0x971A` bytes when the header size stored at `0x340` is `0x971A`; `0xAD0E` bytes when it is `0xAD0E`.
   - **Always enough:** `0xB000` bytes. The README tells callers to read this much.

6. **JSDoc style.** The source is TypeScript, so JSDoc doesn't repeat parameter or return types. It explains, in plain English, what a function does, why, and how to use it. The first paragraph is short, because many editors show it on hover. Extra context and observations go in later paragraphs, and only when they're genuinely useful.

   **Internal check functions.** Each V1 check is its own single-purpose internal function. Its JSDoc points to the spec section that defines the rule, and states the rule's confidence as `verified`, `widely-reported` or `unconfident` (the spec's ✅, 🔶 and ❓). Source code doesn't use the spec's emoji.

7. **Runtime.** The package needs `globalThis.crypto.subtle` (for V1). The README is to say: "Works in browsers and any runtime that ships `globalThis.crypto.subtle`, including Node >= 20, Deno, and Bun." `engines` is `"node": ">=20"`. The package doesn't use `Temporal` or `Date`.

---

## R1 `parseHeader`

### Summary

Decodes a package header held in memory into the values that answer "what is this package?": the signature type it declares, its format (STFS or SVOD), the content type and Title ID it declares, its metadata version, sizes, identifiers, display strings and thumbnails. It reads every field from its fixed offset (§6.1–§6.5), does no I/O, and never throws on bad input.

R1 includes the earlier R2 (identify the package format) and R3 (identify the declared content type).

### Signature

```ts
function parseHeader(bytes: Uint8Array): [true, Header] | [false, ParseHeaderFailureReason[]]
```

The parameter name is a placeholder. The function is synchronous. JSDoc must state the bytes required: from `0x000` up to the header size stored at `0x340`. That is `0x971A` bytes when the stored value is `0x971A`, and `0xAD0E` bytes when it is `0xAD0E`. Reading `0xB000` bytes always suffices.

### Return type

```ts
type ParseHeaderFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }        // shared with R4, R50 and R51
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number }
  | { kind: 'value-exceeds-max-safe-integer'; field: 'contentSize' | 'dataFilesSize'; raw: string }
  | { kind: 'value-out-of-range'; field: 'thumbnail' | 'titleThumbnail'; declaredSize: number; availableSpace: number }
```

- `raw` is `0x` followed by 16 uppercase hex digits.
- The name follows the threshold, `Number.MAX_SAFE_INTEGER` (2⁵³ − 1): the largest integer a `number` holds exactly. It's not `Number.MAX_VALUE` (about 1.8 × 10³⁰⁸).

`Header` holds these properties:

| Property | Type | Offset | Notes |
|---|---|---|---|
| `declaredSigning` | `'CON' \| 'LIVE' \| 'PIRS'` | `0x000` | The magic `CON ` has a trailing space in the file; the value `'CON'` doesn't. |
| `contentId` | `string`, 40 hex digits | `0x32C` | |
| `headerSize` | `number` | `0x340` | Always `0x971A` or `0xAD0E` in a success result. |
| `declaredContentType` | `number` | `0x344` | For example `28672` (`0x00007000`). |
| `metadataVersion` | `{ declared: number; effective: 1 \| 2 }` | `0x348` | |
| `contentSize` | `number` | `0x34C` | 8-byte field. |
| `mediaId` | `string`, 8 hex digits | `0x354` | |
| `version` | `number` | `0x358` | |
| `baseVersion` | `number` | `0x35C` | |
| `declaredTitleId` | `string`, 8 hex digits | `0x360` | |
| `platform` | `number` | `0x364` | |
| `executableType` | `number` | `0x365` | |
| `discNumber` | `number` | `0x366` | |
| `discCount` | `number` | `0x367` | |
| `saveGameId` | `string`, 8 hex digits | `0x368` | |
| `dataFileCount` | `number` | `0x39D` | |
| `dataFilesSize` | `number` | `0x3A1` | 8-byte field. The combined size of an SVOD package's data files. |
| `format` | `{ raw: number; decoded: 'stfs' \| 'svod' \| 'unknown' }` | `0x3A9` | |
| `onlineCreator` | `string`, 16 hex digits | `0x3AD` | |
| `category` | `number` | `0x3B5` | |
| `mediaOrAvatarData` | `Uint8Array \| null` | `0x3D9` | `0x24` bytes, used only in metadata version 2. |
| `displayNames` | `(string \| null)[]` | `0x411`, plus `0x541A` in version 2 | 9 or 12 entries. |
| `descriptions` | `(string \| null)[]` | `0xD11`, plus `0x941A` in version 2 | 9 or 12 entries. |
| `publisherName` | `string \| null` | `0x1611` | |
| `titleName` | `string \| null` | `0x1691` | |
| `thumbnail` | `Uint8Array \| null` | size `0x1712`, image `0x171A` | |
| `titleThumbnail` | `Uint8Array \| null` | size `0x1716`, image `0x571A` | |
| `installerMetadata` | `Uint8Array \| null` | `0x971A` | `0x15F4` bytes, only when the header size is `0xAD0E`. |

The package also ships `LanguageSlot`, which maps languages to indices in `displayNames` and `descriptions`:

```ts
export const LanguageSlot = {
  English: 0, Japanese: 1, German: 2, French: 3, Spanish: 4,
  Italian: 5, Korean: 6, TraditionalChinese: 7, Portuguese: 8,
  Polish: 10, Russian: 11,
} as const
```

### Behaviour

**Result**

1. Returns `[true, header]` on success, and `[false, reasons]` on failure. It never returns a partial header.
2. When a pre-check fails, `reasons` holds exactly one reason, and nothing is parsed.
3. When parsing fails, `reasons` holds one entry for every field that failed. Their order is deterministic, but not part of the contract and may change between versions.

**Input**

4. `bytes` must hold the whole header: from `0x000` up to the header size stated at `0x340`, which is `0x971A` or `0xAD0E`. A partial header, such as only the first `0x2000` bytes, is never accepted.
5. Bytes beyond the header size are ignored, so a caller may pass a whole STFS package file or a whole SVOD header file.
6. `parseHeader` never reads or changes the caller's buffer after it returns.

**Pre-checks.** Run in this order. The first failure ends the function:

7. `insufficient-bytes` when `bytes` is shorter than 4 bytes.
8. `not-a-package` when the first 4 bytes are not `CON ` (with a trailing space), `LIVE` or `PIRS`.
9. `insufficient-bytes` when `bytes` is shorter than `0x344`, so the header size at `0x340` can't be read.
10. `header-size-invalid` when the 4-byte big-endian value at `0x340` is neither `0x971A` nor `0xAD0E`.
11. `insufficient-bytes` when `bytes` is shorter than the header size.

**Failure while parsing.** `parseHeader` fails only when a field has no truthful representation.

12. Fails with `value-exceeds-max-safe-integer` when `contentSize` (`0x34C`) or `dataFilesSize` (`0x3A1`), read as an 8-byte big-endian unsigned integer, is greater than `Number.MAX_SAFE_INTEGER` (2⁵³ − 1). `raw` is the field's 8 bytes as `0x` followed by 16 uppercase hex digits, so `BigInt(raw)` gives the exact value.
13. Fails with `value-out-of-range` when a thumbnail's declared size is greater than its available space. The declared sizes are at `0x1712` (`thumbnail`) and `0x1716` (`titleThumbnail`). `availableSpace` is `0x4000` when `metadataVersion.effective` is 1, and `0x3D00` when it is 2.
14. Reports every field that fails, not just the first.

**Identifiers**

15. Every identifier is a string of uppercase hex digits, with no `0x` prefix, zero-padded to two digits per byte of the field. A Title ID of 1 is `00000001`. An all-zero 8-byte field is `0000000000000000`.
16. The identifiers are `contentId` (40 digits), `mediaId` (8), `declaredTitleId` (8), `saveGameId` (8) and `onlineCreator` (16).

**Numbers**

17. Every other numeric field is a `number`, read big-endian (§6.1).
18. `declaredContentType` is the 4-byte value at `0x344`, returned as a `number` whether or not the content type is known. `parseHeader` doesn't look up names.

**Declared values.** Fields named `declared…` hold what the header claims, when something outside the header decides the truth.

19. `declaredSigning` is the magic, without the trailing space of `CON `. It says only which kind of signature the package claims, not whether it is genuinely signed (§2.3).
20. `declaredTitleId` and `declaredContentType` are the header's values. The directory a package sits in decides its real Title ID and content type, and headers often disagree with it (§7.2).

**Metadata version**

21. `metadataVersion.declared` is the 4-byte value at `0x348`, as stored.
22. `metadataVersion.effective` is `2` when `declared` is 2, and `1` for any other value, including 0, 1 and unknown values. This is how xenia and Velocity read it (§6.1).

**Format**

23. `format.raw` is the 4-byte volume type at `0x3A9`.
24. `format.decoded` is `'stfs'` when `raw` is 0, `'svod'` when `raw` is 1, and `'unknown'` for any other value.
25. The format is never inferred from the content type, the magic or the presence of a `.data` directory (§6.9).
26. `parseHeader` doesn't identify PEC packages. A PEC has no magic, so pre-check 8 returns `not-a-package` for it.

**Text** (`displayNames`, `descriptions`, `publisherName`, `titleName`)

27. Text is decoded as UTF-16BE, reading 2-byte code units from the start of each field (§6.5).
28. A string ends at the first `0x0000` code unit, like a C `char16_t[]`. When a field holds no `0x0000` unit, the string uses the field's full width: 128 units for a display name or description slot (`0x100` bytes), and 64 units for `publisherName` and `titleName` (`0x80` bytes).
29. A field whose first code unit is `0x0000` is `null`.
30. Every code unit is kept exactly as stored, including unpaired surrogates. `parseHeader` neither replaces them with U+FFFD nor fails. Consumers can use `String.prototype.isWellFormed()` and `toWellFormed()`.
31. Text is never repaired. A string stored as UTF-8 bytes inside UTF-16BE (the *South Park* fixture, §6.5) is returned exactly as decoded.

**Language slots**

32. `displayNames` and `descriptions` have 9 entries when `metadataVersion.effective` is 1, and 12 when it is 2. Each entry's index is its slot number, so empty slots are `null` and positions are never shifted.
33. Slots 0–8 are the 9 `0x100`-byte slots at `0x411` (names) and `0xD11` (descriptions).
34. In metadata version 2, slots 9–11 are the 3 `0x100`-byte slots at `0x541A` (names) and `0x941A` (descriptions).
35. `LanguageSlot` names slots 0–8, 10 and 11. Slot 9 is deliberately not named, because its language isn't confirmed. Its value is still at index 9.

**Thumbnails**

36. A thumbnail is a `Uint8Array` holding exactly the declared number of bytes, starting at the image's offset (`0x171A` or `0x571A`).
37. A thumbnail is `null` when its declared size is 0.
38. Each thumbnail is a copy, not a view of the input buffer.
39. Thumbnail bytes are not decoded or checked. They are PNG according to the spec (§6.4), but checking that is V1's job.

**Raw byte fields**

40. `mediaOrAvatarData` is a copy of the `0x24` bytes at `0x3D9` when `metadataVersion.effective` is 2, and `null` when it is 1.
41. `installerMetadata` is a copy of the `0x15F4` bytes from `0x971A` to `0xAD0D` when the header size is `0xAD0E`, and `null` when it is `0x971A`.

**Fields not returned**

42. `parseHeader` doesn't return the signature or certificate (see R50 and R51), the licences, transfer flags, creator console ID, profile ID or device ID (see R4), the volume descriptor at `0x379`, or the reserved bytes at `0x3B9`.

### Notes and references

- **Spec:** header layout §6.1; magic §6.2; content ID and header size §6.3; metadata fields and transfer flags §6.4; text, language slots and thumbnails §6.5; identifying a package §6.9; directory decides Title ID and content type §7.2; signature claims §2.3.
- **Why the whole header is required:** V1, `equals` and `diff` need it anyway, and it keeps "parsed, but some fields unavailable" states out of every result type. A caller can't know the header size before reading, so it should read `0xAD0E` bytes (or `0xB000`, including padding). A full header is 37.8 KiB (`0x971A`) or 43.3 KiB (`0xAD0E`).
- **Why the magic is checked before the size:** "not a package" is more useful than "insufficient bytes" for a short file read by mistake.
- **Why 64-bit sizes are `number`:** real values are far below 2⁵³; the largest realistic package, a dual-layer GOD, is about 8 GiB. A larger value means the header is malformed. A caller who knows better can build a `bigint` from `raw`.
- **`mediaOrAvatarData`:** the spec says these bytes hold either media data (series ID, season ID, season and episode numbers) or avatar asset data (sub-category, colourisable flag, a 16-byte asset ID at `0x3E1`, skeleton version), in metadata version 2 only (§6.4). It doesn't say how to tell which, so decoding would be a guess. Raw bytes keep one return shape. Decoding functions can be added later, once the spec documents the layouts and the rule for choosing between them.
- **`installerMetadata`:** the spec says only that `0xAD0E` headers "add extra installer metadata" (🔶, §6.1), with no layout. Raw bytes are the only truthful representation for now.
- **What parsing can't detect:** the header has no markers between fields, so a thumbnail that spilled past its space while declaring a size that fits is invisible to `parseHeader`. V1 catches most such cases by checking the PNG structure.
- **Turning a thumbnail into an image** is the consumer's job, for example `new Blob([bytes], { type: 'image/png' })` in a browser. Browser image types are not returned, because the package also runs outside browsers.
- **Fixture warning:** `dlc-halo-reach-anniversary` is only `0x6000` bytes, but its header size is `0xAD0E`, so `parseHeader` returns `insufficient-bytes` for it.

---

## R4 `parseRestrictions`

### Summary

Decodes the parts of a package header that restrict who may use the package and how it may be moved: the 16 licence entries, the transfer flags, and the IDs that tie a package to a console, a profile and a storage device. It returns decoded facts, never verdicts such as "can be used". It does no I/O and never throws on bad input.

### Signature

```ts
function parseRestrictions(bytes: Uint8Array): [true, Restrictions] | [false, ParseRestrictionsFailureReason[]]
```

The parameter name is a placeholder. The function is synchronous. JSDoc must state the bytes required: from `0x000` up to the header size stored at `0x340`. That is `0x971A` bytes when the stored value is `0x971A`, and `0xAD0E` bytes when it is `0xAD0E`. Reading `0xB000` bytes always suffices.

### Return type

```ts
type ParseRestrictionsFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }        // shared with R1, R50 and R51
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number }

type Restrictions = {
  licences: Licence[]                // always 16 entries
  transferFlags: {
    raw: number
    decoded: {
      canMoveToProfile: boolean        // 0x80
      canMoveToDevice: boolean         // 0x40
      moveOnly: boolean                // 0x20: can be moved but not copied
      kinectEnabled: boolean           // 0x10
      networkStorageDisabled: boolean  // 0x08
      deepLinksSupported: boolean      // 0x04
    }
  }
  creatorConsoleId: string           // 10 hex digits
  profileId: string                  // 16 hex digits
  deviceId: string                   // 40 hex digits
}

type Licence = {
  index: number                      // 0–15
  licenseeType: { raw: number; decoded: LicenseeTypeName }
  licenseeData: string               // 12 hex digits
  bits: number
  flags: number
}

type LicenseeTypeName =
  | 'unrestricted' | 'xboxLiveAccount' | 'windowsLiveAccount' | 'console'
  | 'mediaFlags' | 'keyvaultPrivilege' | 'hypervisorFlags' | 'userPrivilege'
  | 'unused' | 'unknown'
```

`'unused'` and `'unknown'` are deliberately separate names (see Notes).

### Behaviour

**Result**

1. Returns `[true, restrictions]` on success, and `[false, reasons]` when a pre-check fails. `reasons` then holds exactly one reason.
2. Once the pre-checks pass, it always succeeds, because every field it returns has a truthful representation.
3. It works the same for `CON`, `LIVE` and `PIRS` packages.

**Input**

4. `bytes` must hold the whole header: from `0x000` up to the header size stated at `0x340` (`0x971A` or `0xAD0E`). Bytes beyond it are ignored.

**Pre-checks.** Run in this order. The first failure ends the function:

5. `insufficient-bytes` when `bytes` is shorter than 4 bytes.
6. `not-a-package` when the first 4 bytes are not `CON `, `LIVE` or `PIRS`.
7. `insufficient-bytes` when `bytes` is shorter than `0x344`.
8. `header-size-invalid` when the value at `0x340` is neither `0x971A` nor `0xAD0E`.
9. `insufficient-bytes` when `bytes` is shorter than the header size.

**Licences** (`0x22C`, 16 entries of `0x10` bytes, §6.3)

10. `licences` always has 16 entries, in header order, including unused ones. `index` is the entry's position, 0–15.
11. Entry *n* starts at `0x22C + n × 0x10`.
12. `licenseeType.raw` is the top 16 bits of the entry's 8-byte licensee ID, as a `number` (for example `61440` for `0xF000`).
13. `licenseeType.decoded` maps `raw` as follows:

    | `raw` | `decoded` |
    |---|---|
    | `0xFFFF` | `'unrestricted'` (anyone) |
    | `0x0009` | `'xboxLiveAccount'` (XUID) |
    | `0x0003` | `'windowsLiveAccount'` |
    | `0xF000` | `'console'` |
    | `0xE000` | `'mediaFlags'` |
    | `0xD000` | `'keyvaultPrivilege'` |
    | `0xC000` | `'hypervisorFlags'` |
    | `0xB000` | `'userPrivilege'` |
    | `0x0000` | `'unused'` |
    | anything else | `'unknown'` |

14. `licenseeData` is the low 48 bits of the licensee ID, as 12 uppercase hex digits with no prefix.
15. `bits` is the 4-byte value at entry offset `0x8`, as a `number`. Its meaning isn't decoded.
16. `flags` is the 4-byte value at entry offset `0xC`, as a `number`. Its meaning isn't decoded.

**Transfer flags** (`0x1711`, 1 byte, §6.4)

17. `transferFlags.raw` is the byte at `0x1711`, as a `number`. The two bits without a known meaning (`0x02` and `0x01`) are visible only here.
18. Each `decoded` boolean is `true` exactly when its bit (shown in the type above) is set in `raw`.

**IDs** (§6.4)

19. `creatorConsoleId` is the 5 bytes at `0x36C`, as 10 uppercase hex digits with no prefix.
20. `profileId` is the 8 bytes at `0x371`, as 16 uppercase hex digits. A package with no owning profile has `0000000000000000`.
21. `deviceId` is the 20 bytes at `0x3FD`, as 40 uppercase hex digits.

**Facts, not verdicts**

22. `parseRestrictions` never says whether a package can be used, moved or copied by a particular console or profile. It reports what the header says.

### Notes and references

- **Spec:** licences and licensee types §6.3; transfer flags and IDs §6.4; signing and licensing in plain terms §2.2; partitions and ownership §2.1; the directory decides ownership, and the header's profile ID is only a cross-check §7.2.
- **Why facts, not verdicts:** whether a modded console honours licences is unknown (❓, §2.2), so a verdict would claim more than is known.
- **Why all 16 licence entries:** dropping unused ones would decide what counts as "unused" on the consumer's behalf.
- **`'unused'` and `'unknown'` mean different things.** `'unused'` is a documented value: type `0x0000` marks an empty licence entry (Velocity, §6.3). `'unknown'` means the type is not one of the documented values, so its meaning is not known.
- **Why `bits` and `flags` aren't decoded:** the spec says only that bit 0 of the licence bits is "generally" the full-version licence for Arcade games, and the flags have no documented meaning.
- **Transfer flag bit order is 🔶:** Velocity gives the explicit values used here. xenia declares the flags as a C bitfield that could be read in the opposite order (§6.4). If the order turns out wrong, it's a bug to fix later.
- **Unrestricted licence:** a licensee ID of `0xFFFFFFFFFFFFFFFF` decodes as `licenseeType.raw` `65535` (`'unrestricted'`) and `licenseeData` `FFFFFFFFFFFF`. Console-signed packages such as saves usually have one such entry (§6.3). An unlocked package typically has two (§4.8).

---

## R50 `parseConsoleCertificate`

### Summary

Decodes the console certificate that a `CON` package carries in its header: the fields that identify the console which signed it. For `LIVE` and `PIRS` packages, which carry a Microsoft signature instead, the result is `null`. It does no I/O, never throws on bad input, and doesn't check whether the certificate or signature is genuine.

### Signature

```ts
function parseConsoleCertificate(
  bytes: Uint8Array,
): [true, ConsoleCertificate | null] | [false, ParseConsoleCertificateFailureReason[]]
```

The parameter name is a placeholder. The function is synchronous. JSDoc must state the bytes required: from `0x000` up to the header size stored at `0x340`. That is `0x971A` bytes when the stored value is `0x971A`, and `0xAD0E` bytes when it is `0xAD0E`. Reading `0xB000` bytes always suffices.

### Return type

```ts
type ParseConsoleCertificateFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }        // shared with R1, R4 and R51
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number }

type ConsoleCertificate = {
  publicKeyCertificateSize: number                                     // 0x004, 2 bytes
  ownerConsoleId: string                                               // 0x006, 5 bytes → 10 hex digits
  consolePartNumber: string                                            // 0x00B, 0x14 bytes, text
  consoleType: { raw: number; decoded: 'devkit' | 'retail' | 'unknown' }  // 0x01F, 1 byte
  certificateDate: string                                              // 0x020, 8 bytes, ASCII text
  publicExponent: number                                               // 0x028, 4 bytes
  publicModulus: Uint8Array                                            // 0x02C, 0x80 bytes (copy)
  certificateSignature: Uint8Array                                     // 0x0AC, 0x100 bytes (copy)
}
```

### Behaviour

**Result**

1. Returns `[true, certificate]` on success, and `[false, reasons]` when a pre-check fails. `reasons` then holds exactly one reason.
2. The certificate is `null` when the magic is `LIVE` or `PIRS`. Those packages have no console certificate (§6.2).
3. The certificate is the decoded fields when the magic is `CON `, read from the offsets shown in the type above (§6.2).

**Input**

4. `bytes` must hold the whole header: from `0x000` up to the header size stated at `0x340` (`0x971A` or `0xAD0E`). Bytes beyond it are ignored.

**Pre-checks.** Run in this order. The first failure ends the function:

5. `insufficient-bytes` when `bytes` is shorter than 4 bytes.
6. `not-a-package` when the first 4 bytes are not `CON `, `LIVE` or `PIRS`.
7. `insufficient-bytes` when `bytes` is shorter than `0x344`.
8. `header-size-invalid` when the value at `0x340` is neither `0x971A` nor `0xAD0E`.
9. `insufficient-bytes` when `bytes` is shorter than the header size.

**Fields**

10. `ownerConsoleId` is an identifier: uppercase hex digits, no prefix, zero-padded to 10 digits.
11. `consoleType.decoded` is `'devkit'` when `raw` is `0x01`, `'retail'` when `raw` is `0x02`, and `'unknown'` for any other value.
12. `publicModulus` and `certificateSignature` are copies, not views of the input buffer.
13. `certificateDate` is the field's ASCII text, as stored, ending at the first `0x00` byte (as Velocity reads it). It is never parsed into a date, because its format is not known (§6.2, "The certificate date field").
14. `parseConsoleCertificate` doesn't verify the certificate or the package signature. It doesn't return the package signature at `0x1AC` either (see R51).

### Notes and references

- **Spec:** magic and signature §6.2; signing in plain terms §2.2; genuine and fake signatures §2.3.
- **Why separate from R1:** R1 answers "what is this package?". The certificate is needed less often, and applies only to `CON` packages.
- **Not the creator console ID:** the certificate's `ownerConsoleId` (`0x006`) identifies the console that *signed* the package. The metadata's console ID at `0x36C` (R4's `creatorConsoleId`) identifies the console that *created* it.
- **Why the certificate date stays a string** (§6.2, "The certificate date field"): it's 8 bytes of ASCII with no documented format. Real packages hold values such as `11-06-09` and `01-12-10`, which could be month-day-year or day-month-year, with a two-digit year and no time zone. Parsing it into a date would be a guess, and nothing suggests the console enforces any format.

---

## R51 `hasEmptySignature`

### Summary

Says whether a package header's signature is all zero bytes. An empty signature marks a package made by a tool rather than signed by Microsoft or a console, such as a Disc to GOD rip or an Iso2God conversion (§2.3). It does no I/O, never throws on bad input, and doesn't check whether a non-empty signature is genuine.

### Signature

```ts
function hasEmptySignature(bytes: Uint8Array): [true, boolean] | [false, HasEmptySignatureFailureReason[]]
```

The parameter name is a placeholder. The function is synchronous. JSDoc must state the bytes required: from `0x000` up to the header size stored at `0x340`. That is `0x971A` bytes when the stored value is `0x971A`, and `0xAD0E` bytes when it is `0xAD0E`. Reading `0xB000` bytes always suffices.

### Return type

```ts
type HasEmptySignatureFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }        // shared with R1, R4 and R50
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number }
```

On success, the second element is the answer: `true` when the signature is empty.

### Behaviour

**Result**

1. Returns `[true, isEmpty]` on success, and `[false, reasons]` when a pre-check fails. `reasons` then holds exactly one reason.
2. The first element says whether the check could run. The second element, on success, says whether the signature is empty. The two must not be confused: `[true, false]` means "checked, and not empty".

**Input**

3. `bytes` must hold the whole header: from `0x000` up to the header size stated at `0x340` (`0x971A` or `0xAD0E`). Bytes beyond it are ignored.

**Pre-checks.** Run in this order. The first failure ends the function:

4. `insufficient-bytes` when `bytes` is shorter than 4 bytes.
5. `not-a-package` when the first 4 bytes are not `CON `, `LIVE` or `PIRS`.
6. `insufficient-bytes` when `bytes` is shorter than `0x344`.
7. `header-size-invalid` when the value at `0x340` is neither `0x971A` nor `0xAD0E`.
8. `insufficient-bytes` when `bytes` is shorter than the header size.

**The check**

9. For a `LIVE` or `PIRS` package, `isEmpty` is `true` exactly when all `0x100` bytes from `0x004` to `0x103` are zero. This is the Microsoft signature (§6.2).
10. For a `CON` package, `isEmpty` is `true` exactly when all `0x80` bytes from `0x1AC` to `0x22B` are zero. This is the package signature made by the console (§6.2). The certificate before it is not checked.
11. `isEmpty` is `false` for any signature with at least one non-zero byte, whether or not it is genuine, and whether or not it is an unlocker's marker.
12. The padding after a `LIVE` or `PIRS` signature (`0x104`–`0x22B`) is not checked.

### Notes and references

- **Spec:** signature layout §6.2; tool-made packages with empty signatures §2.3; signing in plain terms §2.2.
- **Real data:** Aurora's Disc to GOD writes a `LIVE` package with an all-zero signature (checked on 8 real rips, §2.3). Iso2God and iso2god-rs start from a blank `LIVE` header.
- **What a `false` answer doesn't mean:** the signature isn't necessarily genuine. Checking that needs RSA and Microsoft's public keys, which is out of scope. Some unlockers overwrite the signature with a marker, such as `ByromWasHereUnlockingYourGODGame` repeated (§4.8). The answer is `false` for those. Recognising markers was deliberately left out. A consumer who needs it can read `0x004`–`0x103` themselves.
- **Relationship to R1:** R1's `declaredSigning` says which kind of signature a package claims. This function says whether that signature is empty.

---

## R60 `equals`

### Summary

Says whether two package headers are byte-for-byte identical, from `0x000` up to each header's size, and lists every reason when they aren't. It never says *where* or *which fields* differ: that's `diff` (R61). It does no I/O and never throws on bad input.

### Signature

```ts
function equals(a: Uint8Array, b: Uint8Array):
  | [true,  true,  []]                      // compared: identical
  | [true,  false, EqualsDifference[]]      // compared: not identical, with every reason
  | [false, false, EqualsFailureReason[]]   // a pre-check failed: nothing compared
```

The function is synchronous. JSDoc must state the bytes required: from `0x000` up to the header size stored at `0x340`. That is `0x971A` bytes when the stored value is `0x971A`, and `0xAD0E` bytes when it is `0xAD0E`. Reading `0xB000` bytes always suffices. Consumers can rename it on import (`import { equals as headersEqual }`) if `equals` would conflict.

The first element follows the same pattern as every other function: `true` means the comparison ran. The second element is the answer. The third holds the differences when the comparison ran, or the failure reason when it didn't.

### Return type

```ts
type EqualsDifference =
  | { kind: 'header-size-differs'; a: number; b: number }
  | { kind: 'bytes-differ' }

type EqualsFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number }
```

`EqualsFailureReason` holds the same pre-check reasons every function returns. They don't say which buffer failed.

### Behaviour

**Result**

1. Returns `[true, true, []]` exactly when both headers pass the pre-checks, have the same header size, and every byte from `0x000` up to that size is identical.
2. Returns `[true, false, differences]` when both headers pass the pre-checks and are not identical. `differences` lists every difference that applies, and is never empty.
3. Returns `[false, false, reasons]` when a pre-check fails. `reasons` then holds exactly one reason.
4. When it lists more than one difference, their order is deterministic, but not part of the contract and may change between versions.

**Pre-checks.** Fail fast: `a`'s pre-checks run first, then `b`'s, each in this order. The first failure ends the function, and nothing is compared:

5. `insufficient-bytes` when the buffer is shorter than 4 bytes.
6. `not-a-package` when its first 4 bytes are not `CON `, `LIVE` or `PIRS`.
7. `insufficient-bytes` when the buffer is shorter than `0x344`.
8. `header-size-invalid` when the value at `0x340` is neither `0x971A` nor `0xAD0E`.
9. `insufficient-bytes` when the buffer is shorter than its header size.
10. The reason doesn't say which buffer failed. A caller who needs to know can check each buffer with a parse function.

**Comparison**

11. Never compares past `0xAD0E`, whatever a header claims and however long a buffer is.
12. Adds `header-size-differs` when the two header sizes are not equal.
13. When the header sizes differ, still compares the shared length (the smaller header size), and adds `bytes-differ` if any byte in it differs.
14. Adds `bytes-differ` when any byte within the compared length differs.
15. Stops comparing at the first differing byte, since no byte positions are reported.
16. Compares every byte in the range, including padding, reserved bytes and the bytes after each string's terminator.

### Notes and references

- **Spec:** header size and layout §6.1; header size at `0x340` §6.3; comparing packages §7.5.
- **`0x340` holds the header's length;** it's not where the header ends. Because the header starts at `0x000`, it runs from `0x000` up to that length.
- **Relationship to `diff` (R61):** `diff` gives every field as `'same'` exactly when `equals` returns `[true, true, []]`, because `diff`'s fields together cover every byte of the header. `equals` answers "are they identical?", and `diff` answers "which fields differ?".
- **Why no byte ranges:** `diff` already says what differs. Without ranges, `equals` can stop early. For reference, the worst case with ranges (every other byte differing) was measured at 22,151 ranges, about 0.3 ms and 1.6 MB, so cost wasn't the reason.
- **Unlocked packages:** an unlocked copy differs from its original in the licences and the signature, but has the same content ID (§4.8). `equals` returns `[true, false, [{ kind: 'bytes-differ' }]]` for such a pair, and `diff` shows `licences` and `signature` as `'different'`.
- **Not a package comparison:** for SVOD packages, equal headers don't mean equal packages. The data files must be compared too (§7.5). That belongs in the future SVOD package.

---

## R61 `diff`

### Summary

Compares two package headers field by field, and reports each field as `'same'` or `'different'`. It covers every byte of the header, padding included, so it reports every field `'same'` exactly when `equals` (R60) says the headers are identical. It doesn't return field values: those come from the parse functions. It does no I/O and never throws on bad input.

### Signature

```ts
function diff(a: Uint8Array, b: Uint8Array):
  | [true, Record<FieldName, 'same' | 'different'>]
  | [false, DiffFailureReason[]]
```

The function is synchronous. JSDoc must state the bytes required: from `0x000` up to the header size stored at `0x340`. That is `0x971A` bytes when the stored value is `0x971A`, and `0xAD0E` bytes when it is `0xAD0E`. Reading `0xB000` bytes always suffices. Consumers can rename it on import (`import { diff as diffHeaders }`).

The result follows the same pattern as the parse functions. The first element says whether the comparison could run. On success, the second element is the field map. Whether the headers are wholly the same is found by checking that every value is `'same'`.

### Return type

`FieldName` is the union of the keys in the table under "Fields" below.

```ts
type DiffFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number }
```

These are the same pre-check reasons every function returns. They don't say which buffer failed.

### Behaviour

**When it can't compare**

1. Fail fast: `a`'s pre-checks run first, then `b`'s, each in this order. The first failure ends the function and returns `[false, reasons]`, with exactly one reason. No fields are compared.
   1. `insufficient-bytes` when the buffer is shorter than 4 bytes
   2. `not-a-package` when its first 4 bytes are not `CON `, `LIVE` or `PIRS`
   3. `insufficient-bytes` when the buffer is shorter than `0x344`
   4. `header-size-invalid` when the value at `0x340` is neither `0x971A` nor `0xAD0E`
   5. `insufficient-bytes` when the buffer is shorter than its header size
2. The reason doesn't say which buffer failed. A caller who needs to know can check each buffer with a parse function.

**When it can compare**

3. Different header sizes don't stop the comparison: when both are valid, `diff` still returns a field map. `headerSize` is then `'different'`, and so is `installerMetadata`, since it exists only in the `0xAD0E` header.
4. Returns `[true, fields]`, whether or not any field differs.
5. A field is `'same'` exactly when its bytes in both headers are identical, padding included (for example the zeros after a string's terminator, or unused thumbnail space).
6. A field present in one header and absent from the other is `'different'`.
7. A field absent from both headers is `'same'`.
8. A field whose byte ranges have different lengths in the two headers is `'different'`. For example, `thumbnail` covers `0x4000` bytes of image space in metadata version 1 and `0x3D00` in version 2.
9. Never compares past `0xAD0E`.
10. Never returns field values, offsets or byte positions. Only `'same'` or `'different'`.

**Fields.** Each key covers a range of raw bytes. Together, the ranges cover every byte from `0x000` up to the header size, with no gaps or overlaps. There is one key per top-level property, named after the matching parse result property where one exists.

| Offset | Size | Key | Values parsed by |
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
| `0x1712` + `0x171A` | 4 + space | `thumbnail`: its size field and image space | R1 |
| `0x1716` + `0x571A` | 4 + space | `titleThumbnail`: its size field and image space | R1 |
| `0x971A` | `0x15F4` | `installerMetadata`: only for `0xAD0E` headers | R1 |

11. Thumbnail space is `0x4000` per thumbnail when `metadataVersion.effective` is 1, and `0x3D00` when it is 2.
12. In metadata version 2, the `0x300` bytes freed from each thumbnail belong to the extra languages: `0x541A`–`0x5719` to `displayNames`, and `0x941A`–`0x9719` to `descriptions`.
13. `certificate` exists only for `CON`, and `signaturePadding` only for `LIVE` and `PIRS`. `signature` exists for all three, but at different offsets and lengths.
14. `mediaOrAvatarData` is compared in both metadata versions, because its bytes are part of the header either way.

### Notes and references

- **Spec:** header layout §6.1; magic and signature §6.2; licences, content ID and header size §6.3; metadata §6.4; text and thumbnails §6.5.
- **Contract with `equals` (R60):** `diff` reports every field `'same'` exactly when `equals` returns `[true, true, []]`. The ranges were checked to be contiguous in all four layouts (`CON` or `LIVE`/`PIRS`, metadata version 1 or 2).
- **One key per top-level property:** for example `licences`, not `licences.0` to `licences.15`. For details, compare the parse results of the two headers.
- **"Not exposed"** means no public function parses that range: `signaturePadding` and `reserved` have no meaning, and the volume descriptor's layout differs between STFS and SVOD. V1 uses internal functions for these ranges.
- **Unlocked packages:** an unlocked copy and its original typically show `licences` and `signature` as `different`, and everything else `same` (§4.8).

---

## V1 `verifyHeaderAsync`

### Summary

Checks whether a package header follows the specification, and reports every problem it finds as a finding. It detects the package's format from the header. It is the only function in the package that checks the header's integrity, by recomputing its content ID with SHA-1, and so the only async one. It does no I/O apart from the hash, and never throws on bad input.

### Signature

```ts
function verifyHeaderAsync(
  bytes: Uint8Array,
  options?: { strictMode?: boolean },
): Promise<
  | [true,  true,  Finding[]]              // verified: valid (may hold warnings and info)
  | [true,  false, Finding[]]              // verified: not valid
  | [false, false, VerifyFailureReason[]]  // a pre-check failed: nothing verified
>
```

The parameter names are placeholders. `Async` is in the name because it is the only async function. No synchronous twin exists. The result follows `equals` (R60): success, then the verdict, then the details.

**JSDoc must state the bytes required:** the padded header. That is `0xA000` bytes when the header size stored at `0x340` is `0x971A`, and `0xB000` bytes when it is `0xAD0E`. Reading `0xB000` bytes always suffices. This is more than any other function needs.

### Return type

```ts
type VerifyFailureReason =
  | { kind: 'insufficient-bytes'; needed: number; got: number }
  | { kind: 'not-a-package' }
  | { kind: 'header-size-invalid'; declared: number }
```

These are the same pre-check reasons every function returns.

Every finding has the same shape. Details specific to a check, such as a computed hash or a stored value, go in the `message`, not in extra fields.

```ts
type Finding = {
  code: FindingCode                                    // a literal union of every code in the check table
  severity: 'error' | 'warning' | 'info'
  confidence: 'verified' | 'widely-reported' | 'unconfident'  // the spec's ✅, 🔶 and ❓ for the rule
  specRef: string                                      // e.g. '§6.3'
  field: FieldName                                     // the same keys as diff (R61)
  message: string                                      // brief, human-readable English, with the details
}
```

### Behaviour

**Result**

1. Returns `[true, valid, findings]` when the pre-checks pass. `findings` lists every finding, and may be empty.
2. Without `strictMode` (the default), `valid` is `true` exactly when no finding has severity `'error'`.
3. With `{ strictMode: true }`, `valid` is `true` exactly when no finding has severity `'error'` or `'warning'`.
4. `'info'` findings never make `valid` `false`, even in strict mode. Any finding that isn't an error or a warning is `'info'`.
5. Returns `[false, false, reasons]` when a pre-check fails. `reasons` then holds exactly one reason, and no check runs.
6. When it reports more than one finding, their order is deterministic, but not part of the contract and may change between versions.

**Pre-checks.** Run in this order. The first failure ends the function:

7. `insufficient-bytes` when `bytes` is shorter than 4 bytes.
8. `not-a-package` when the first 4 bytes are not `CON `, `LIVE` or `PIRS`.
9. `insufficient-bytes` when `bytes` is shorter than `0x344`.
10. `header-size-invalid` when the value at `0x340` is neither `0x971A` nor `0xAD0E`.
11. `insufficient-bytes` when `bytes` is shorter than the padded header: `0xA000` for a `0x971A` header, `0xB000` for a `0xAD0E` header.

**Checks**

12. Runs every check and reports every finding. A check that depends on one that failed is skipped. For example, when a thumbnail's declared size is larger than its space, its PNG structure isn't checked.
13. Takes no expected format. It reads the format from the volume type at `0x3A9`, as R1 does.
14. Uses `globalThis.crypto.subtle` for SHA-1. The package bundles no crypto code.
15. **Severity reflects how strictly the requirement is enforced,** by the console and by other projects (xenia and Velocity in particular), not the spec's confidence mark. Non-strict mode is permissive: a finding is an `'error'` only when we're quite certain the header is incorrect. Severities will need tuning by hand over time.
16. Each check is its own internal, single-purpose function. Its JSDoc points to the spec section that defines the rule, and states the rule's confidence as `verified`, `widely-reported` or `unconfident`. Source code doesn't use the spec's emoji.

17. Each `message` is brief English, and includes the values behind the finding. Long data is truncated, and the message says so: a hex value longer than 16 digits shows its first 6 and last 6 digits around `…`, followed by its full length, for example `1BD319…4E02C3 (40 digits, truncated)`.

**The checks and their severities.** The list and severities are agreed, based on the severity chart below. They will be tuned by hand over time.

| Code | Check | Proposed severity |
|---|---|---|
| `content-id-mismatch` | SHA-1 of `0x344` up to the padded end ≠ the content ID at `0x32C` (§6.3) | error |
| `thumbnail-exceeds-space` | a declared thumbnail size > its space, `0x4000` or `0x3D00` (§6.5) | error |
| `volume-type-unknown` | volume type at `0x3A9` is neither 0 nor 1 (§6.4, §6.9) | error |
| `console-type-unknown` | a `CON` console type is neither `0x01` nor `0x02` (§6.2) | error |
| `volume-descriptor-length` | the byte at `0x379` ≠ `0x24` (§6.6, §6.7) | warning |
| `stfs-has-data-files` | an STFS package with a non-zero data file count (`0x39D`) or combined size (`0x3A1`) (§6.4) | warning |
| `metadata-version-unknown` | the stored metadata version is not 0, 1 or 2 (§6.1) | warning |
| `text-unpaired-surrogate` | malformed UTF-16 in any text field (§6.5) | warning |
| `licensee-type-unknown` | a licence with an undocumented type (§6.3) | warning |
| `value-exceeds-max-safe-integer` | `contentSize` or `dataFilesSize` > 2⁵³ − 1 (§6.4) | warning |
| `thumbnail-not-png` | a non-empty thumbnail doesn't start with the PNG signature (§6.4) | info |
| `thumbnail-truncated` | a PNG thumbnail's chunks don't end with `IEND` exactly at its declared size (§6.4) | info |
| `content-type-unknown` | the content type isn't in the §4.2 list | info |
| `transfer-flags-unknown-bits` | bit `0x02` or `0x01` is set (§6.4) | info |
| `reserved-not-zero` | `0x3B9`–`0x3D8` not all zero (§6.4) | info |
| `signature-padding-not-zero` | `LIVE`/`PIRS` padding `0x104`–`0x22B` not all zero (§6.2) | info |
| `signature-empty` | an all-zero signature, which marks a tool-made package (§2.3, §6.2) | info |

Dropped: "an SVOD header file is exactly `0xB000` bytes". V1 can't tell whether it was given the whole file or a prefix, so the check belongs in the future SVOD package.

### Severity chart

How other software treats each field, researched on 2026-10-13 from source code:
- **Velocity:** `hetelek/Velocity` @ `cf0b84c`, mainly `XboxInternals/Stfs/XContentHeader.cpp` (`readMetadata`).
- **xenia:** `xenia-canary` @ `2372a54`, mainly `kernel/xam/xcontent/`, with upstream `xenia-project/xenia` @ `95a5c3e` where it differs.
- **Others:**
  - rom-properties (RP) @ `75fb203`
  - py360 @ `8fb79c8`
  - acceleration (ACC) @ `e7a6851`
  - emoose's `Xbox360Container.bt` @ `5f85b9e`
  - iso2god-rs @ `76207d7`
  - Iso2God (C#, decompiled) @ `09a6edf`
  - XeBuild's `iso2svod` and `su_check` @ `d5a4a94`
- **Console:** Free60, and the xeBuild, XeUnshackle and FreeMyXe kernel patch sources.

"Rejects" means the software refuses to open or mount the package.

| Code | Velocity | xenia | Other tools | Console | Basis for the severity |
|---|---|---|---|---|---|
| `content-id-mismatch` | Never verifies. Recomputes it on save over the same range we use (`0x344` to the padded end). | Never reads it. No SHA-1 or RSA code. | No reader checks it. Every GOD writer computes it over the same range. XeBuild's `su_check` **rejects** a mismatch. | Assumed to be checked; no primary source. | Every one of 772 real packages matches, and every writer gets it right. A mismatch means the header changed without being rehashed. |
| `thumbnail-exceeds-space` | No bound. Reads past the space; a huge size can crash it. | Clamps the thumbnail. The title thumbnail is unclamped and can read out of bounds. | `iso2svod` refuses icons over `0x3D00`. ACC can panic. | Not found. | Undefined behaviour in two major tools. `parseHeader` can't represent it either. |
| `volume-type-unknown` | **Rejects** (`fileSystem > 1`). | Fails to mount (upstream logs "Unknown XContent volume type"). | ACC rejects or panics. Writers always write 1 for SVOD. | Not found. | Rejected by both major tools. |
| `console-type-unknown` | **Rejects** ("Invalid console type"; checks `value & 3`). | Never reads it. | RP rejects: it doesn't detect the package as STFS. | Not found. | Rejected by Velocity and RP. |
| `metadata-version-unknown` | Ignored in release builds. Only debug builds reject a value other than 2. | Not validated. `>= 2` enables version 2. Note: xenia caps thumbnails at `0x4000` only when the value is exactly 1, so a stored 0 gets `0x3D00`, unlike our rule. | RP clamps (`< 2` is version 1). Writers always write 2. | Not found. | Lenient everywhere: warning. |
| `volume-descriptor-length` | Never checks. Writes `0x24` on save, which corrects it. | Has a check, `is_valid()`, that is never called. | No reader checks it. Every writer writes `0x24`. | Not found. | Universally written, never enforced. |
| `stfs-has-data-files` | Ignored and kept. | Canary ignores it. **Upstream** looks for a `.data` folder when the count is above 1, and fails to mount without one. | Not checked. | Not found. | Only upstream xenia acts on it. |
| `thumbnail-not-png` | Ignored: shows no image. | Passed through. The install dialog shows no icon. | RP shows no icon. **iso2god-rs writes zero-filled thumbnails, and Iso2God writes 20 zero bytes when there's no icon.** Consoles accept both. | Accepted (tool output loads). | Harmless and common in tool-made GODs: info, so strict mode doesn't fail them. |
| `thumbnail-truncated` | Not checked. | Not checked. | RP shows no icon. | Not found. | As above. |
| `text-unpaired-surrogate` | Kept as is. | Kept in UTF-16. Converting to UTF-8 probably throws (inferred, not traced). | ACC's old parser panics; its new one replaces. Writers produce valid UTF-16. | Not found. | Malformed text that can break some tools. The package itself likely works. |
| `licensee-type-unknown` | **Rejects** ("Invalid license type"). It uses the same 9 types as the spec. | Ignores licences entirely. | ACC's old parser panics; its new one keeps the raw value. | Not found. | Velocity rejects it, but nothing shows the console does. Undocumented, not proven invalid. |
| `value-exceeds-max-safe-integer` | Stored as 64-bit, unchecked. | Content size is used for the disk-space check, unchecked. | 64-bit, unchecked. | n/a | Valid in the format; it's only our own representation limit. |
| `content-type-unknown` | Accepted. Shows "Unknown". | Accepted, except 0 (`kInvalid`), which content listing rejects. | RP shows "Unknown". ACC's new parser rejects. | Not found. | Accepted by both major tools. |
| `transfer-flags-unknown-bits` | Accepted. Labelled "Unknown" and kept. | Never read. | Read for display. Writers write 0. | Free60 lists the bits as "None". | Accepted everywhere. |
| `reserved-not-zero` | Never read; kept on save. | Never read. | Never read. Writers write zeros. | Not found. | Ignored everywhere. |
| `signature-padding-not-zero` | Never read. | Never read. | RP doesn't detect it as `LIVE`/`PIRS` (to avoid confusion with a Nintendo DS format, not for format reasons). | Not found. | Ignored by all but one, for an unrelated reason. |
| `signature-empty` | No RSA check anywhere. | No RSA check. | Every GOD writer writes an all-zero signature. | **A stock console rejects it; soft-modded consoles patch out the check** (xeBuild, XeUnshackle, FreeMyXe). | Normal for tool-made packages on modded consoles. |

**Caveats from the research**

- **Software leniency isn't console behaviour.** xenia loads unsigned and modded content by design, so "xenia ignores X" doesn't mean "the console ignores X". Apart from signature checks, the console's behaviour is almost entirely undocumented.
- **Layout disagreement:** rom-properties and Free60's version 2 table place a Series ID at `0x3B1`. emoose and ACC put the type-specific data at `0x3D9`, as the spec does. The spec's reserved range (`0x3B9`–`0x3D8`) matches emoose.
- **Iso2God quirk:** iso2god-rs and Iso2God write the data file count as a little-endian `u32` at `0x3A0`. That equals the big-endian value at `0x39D` only for counts below 256.

### Notes and references

- **Spec:** header overview, padding and metadata versions §6.1; magic and signature §6.2; content ID §6.3; metadata §6.4; text and thumbnails §6.5; identifying a package §6.9; confidence marks at the top of the spec.
- **Why V1 needs the padding:** the content ID is the SHA-1 of `0x344` up to the end of the padded header, not up to the header size (§6.3). This was confirmed on 2026-10-13 against all 772 real packages available (591 on the USB drive, 181 in the local copy), of every magic and both header sizes. Hashing only up to the header size matched none.
- **Why the content ID check is kept:** it's the only check that catches corruption or naive edits inside the metadata. Every other check only asks whether values are plausible.
- **Runtime requirements:** `globalThis.crypto.subtle` exists in browsers (in secure contexts only: https or localhost), Node 20+, Deno and Bun. The package's `engines` field says `"node": ">=20"`.
- **Relationship to the parse functions:** the parse functions report what's there, and fail only when a value can't be represented truthfully. V1 judges whether what's there is acceptable.
- **What V1 can't catch:** a thumbnail that spilled into the next field while declaring a size that fits. The PNG check catches most such cases (a cut-off image), and in metadata version 1, a spill into the title thumbnail also breaks its PNG signature. A spill into version 2's extra language block can't be detected reliably.
