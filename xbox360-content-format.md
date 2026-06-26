# Xbox 360 Content Format Reference

This document describes how the Xbox 360 stores, packages, and organises downloadable and installed content. It is intended as a precise technical reference for developers and AI working with Xbox 360 content libraries.

---

## 1. Overview

The Xbox 360 uses two related binary container formats for all packaged content:

- **STFS** (Secure Transacted File System) — the standard, single-file container used for the vast majority of content types.
- **SVOD** (Secure Virtual Offline Disk) — a split-file container used exclusively for large content that would exceed the FATX filesystem's 4 GB per-file limit. GOD (Games on Demand) packages use SVOD.
- **PEC** (Profile Embedded/Encrypted Content) — a third, less common variant also present in the XContent family.

Both STFS and SVOD share the same outer **XContent signed wrapper** — the same CON/LIVE/PIRS magic, certificate/signature block, and metadata fields. Their **volume descriptors** differ: the STFS descriptor encodes block layout and hash table positions; the SVOD descriptor encodes data block counts, cache element counts, and split-file layout. The key practical difference is whether the content payload is embedded in one file (STFS) or split across a header file and a companion `.data/` directory (SVOD).

---

## 2. Filesystem Structure

### Content Root

All downloadable and installed content lives under a `Content/` directory, typically at:

```
Hdd1:/Content/
```

or on a USB device at:

```
USB:/Content/
```

### Directory Hierarchy

```
Content/
  0000000000000000/         # System/public partition — content accessible by all profiles
    [TitleID]/              # One directory per game title (8-character hex, e.g. 4D5307E6)
      [ContentType]/        # One directory per content type (8-character hex, see §4)
        [header file]       # STFS or SVOD header file (no extension, arbitrary name)
        [header file].data/ # SVOD only — companion data directory
          Data0000
          Data0001
          ...
  [ProfileID]/              # Profile-specific partition (16-character hex)
    [TitleID]/
      [ContentType]/
        [header file]
```

### Key Points

- The `0000000000000000` partition holds content not tied to a profile — GOD game installs, title updates, DLC, XBLA purchases.
- Profile-specific partitions hold content tied to a gamertag — game saves, gamer pictures, themes, profiles.
- **Title** — the `[TitleID]/` directory and everything it contains. The Title ID is a 4-byte value assigned by Microsoft per game/application, represented as an 8-digit uppercase hex string in the directory name (e.g. `4D5307E6`).
- A title directory can simultaneously contain a GOD game install, multiple DLC packs, title updates, and game saves — each in their own `[ContentType]` subdirectory.
- The `[ContentType]` directory name is the 8-digit zero-padded lowercase hex representation of the content type value stored in the STFS header (e.g. `00007000`).

---

## 3. STFS — Single-File Container

STFS packages the content payload alongside metadata and a hash tree into a single monolithic file. Used for: game saves, XBLA games, DLC, title updates, profiles, themes, gamer pictures, and most other content.

### Header Magic (offset 0x000, 4 bytes)

The first 4 bytes identify the signing authority:

| Magic | Meaning |
|-------|---------|
| `CON ` | Console-signed — created and signed by a specific Xbox 360 console using its private key |
| `LIVE` | Microsoft-signed — marketplace content downloaded from Xbox Live |
| `PIRS` | Microsoft-signed, non-Live — official Microsoft content not distributed via Xbox Live |

### Signing and Lock Status

- **`CON`** packages are locked to the console that created them. The signing console's ID is embedded in the certificate at offset `0x006` (5 bytes). A package signed as CON with a zeroed console ID (`0000000000`) has been re-signed and functions on any console — common for scene releases and Horizon-resigned content.
- **`LIVE`** packages are signed with Microsoft's private key. They may be additionally locked to a specific Xbox Live profile.
- **`PIRS`** packages are Microsoft-signed but not Live-distributed. They are generally transferable across consoles.

### Certificate Structure (CON packages)

| Offset | Size | Field |
|--------|------|-------|
| 0x004 | 2 | Certificate owner console ID size |
| 0x006 | 5 | Certificate owner console ID |
| 0x00B | 20 | Certificate owner console part number |
| 0x01F | 1 | Console type: `0x01` = devkit, `0x02` = retail |
| 0x020 | 8 | Certificate date of generation |
| 0x1AC | 128 | RSA-1024 signature |

