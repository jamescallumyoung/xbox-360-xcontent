# Xbox 360 Content Partitions

This document defines the concept of a **partition** as used in this project and describes the two partition types found inside an Xbox 360 `Content/` directory.

> **Terminology note:** The term *partition* is defined by this project. No term is consistently agreed upon by the wider Xbox 360 modding and development community to describe these directories. *Partition* was chosen because each directory separates content into a distinct, non-overlapping ownership scope.

---

## 1. Where Partitions Live

Partitions are the **immediate children** of the `Content/` root directory:

```
Content/
  0000000000000000/     ← public partition
  E000ABCDEF123456/     ← profile partition (example)
  DEADBEEF01234567/     ← profile partition (another example)
  SomeOtherDir/         ← not a partition — ignored
```

A directory is a valid partition if and only if its name is **exactly 16 hexadecimal characters** (`/^[0-9a-fA-F]{16}$/`). Files and directories with any other naming pattern are not partitions and are ignored.

---

## 2. Partition Types

### 2.1 Public Partition

| Property | Value |
|---|---|
| Directory name | `0000000000000000` (exactly sixteen `0` digits) |
| Profile association | None |
| Count per `Content/` root | At most one |

The public partition holds content **not tied to any specific user profile** — content whose licence is attached to the device or to an Xbox Live account at the device level. Any profile signed in on the console can access content from the public partition.

Typical content found in the public partition:

| Content Type | Hex | Notes |
|---|---|---|
| GameOnDemand | `0x00007000` | Full game digital download or disc rip (SVOD) |
| InstalledGame | `0x00004000` | NXE "Install to HDD" disc install |
| ArcadeGame | `0x000D0000` | Xbox Live Arcade game |
| Installer | `0x000B0000` | Title update |
| MarketPlaceContent | `0x00000002` | Downloadable content (DLC) |

### 2.2 Profile Partition

| Property | Value |
|---|---|
| Directory name | 16 hex characters — the profile ID (e.g. `E000ABCDEF123456`) |
| Profile association | The directory name is the profile ID |
| Count per `Content/` root | One per gamertag that has been active on the device |

A profile partition holds content **tied to a specific gamertag**. The directory name is the 16-character hex representation of that gamertag's profile ID. Multiple profile partitions coexist when more than one account has used the device.

Typical content found in a profile partition:

| Content Type | Hex | Notes |
|---|---|---|
| SavedGame | `0x00000001` | Player save data |
| Profile | `0x00010000` | Gamertag profile data |
| GamerPicture | `0x00020000` | Gamer picture pack |
| Theme | `0x00030000` | Dashboard theme |

---

## 3. Classification Rules

```
directory name = 16 hex chars?
  └─ no  → not a partition (ignore)
  └─ yes → partition
       └─ name = "0000000000000000"? → public  (profileId: null)
       └─ otherwise                  → profile (profileId: directoryName)
```

Files (non-directories) inside `Content/` are always ignored, regardless of their name.

---

## 4. Inside a Partition

Both partition types share the same internal directory hierarchy:

```
[partition]/
  [TitleID]/              # 8-digit uppercase hex  (e.g. 4D5307E6)
    [ContentType]/        # 8-digit zero-padded hex (e.g. 00007000)
      [header file]       # STFS or SVOD header — no file extension
      [header file].data/ # SVOD only — GOD companion data directory
        Data0000
        Data0001
        ...
```

The `[TitleID]` directory name is the 8-character uppercase hex representation of the title's 4-byte Title ID. The `[ContentType]` directory name is the 8-digit zero-padded lowercase hex representation of the content type value stored in the STFS header.

For full details on `[TitleID]`, `[ContentType]`, STFS and SVOD structure, and header parsing, see [`xbox360-content-format.md`](xbox360-content-format.md).