### Metadata (from offset 0x022C)

| Offset | Size | Field |
|--------|------|-------|
| 0x032C | 20 | Header SHA1 hash — integrity check over entire header |
| 0x0340 | 4 | Header size |
| 0x0344 | 4 | **Content type** (big-endian) — see §4 |
| 0x0360 | 4 | **Title ID** (big-endian) |
| 0x0379 | — | Volume descriptor (includes Media ID) |

The header also contains display name strings in multiple languages, description strings, up to two embedded thumbnail images (raw PNG/JPEG blobs), version numbers, and region flags.

### Block Structure

- Block size: **4,096 bytes** (0x1000)
- First data block at offset **0xC000**
- Blocks are addressed by number; hash tables are interspersed and are NOT counted as data blocks

### Hash Tree (3-level SHA1 integrity)

Every data block is verified through a three-level hash hierarchy:

- **L0 hash table** — inserted after every 170 (0xAA) data blocks; contains one 24-byte entry per block: SHA1 hash (20 bytes) + status byte + 3-byte next-block pointer
- **L1 hash table** — inserted after every 28,900 (0x70E4) blocks; hashes the L0 tables
- **L2 hash table** — used for very large packages; hashes the L1 tables

Verification hierarchy: RSA signature → header SHA1 → L2 → L1 → L0 → data blocks.

---

## 4. Content Types

The content type value at offset 0x0344 determines both what the package contains and which `[ContentType]` subdirectory it lives in on the filesystem. Directory names are the 8-digit zero-padded hex representation of the value.

Values below are sourced from the XboxInternals/Velocity project's `StfsConstants.h`.

| Content Type | Hex Value | Directory Name | Container | Notes |
|---|---|---|---|---|
| SavedGame | 0x00000001 | `00000001` | STFS | Player save data |
| MarketPlaceContent | 0x00000002 | `00000002` | STFS | Marketplace DLC and downloads |
| Publisher | 0x00000003 | `00000003` | STFS | Publisher content |
| Xbox360Title | 0x00001000 | `00001000` | STFS | Generic Xbox 360 title |
| IPTVPauseBuffer | 0x00002000 | `00002000` | STFS | IPTV buffer |
| InstalledGame | 0x00004000 | `00004000` | STFS/SVOD | Game installed from disc via NXE dashboard |
| XboxOriginalGame | 0x00005000 | `00005000` | STFS | Original Xbox backward-compatible game |
| **GameOnDemand** | **0x00007000** | **`00007000`** | **SVOD** | **GOD — full game digital download or disc rip** |
| AvatarAssetPack | 0x00008000 | `00008000` | STFS | Avatar asset bundle |
| AvatarItem | 0x00009000 | `00009000` | STFS | Individual avatar item |
| Profile | 0x00010000 | `00010000` | STFS | Gamertag profile data |
| GamerPicture | 0x00020000 | `00020000` | STFS | Gamer picture |
| Theme | 0x00030000 | `00030000` | STFS | Dashboard theme |
| CacheFile | 0x00040000 | `00040000` | STFS | Game cache |
| StorageDownload | 0x00050000 | `00050000` | STFS | Storage download |
| XboxSavedGame | 0x00060000 | `00060000` | STFS | Original Xbox save game |
| XboxDownload | 0x00070000 | `00070000` | STFS | Original Xbox download |
| GameDemo | 0x00080000 | `00080000` | STFS | Playable demo |
| GamerTitle | 0x000A0000 | `000A0000` | STFS | Game title content |
| **Installer** | **0x000B0000** | **`000B0000`** | **STFS** | **Title updates; sometimes called "TU" in modding community** |
| GameTrailer | 0x000C0000 | `000C0000` | STFS | Trailer video |
| **ArcadeGame** | **0x000D0000** | **`000D0000`** | **STFS** | **Xbox Live Arcade (XBLA) games** |
| XNA | 0x000E0000 | `000E0000` | STFS | XNA community game |
| LicenseStore | 0x000F0000 | `000F0000` | STFS | License data |
| Movie | 0x00100000 | `00100000` | STFS | Movie |
| Video | 0x00200000 | `00200000` | STFS | Video content |
| MusicVideo | 0x00300000 | `00300000` | STFS | Music video |
| GameVideo | 0x00400000 | `00400000` | STFS | Game video |
| PodcastVideo | 0x00500000 | `00500000` | STFS | Podcast video |
| ViralVideo | 0x00600000 | `00600000` | STFS | Viral/shared video |
| CommunityGame | 0x02000000 | `02000000` | STFS | Community-developed game |

The three content types most relevant to a modded console game library are highlighted: **GameOnDemand** (0x7000), **ArcadeGame** (0xD0000), and **Installer** (0xB0000).

---

## 5. SVOD — Split-File Container (GOD format)

SVOD is used exclusively for `GameOnDemand` (0x7000) content and, in some cases, `InstalledGame` (0x4000). It exists to work around FATX's 4 GB per-file size limit for large game installs.

### On-Disk Layout

```
[TitleID]/
  00007000/
    SomeGameName          # SVOD header file (~44 KB)
    SomeGameName.data/    # Companion data directory
      Data0000            # up to ~4 GB each
      Data0001
      Data0002
      ...
```

- The header file and its `.data/` directory share the same base name; the `.data/` directory appends `.data` as a suffix.
- Data files are named `Data0000`, `Data0001`, etc., zero-padded to 4 digits.
- The header file is approximately 44 KB and contains all metadata (same STFS header structure) plus the SVOD descriptor.
- The data files contain the raw game content split sequentially; they are read in order to reconstruct the full game image.
- The Xbox 360 kernel stitches the data files together transparently at runtime.

### Why SVOD Exists

The Xbox 360's internal storage uses the FATX filesystem, which has a hard 4 GB limit per file. A typical disc-based game image can be 6–8 GB. SVOD solves this by splitting the content across multiple files under a single SVOD header that describes the full set.

### Header File vs. Data Files

Only the header file needs to be read to obtain all package metadata (title, Title ID, content type, signing status, thumbnails, etc.). The data files contain only raw game content and carry no metadata. For a library browser or inspector tool, reading only the header file is sufficient and avoids loading gigabytes of data.

---

## 6. GOD (Games on Demand) — Detailed Notes

GOD is the colloquial name for the `GameOnDemand` (0x7000) content type. It is a digital format — never a disc format. Physical disc content must be explicitly converted into GOD format; the result is structurally identical to an official marketplace download.

### Sources of GOD Content

| Source | Signing | Notes |
|---|---|---|
| Xbox Live Marketplace purchase | `LIVE` | Official digital download; profile- or device-locked |
| Aurora dashboard Disk2God rip | `CON` | Signed with the ripping console's private key; console-locked |
| FreeStyle Dash (FSD) disc rip | `CON` | Same output format as Aurora Disk2God |
| NXE2GOD conversion | `CON` | Converts an NXE "Install to HDD" game to proper GOD format |
| Scene / internet release | Varies | May be `PIRS`, re-signed `CON` with zeroed ID, or unsigned |

### Relationship to Disc Games

A physical Xbox 360 disc is not in GOD format. When Aurora or FSD rips a disc, they read the disc's content and repackage it as a GOD (SVOD) container. The resulting file is functionally identical to a marketplace download of the same game.

### InstalledGame vs. GameOnDemand

The `InstalledGame` (0x4000) type is created by the official NXE dashboard's "Install to HDD" feature. It is a different internal layout from GOD (0x7000). NXE2GOD converts `InstalledGame` content to `GameOnDemand` format. A standard modded console game library will typically contain GOD (0x7000) rather than InstalledGame (0x4000).

---

## 7. Summary of Structural Differences by Content Type

| Content | Format | Has header file | Has `.data/` directory |
|---|---|---|---|
| GOD game (GameOnDemand) | SVOD | Yes (~44 KB) | Yes (Data0000, …) |
| XBLA game (ArcadeGame) | STFS | Yes (self-contained) | No |
| DLC (MarketPlaceContent) | STFS | Yes (self-contained) | No |
| Title Update (Installer) | STFS | Yes (self-contained) | No |
| Game Save (SavedGame) | STFS | Yes (self-contained) | No |
| Profile | STFS | Yes (self-contained) | No |
| Theme | STFS | Yes (self-contained) | No |

For all STFS types, the "header file" is the entire package — it is self-contained. The term "header file" in this project refers to the STFS or SVOD package identification file that carries the metadata header. For STFS types, it also carries all content data. For SVOD (GOD), it carries only metadata; actual game data lives in the `.data/` directory.

---

## 8. Quick Reference: Parsing a Header File

To identify a package programmatically:

1. Read bytes `0x000–0x003`: magic → `CON `, `LIVE`, or `PIRS`
2. Read bytes `0x344–0x347` (big-endian uint32): content type → see §4
3. Read bytes `0x360–0x363` (big-endian uint32): Title ID
4. For `CON` packages, read bytes `0x006–0x00A` (5 bytes): console ID
5. Check for sibling `.data/` directory: if present, this is an SVOD (GOD) package

The presence of a `.data/` companion directory is a reliable indicator that a package is SVOD/GOD (content type 0x7000), since no other common content type uses this split structure.

---

## 9. Display Name and Description Layout

Sourced from XboxInternals/Velocity `XContentHeader.cpp`, the Free60 STFS format reference, and verification against real Xbox 360 content files.

### Text metadata fields

| Field | Offset | Size | Notes |
|---|---|---|---|
| Display name | `0x0411` | `0x900` | 18 locale slots × `0x80` bytes each |
| Display description | `0x0D11` | `0x900` | 18 locale slots × `0x80` bytes each |
| Publisher name | `0x1611` | `0x80` | Single slot |
| Title name | `0x1691` | `0x80` | Single slot |
| Transfer flags | `0x1711` | `0x01` | |
| Thumbnail image (primary) | `0x171A` | `0x4000` (v1) / `0x3D00` (v2) | Raw PNG/JPEG blob |
| Thumbnail image (secondary/title) | `0x571A` | `0x4000` (v1) / `0x3D00` (v2) | Raw PNG/JPEG blob |

### String encoding

Display names, display descriptions, publisher name, and title name are encoded as **UTF-16BE (big-endian)** — the high byte is stored first. This is consistent with the Xbox 360 being a big-endian PowerPC system.

**Source discrepancies:**
- The Free60 Wiki incorrectly describes these fields as "UTF-8 strings".
- The rom-properties open-source project explicitly documents UTF-16BE as the standard and notes known content where UTF-8 bytes were incorrectly stored as UTF-16BE (producing mojibake in the title string — see South Park: The Stick of Truth in our test fixtures).
- Real-world byte inspection confirms BE: the character 'D' is stored as `0x00 0x44`, not `0x44 0x00`.

### Locale slots

Each display name and display description field contains **18 consecutive slots**, each `0x80` bytes (128 bytes = 64 UTF-16BE characters), null-padded to fill the slot.

**Observed slot pattern:** In all real-world files tested, non-empty display names appear only in even-indexed slots (0, 2, 4, 6, 8, 10, 12, 14, 16). Odd-indexed slots (1, 3, 5, …) are consistently empty. However, no public documentation definitively explains this pattern or provides an authoritative slot-index-to-language mapping. The exact language assigned to each slot index is not confirmed by any available public source.

**Read strategy:** parse all 18 slots and discard empty ones. Do not assume any specific slot index corresponds to a specific language without further research.

### Required read size

To cover all text metadata and stop before thumbnail data, a header read of **8 KB (`0x2000`)** is sufficient. The thumbnail area begins at `0x171A` (~5.9 KB), so parsing text fields only requires data up to `0x1712`.

### Metadata Version 2

When the `Metadata Version` field at `0x0348` is `2`, the thumbnail allocation size differs:

- **v1:** thumbnail at `0x171A`, `0x4000` bytes allocated
- **v2:** thumbnail at `0x171A`, `0x3D00` bytes allocated (smaller allocation, same offset)

**Important correction:** `0x3D00` is a **size**, not an offset. The thumbnail field does not move between metadata versions. An earlier version of this document incorrectly stated that v2 "moves" the thumbnail to `0x3D00`.

Version 2 also adds additional localised name/description blocks at higher offsets (`0x541A` and `0x941A`), but the primary metadata fields remain at the same offsets as version 1.
