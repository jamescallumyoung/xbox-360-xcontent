# Xbox 360 Content Specification (v2)

This document describes what the Xbox 360 stores, where it stores it, and in what format. It replaces `xbox360-content-format.md` and `xbox360-content-partitions.md`. What those documents got wrong is listed in [xcontent-specification-corrections.md](xcontent-specification-corrections.md).

It is written for the developers and AI agents working on `xcontent-header`, `xcontent-fs-web` and the apps built on them, such as Loadout.

> **Status: complete.** All sections are written and reviewed. Some questions are still open. They are marked ❓ or 🔶 where they arise, and listed in the research record ([xcontent-specification-research.md](xcontent-specification-research.md)).

### How confidence is marked

| Mark | Meaning |
|---|---|
| ✅ | Verified against source code or primary documentation. Sources are listed in §8. |
| 🔶 | Widely reported, but not yet verified against a primary source. |
| ❓ | Open question. Do not rely on it. |
| ⚠️ | A warning to the reader. It isn't a confidence mark. |

---

## 1. The big picture

### Packages

The Xbox 360 keeps almost everything a user downloads, installs, saves or creates in **packages**. A package is a single unit of content, such as a game, a DLC pack, a save or a profile. Most packages are one file. Large ones are a small header file plus a directory of data files (§3.2). ✅

"Package" is the common term. Microsoft calls these *content packages*, and the community calls them *XContent packages*, after the `XContent` header they start with. ✅

Packages are stored on storage devices: hard drives, memory units, USB drives and, on some later models, built-in storage. ✅

> **Out of scope: discs and system flash.** Two other kinds of storage don't use packages, and this specification doesn't cover them. They are mentioned only where they help explain packages.
> - **Retail discs** hold the game's files directly, in the disc's own file system (§5). A game only becomes a package when it is converted or installed (§4.3). ✅
> - **Internal flash memory (NAND)** holds the console's own system software: most of the boot chain, the kernel, a copy of the dashboard, and data unique to the console, such as its keys and settings. ✅ Since a 2012 system update, the console runs the dashboard from the hard drive when one is present, and the copy in NAND is a fallback. ✅

#### Package metadata

Every package carries the same identifying information, with one exception: PEC, a cut-down package embedded inside some profile packages, leaves most of it out (§3.3).

- **What it is**, as a content type (game, DLC, save, theme and so on).
- **Which game or app it belongs to**, as a Title ID.
- **What kind of signature it declares**: a console, Microsoft through Xbox Live, or Microsoft outside Xbox Live (§2.2).
- **Display information**, such as a name, a description and thumbnails.

### The `Content/` directory

Packages live in a single directory tree called `Content/`. It is organised first by owner, then by Title ID, then by content type. ✅

Each storage device has its own, such as `Hdd1:\Content\`. 🔶

Each owner directory directly inside `Content/` is called a **partition**. There are two kinds:

- the **public partition**, `0000000000000000`, for content not tied to any profile
- a **profile partition** for each profile that has content on the device, named with that profile's 16-character ID

§2.1 describes both kinds in more detail.

```
Content/
  0000000000000000/      public partition
    <TitleID>/
      <ContentType>/
        <package files>
  <ProfileID>/           profile partition (one per profile)
    <TitleID>/
      <ContentType>/
        <package files>
  SomeOtherDir/          not a partition: ignored
```

> **Terminology note:** this specification defines the term *partition*. The wider Xbox 360 community has no agreed name for these directories. *Partition* was chosen because each directory holds content for one owner, and no two overlap. It has nothing to do with the partitions of a hard drive.

Not everything sits in this `Content/` directory. System software updates are installed to separate system areas of the hard drive (§4.7). Game caches and backward-compatibility data use other areas of the drive. Homebrew dashboards such as Aurora, and some homebrew software, also keep their own files elsewhere. ✅ §4.10 collects what's known about content outside `Content/`.

> **Aside: games and apps as raw files.** A game or app doesn't have to be a package. It can also be stored as a plain directory of files, with a `.xex` file at the top, usually `default.xex`. ✅
> - **XEX** (Xbox Executable) is the Xbox 360's program file format, similar to a `.exe` file on Windows. The console runs the `.xex`, and the program reads the other files in its directory. ✅
> - **Game discs** ship like this: a retail DVD holds a `default.xex` and the game's files. ✅
> - **Homebrew** apps and dashboards usually ship like this. Their program file is typically `default.xex`, but not always. ✅
> - **Extracted disc rips** are a copy of a disc's files in this form (§4.3). ✅
>
> Games and apps in `.xex` format are not packages. They also bundle their metadata in a different way, so they are incompatible with tools that are designed for packages. 

### Title IDs

Every game and app has a **Title ID**: a 4-byte number, written as 8 uppercase hex digits, such as `4D5307E6` for *Halo 3*. It names the directory under each partition. ✅

- **One Title ID covers a whole game.** Every disc of a multi-disc game shares it, and so do the game's title updates, DLC and saves. ✅ A Games on Demand copy has the same Title ID as the disc version. 🔶
- **Different releases can have different Title IDs.** Some regional versions and re-releases of the same game have their own. 🔶
- **How Title IDs are built.** By convention, the first two bytes are a two-letter publisher code (`4D53` is "MS", for Microsoft), and the last two are that publisher's game number. Original Xbox games are numbered below 2000, and Xbox 360 games from 2000 up. ✅ This is only a convention, which the console doesn't enforce. Tools mustn't assume the first two bytes are letters. ✅
- **Special ranges:**
  - Title IDs starting `FFFE` are reserved for system software, such as `FFFE07D1` for the dashboard (§4.7). ✅
  - Title IDs whose publisher code starts with "X" (`58`) are Microsoft platform titles. "XA" is Xbox Live Arcade, "XH" and "XJ" are apps, and "XN" and "XM" are system experiences, such as the avatar editor. ✅
  - Homebrew uses made-up Title IDs (§4.7). 🔶

### Content types

Every package has a **content type**: a number that says what kind of content it is, such as a game, a DLC pack or a save. The content type is stored in the package's metadata. It also names the directory the package sits in, under its Title ID:

```
<partition>/<TitleID>/<ContentType>/<package files>
```

The directory name is the content type's ID written as 8 uppercase hex digits, without the `0x`. For example, Games on Demand (`0x00007000`) go in `00007000/`. ✅

The content types most common on a modded console are below. The full list is in §4.2, and the many kinds of "game" are explained in §4.3.

| Name | Description | ID | Directory name |
|---|---|---|---|
| SavedGame | A game's save data | `0x00000001` | `00000001` |
| MarketplaceContent | Downloadable content (DLC) from the Marketplace | `0x00000002` | `00000002` |
| XboxTitle | An original Xbox game | `0x00005000` | `00005000` |
| GameOnDemand | A full disc game as a download, or converted from a disc (GOD) | `0x00007000` | `00007000` |
| AvatarItem | One avatar item, such as clothing or a prop | `0x00009000` | `00009000` |
| Profile | A player profile | `0x00010000` | `00010000` |
| GamerPicture | A gamer picture pack | `0x00020000` | `00020000` |
| GameDemo | A playable demo | `0x00080000` | `00080000` |
| Installer | A title update (game patch) or other install package | `0x000B0000` | `000B0000` |
| ArcadeTitle | An Xbox Live Arcade (XBLA) game | `0x000D0000` | `000D0000` |

Names vary between tools. §4.1 explains this and lists other names in use.

---

## 2. Who owns content, and who can use it

### 2.1 Public and profile partitions

A directory directly inside `Content/` is a partition only if its name is exactly 16 hexadecimal characters. Anything else directly inside `Content/`, file or directory, is not a partition and is ignored. The exact rules are in §7.1.

Which partition a package goes in is decided by the game, app or system software that writes it, not by its content type. When it creates a package, it says either which profile the package is for, or that it's for no profile. ✅ In practice, each kind of content nearly always goes in the same place, as the lists below show.

**The public partition** (`0000000000000000`) holds packages not tied to any one profile. When a game or the system software lists content, every signed-in profile sees the packages in it. ✅ Being visible doesn't mean being usable, though: a package's licence can still restrict who may use it (§2.2). A `Content/` directory has at most one public partition.

Typical content in the public partition:

- DLC (`00000002`) and title updates (`000B0000`) ✅
- avatar items (`00009000`) ✅
- gamer pictures (`00020000`) and themes (`00030000`) 🔶
- Games on Demand (`00007000`), Arcade games (`000D0000`) and demos (`00080000`) 🔶
- disc installs (`00004000`) 🔶

**A profile partition** holds content tied to one profile. Its name is the profile's ID: 16 hex digits, which is also the file name of the profile package. ✅ The digits typically start with `E`, for example `E812CECF9EA2AF5F`. 🔶 It is not the profile's Xbox Live ID, which is a different number stored inside the profile. ✅

A profile partition exists only on a device where something belonging to that profile is stored. 🔶 So a device can have a profile partition without the profile itself: for example, a profile's saves can be on the hard drive while the profile is on a memory unit. ✅ (A real USB drive held a profile partition of saves with no profile package.) A partition may also be left behind after its profile has been deleted. 🔶 A profile can be deleted in many ways: by hand on a FAT32 USB drive, by official dashboards of different versions, by unofficial dashboards and by homebrew tools. Not all of them are likely to clean up. So tools should assume that profile partitions without a profile, and other leftovers, will be found.

Typical content in a profile partition:

- the profile itself (`00010000`) ✅
- saves (`00000001`) ✅ A game can also put saves in the public partition, but this is unusual. 🔶 Apps commonly do (§4.9). ✅

### 2.2 Signing and licensing, in plain terms

Every package declares one of three kinds of signature, shown by the label at the start of the file (except PEC, §3.3). ✅ The signature controls whether the console trusts the package. Whether a package can be used on another console or by another profile is decided by its licence and its header IDs (see below). A package can declare a kind without being genuinely signed. Tools that make or edit packages often can't produce a real Microsoft signature (§2.3).

| Signed by | Label in the file | Typical content | Can it move to another console? |
|---|---|---|---|
| A console | `CON` | Saves, profiles, cache files ✅. Probably disc installs 🔶 | Yes. Any console can check a `CON` signature. ✅ A game may still refuse a save made under a different profile. |
| Microsoft, through Xbox Live | `LIVE` | Marketplace downloads: games, DLC, themes, avatar items ✅ | Yes, but using it needs a licence (see below). ✅ |
| Microsoft, outside Xbox Live | `PIRS` | System updates and content on game discs ✅. Some title updates (§4.5) 🔶 | Generally yes. 🔶 |

**Licences.** Signing says whether the console trusts a package. A licence says who may use it. ✅

- **Purchased content** gets two licences. ✅
  - One is for the account that bought it. The buyer can use the content on any console while signed in to Xbox Live.
  - The other is for the console it was first downloaded to. Every profile on that console can use it, online or offline.

  Microsoft's licence transfer tool moves the console licence to a new console, at most once every four months. ✅
- **Saves and other console-signed packages** usually have a licence that allows anyone. ✅ They can be copied to another console, and Microsoft suggests a USB drive for this. ✅ They are tied to a profile, and sometimes to a storage device, through IDs in their header. ✅ So moving a save to another profile means changing those IDs and re-signing it with a tool such as Velocity or Horizon (§2.3).
- **Where a package is stored doesn't change its licence.** A licensed package in the public partition is still restricted. ✅
- **On a modded console**, tools such as Velocity can "unlock" a package by rewriting its licence to allow anyone. That breaks the Microsoft signature, so an unlocked package only works on a modded console. ✅ ❓ Whether a modded console also ignores licences without unlocking, so that purchased content copied to it plays as-is, is unknown.

### 2.3 Genuine and fake signatures

Every package has a signature in its header: the format always reserves room for one. ✅ PEC has no label, but it still starts with a console certificate (§3.3). ✅ What fills that room isn't always genuine:

- **Tool-made packages.** Iso2God and iso2god-rs start from a blank `LIVE` header, with an empty signature. ✅ Aurora's Disc to GOD also writes a `LIVE` package with an all-zero signature, not a console-signed disc install. ✅ (Checked on 8 real Disc to GOD rips.) None of these has a genuine Microsoft signature, since only Microsoft holds that key. ✅
- **Edited packages.** Once a save or profile has been edited on a PC, its hashes have to be recalculated and the package re-signed. ✅
  - **`CON` packages:** tools such as Velocity and Horizon re-sign them with the private key from a real console's keyvault (`KV.bin`). Any genuine retail keyvault works, so even a stock console accepts the result. ✅ A re-signed `CON` package is genuinely signed, just not by the console that made it.
  - **`LIVE` and `PIRS` packages:** no tool can produce a genuine signature. ✅
- **Unlocked packages** (§2.2) no longer match their Microsoft signature. Some unlocking tools overwrite it with a marker instead (§4.8). ✅ Unlocking tools may keep the original header in a `BACKUP/` directory (§4.8). ✅
- **Homebrew packages** may carry blank signatures, or a `CON` signature made with someone else's keyvault. 🔶

**Whether this matters depends on the console.** A stock console treats a package that isn't genuinely signed as corrupt. ✅ A soft-modded console runs a patched kernel that skips the `LIVE` and `PIRS` signature checks, which is why tool-made packages, such as a Disc to GOD rip, work on it. ✅

For anyone reading packages, the label says only which kind of signature a package *claims*. A `LIVE` label is not proof that a package came from Xbox Live.

---

## 3. Package formats: a short summary

A **package format** is the way a package is built: how its contents are laid out inside it, and how the console checks that they haven't been changed. Some tools, notably xenia, call this a *container format*. ✅

Every package format starts with the same kind of header, which holds the package's metadata and its signature (§2.2).

There are two package formats, STFS and SVOD. No source defines any other. ✅ A third, PEC, is a cut-down variant of STFS that is only found inside profile packages (§3.3).

### 3.1 STFS: single-file packages

**STFS** (Secure Transacted File System) is the standard package format. The whole package is one file containing three parts:

- a header that describes it
- a small file system holding the package's own files
- a tree of hashes that lets the console detect tampering

The file system inside is a real one: files are stored in fixed-size blocks, with a table of file names and their blocks. The console mounts an STFS package and reads its files through it, much as a Mac mounts a `.dmg` disk image. It is not like a `.tar` archive, which just stores files one after another. ✅

"Transacted" refers to how STFS handles changes. Free60 says only that it keeps "multiple file / directory revisions". In writable packages (`CON`), every hash table has two copies, and a flag says which copy is current. Read-only packages (`LIVE` and `PIRS`) keep one copy. ✅ This suggests the console writes changes to the spare copy and then switches over, so an interrupted save can't corrupt the package. No source describes this, though. 🔶

Saves, DLC, title updates, profiles, Arcade games, themes and most other content use STFS.

### 3.2 SVOD: split packages for large content

**SVOD** (Secure Virtual Optical Disc 🔶) holds a whole disc image, such as a full game. A disc image is too big for one file on the console's file system, so SVOD splits it into two parts:

- a **header file** of exactly 45,056 bytes (44 KiB), holding the same kind of header as STFS
- a **companion directory** with the header's name plus `.data`, holding numbered data files (`Data0000`, `Data0001`…) of about 163 MB each

The two parts are one package. Copying, moving or deleting one without the other breaks the game.

A finished package's `.data` directory holds only `Data####` files. ✅ The one exception found is a download still in progress, whose `.data` directory also holds a header file (§4.4).

Unlike STFS, SVOD has no file system of its own. It is a signed, hashed wrapper around a disc image, much like a signed `.iso` split into pieces. The game's files are inside that disc image, in the disc's own file system, XDVDFS (§5). ✅ The disc image's start is marked with the disc format's magic, `MICROSOFT*XBOX*MEDIA`.

> **Checked against real files.** This repo's test fixtures include two real GOD headers, from *Dead Island Riptide* and *South Park: The Stick of Truth*. Both are exactly 45,056 bytes, with volume type 1 (SVOD). Their data file counts are 22 and 23, which match their combined data sizes (3.43 and 3.63 GiB) split into ~163 MB files. Two real DLC packages in the fixtures have volume type 0 (STFS) and a data file count of 0. ✅

SVOD is used for Games on Demand, and for original Xbox games, whether bought from Xbox Live or converted with tools such as Iso2God. Disc installs made by the dashboard use it too, in the same layout as GOD. ✅ Because it is a format and not a content type, the only reliable test is the package's header (§6.9).

> **About the name.** Microsoft never spells out the acronym SVOD. A Microsoft patent calls this layer a "secure virtual optical disc", which matches the initials. One community wiki, Xeren, says "Secure Virtual Offline Disk" instead, without a source. This spec uses Microsoft's wording. 🔶

### 3.3 PEC: profile embedded content

**PEC** (Profile Embedded Content) is an STFS package with most of its header removed. It isn't stored in `Content/` on its own. It is a file named `PEC` inside a profile package (§4.6).

- **What it holds:** the GPD files for a player's avatar awards (§3.4), and some other GPD files moved there from the profile. Free60 describes PEC as "an additional layer of security on profiles".
- **How it differs from STFS:** it has no `CON`/`LIVE`/`PIRS` magic, no display information and no thumbnails. Its short header has the console's certificate, the profile's ID and the ID of the console it belongs to. The details are in §6.

### 3.4 File formats found inside packages

These are not package formats. They are the kinds of file a package can hold.

| Format | What it is | Where it appears |
|---|---|---|
| **XEX** (Xbox Executable) | A game's or app's program file, such as `default.xex` | Discs, game packages, title updates, extracted rips. ✅ |
| **XDBF / GPD** (Xbox Database File / Gamer Profile Data) | A small database for one title: its achievements, images, settings and strings. The dashboard's GPD also lists every game the profile has played. | Inside profile packages, named `<TitleID>.gpd`: one per game played, plus `FFFE07D1.gpd` for the dashboard. Avatar award GPDs are inside the PEC. ✅ |
| **Account** | The profile's identity: gamertag, Xbox Live ID, passcode and Xbox Live subscription details. Encrypted. | A 404-byte file named `Account` inside each profile package. ✅ |
| **Images** (PNG) | Thumbnails, gamer pictures, avatar renders | In package headers and inside packages. ✅ |
| **SPA** | A game's built-in definitions of its achievements, stats and settings. It is an XDBF file, and is used to build the game's GPD when the game is played. | Not a separate file: a resource inside the game's `.xex`, named after its Title ID. ✅ |
| **XEXP** (XEX patch) | A patch that updates a game's `.xex` | Inside title update packages. ✅ |
| **FMIM** | Music ripped from a CD: a WMA file with a small header | System music storage, outside `Content/` (§4.10). ✅ |
| **Game-defined files** | Whatever a game chooses to write | Inside saves and DLC; the format is the game's own. ✅ |

One more format looks like a package format but isn't:

- **XCP** (Xbox Content Package) is how Xbox Live delivers downloads: an STFS package, compressed and usually encrypted. It is unpacked on download, so it never appears in `Content/`. ✅

**XUI resource archives** (`.xzp`) aren't packages either. They hold user-interface screens and images, and are usually stored inside `.xex` files as resources, or as system files in flash memory. 🔶

---

## 4. Content types: what is stored, and in what format

This section lists every content type, then describes each kind of content in turn: what it is, which content type it uses, and what format it is stored in.

### 4.1 Content type names

⚠️ **Content type names aren't consistent across the community.** Microsoft's own names aren't public, so each tool picks its own. The names in §4.2 follow the majority of four sources: xenia, Velocity, Free60 and rom-properties (§8). Other names in use are listed alongside. The IDs are consistent across all sources. ✅

### 4.2 Full list of content types

| Name | Other names | Description | ID | Directory name |
|---|---|---|---|---|
| SavedGame | | A game's save data | `0x00000001` | `00000001` |
| MarketplaceContent | MarketPlaceContent (Velocity, this repo) | Downloadable content (DLC) from the Marketplace | `0x00000002` | `00000002` |
| Publisher | | Data shared between one publisher's games | `0x00000003` | `00000003` |
| Xbox360Title | | An Xbox 360 game or app | `0x00001000` | `00001000` |
| IPTVPauseBuffer | | Pause storage for live TV (IPTV services) | `0x00002000` | `00002000` |
| XNACommunity ❓ | | XNA community content. Only xenia lists it. | `0x00003000` | `00003000` |
| InstalledGame | | A disc game installed to the hard drive by the dashboard | `0x00004000` | `00004000` |
| XboxTitle | XboxOriginalGame (Velocity, this repo) | An original Xbox game | `0x00005000` | `00005000` |
| SocialTitle ❓ | | A social app or title. Only xenia lists it. | `0x00006000` | `00006000` |
| GameOnDemand | GamesOnDemand (xenia) | A full disc game as a download, or converted from a disc (GOD) | `0x00007000` | `00007000` |
| SUStoragePack | AvatarAssetPack (Velocity, this repo), SystemPacks | A system update storage pack: content that ships inside a system update, such as the avatar system's base assets. Installed under the system Title ID `FFFE07DF`. ✅ | `0x00008000` | `00008000` |
| AvatarItem | | One avatar item, such as clothing or a prop | `0x00009000` | `00009000` |
| Profile | | A player profile | `0x00010000` | `00010000` |
| GamerPicture | | A gamer picture pack | `0x00020000` | `00020000` |
| Theme | | A dashboard theme | `0x00030000` | `00030000` |
| CacheFile | | Cached game data | `0x00040000` | `00040000` |
| StorageDownload | | Downloaded storage content | `0x00050000` | `00050000` |
| XboxSavedGame | | An original Xbox game's save data | `0x00060000` | `00060000` |
| XboxDownload | | Downloaded content for an original Xbox game | `0x00070000` | `00070000` |
| GameDemo | | A playable demo | `0x00080000` | `00080000` |
| Video | | A video. Missing from Velocity and this repo. | `0x00090000` | `00090000` |
| GameTitle | GamerTitle (Velocity, this repo) | Game title content. One real example: Windows Media Center's `MCXFile` (§4.7). | `0x000A0000` | `000A0000` |
| Installer | | A title update (game patch) or other install package | `0x000B0000` | `000B0000` |
| GameTrailer | | A game trailer video | `0x000C0000` | `000C0000` |
| ArcadeTitle | ArcadeGame (Velocity, this repo) | An Xbox Live Arcade (XBLA) game | `0x000D0000` | `000D0000` |
| XNA | | Saves and data for XNA (Indie) games (§4.3) | `0x000E0000` | `000E0000` |
| LicenseStore | | Licence data | `0x000F0000` | `000F0000` |
| Movie | | A film | `0x00100000` | `00100000` |
| TV | Video (Velocity, this repo) | A TV episode | `0x00200000` | `00200000` |
| MusicVideo | | A music video | `0x00300000` | `00300000` |
| GameVideo | | A video about a game | `0x00400000` | `00400000` |
| PodcastVideo | | A video podcast | `0x00500000` | `00500000` |
| ViralVideo | | A shared or viral video | `0x00600000` | `00600000` |
| CommunityGame | | A community (Xbox Live Indie) game | `0x02000000` | `02000000` |

The four sources in §4.1 give only each content type's name and ID. The descriptions in this table are inferred from those names and from community knowledge. 🔶

### 4.3 Games

Many content types hold something that could be called a game. They differ in where the game came from and how the console runs it.

| Content type | What it is | Where it comes from | Package format | On a modded console's drive |
|---|---|---|---|---|
| GameOnDemand (`00007000`) | A full retail disc game, packaged to run from storage | Bought from Xbox Live (`LIVE`), or converted from a disc (see below) | SVOD | Very common ✅ |
| InstalledGame (`00004000`) | A copy of a disc game on the hard drive, to speed up loading. The disc is still needed to play. | The dashboard's "Install to Hard Drive" (`CON`, signed by that console 🔶) | SVOD ✅ | Uncommon. NXE2GOD converts these to GameOnDemand. 🔶 |
| ArcadeTitle (`000D0000`) | A smaller, download-only Xbox Live Arcade game | Xbox Live (`LIVE`) | STFS | Common ✅ |
| XboxTitle (`00005000`) | An original Xbox game, run through the backward-compatibility emulator | Xbox Live ("Xbox Originals"), or converted with tools such as Iso2God | SVOD | Occasional 🔶 |
| GameDemo (`00080000`) | A free, limited version of a game | Xbox Live | STFS | Occasional 🔶 |
| CommunityGame (`02000000`) | An Xbox Live Indie Game: a small game made by an independent developer with XNA | Xbox Live | STFS 🔶 | Occasional 🔶 |
| XNA (`000E0000`) | Saves and data for Indie Games. Under the XNA Indie Player's Title ID (`584E07D2`), with lowercase GUID names. ✅ The earlier XNA Creators Club may have used it too. ❓ | Made by the console (`CON`) ✅ | STFS ✅ | Occasional 🔶 |
| XNACommunity (`00003000`) | ❓ Only xenia lists it. | ❓ | ❓ | Rare ❓ |
| Xbox360Title (`00001000`) | ❓ An Xbox 360 game or app package. What uses this type in practice is unclear. | ❓ | ❓ | ❓ |
| GameTitle (`000A0000`) | ❓ Unclear. The one real example is Windows Media Center's `MCXFile`, under `FFFE07D1`. | Made by the console (`CON`) | STFS | Rare 🔶 |
| SocialTitle (`00006000`) | ❓ A social app or title. Only xenia lists it. | ❓ | ❓ | ❓ |

Notes on games:

- **Games on Demand are stored in the public partition**, at `Content/0000000000000000/<TitleID>/00007000/`. ✅
- **GOD made from a disc** (Aurora's Disc to GOD, Iso2God and similar) has a `LIVE` header that isn't really signed, so it runs only on a modded console. Tools put it in the right place only if the user lets them create the directories. Each disc of a multi-disc game is its own package in the same directory. ✅
- **Homebrew can appear as a GameDemo.** XeXMenu ships as a `CON` package at `Content/0000000000000000/C0DE9999/00080000/C0DE99990F586558`, so it shows up in the stock dashboard's demos. 🔶
- **CommunityGame and XNA:** ❓ it isn't clear whether Xbox Live Indie Games use CommunityGame in practice. On a real drive, a bought Indie Game was a `00000002` package under `584E07D2`, and its saves were XNA (`000E0000`) packages. ✅
- **Retail discs** aren't packages (§1, out of scope). The console can't run a disc game from storage unless it has been installed or converted. ✅
- **Extracted disc rips** aren't packages either. They are made by Aurora's Disc Ripper, its File Manager copy, FSD's DVD Extract and XeXMenu's CopyDVD. Each is a plain directory of the disc's files, with `default.xex` at the top (§1, "Aside: games and apps as raw files"). They sit wherever the user chose, usually outside `Content/` (for example `Hdd1:\Games\<name>`). They run only on a modded console. Tools that read packages don't see them. ✅

These content types sound like games but aren't:

- **Installer** (`000B0000`): a title update for a game, not the game itself (§4.5).
- **GameTrailer** (`000C0000`) and **GameVideo** (`00400000`): videos about a game.
- **SavedGame** (`00000001`) and **XboxSavedGame** (`00060000`): save data.
- **MarketplaceContent** (`00000002`): DLC for a game.

### 4.4 DLC, Marketplace content and other downloads

| Kind of content | Format | Content type |
|---|---|---|
| **DLC** (map packs, add-ons) | STFS, `LIVE` | `00000002` ✅ |
| **Avatar items** (clothing, props) | STFS, `LIVE` | `00009000` ✅ |
| **Gamer pictures** | STFS | `00020000` ✅ |
| **Dashboard themes** | STFS | `00030000` ✅ |
| **Videos** (trailers, movies, TV, music videos) | STFS | `000C0000`, `00100000`–`00600000` 🔶 |
| **Licence store** | STFS, signed `CON` or `LIVE` ✅. ❓ What it holds, and where it is stored, is undocumented. | `000F0000` ✅ |

Films and TV bought or rented from Xbox Live are probably Movie (`00100000`) and TV (`00200000`) packages in the public partition, like other Marketplace downloads. 🔶

Title updates are covered in §4.5.

**Downloads in progress.** While the dashboard downloads content, it keeps a placeholder package in the content's own directory. ✅ It is easy to mistake for the content itself:

- It is a `CON` package with the display name "Title Content Progress cache", and metadata version 1 (§6.1).
- It is named after the finished package (§5): 42 digits in `00000002` or `00080000`, 34 in `00007000`.
- Its header doesn't describe the content. It says content type `000B0000`, Title ID `FFFE07D1` (the dashboard), and the downloading account's XUID as the profile ID.
- For STFS content, it is as large as the content downloaded so far.
- For a GOD download, it is small (73,728 bytes) and has its own `.data/` directory. That directory holds the delivered GOD header, a `PIRS` header with no licences, and the `Data####` files downloaded so far. The placeholder's data file count includes that header.

What happens to it when the download finishes isn't known. 🔶 Tools should skip it (§7.2).

### 4.5 Title updates

A **title update** (TU) is a patch for a game, released after the game. Its content type is Installer (`000B0000`). ✅

- **Format:** STFS, signed `LIVE`. ✅ Some may be `PIRS`. 🔶 All 44 on the real drives checked (§8.3) were `LIVE`, with metadata version 1 and one unrestricted licence. ✅
- **Contents:** a patch to the game's executable, `default.xexp` (§3.4). ✅
- **Title ID:** the game's own (§1). ✅

**Where title updates are stored.** Title updates are kept in one of two places, depending on how they are named: 🔶

- **Newer title updates**, named in lowercase like `tu00000002_00000000`, are packages in the public partition, at `Content/0000000000000000/<TitleID>/000B0000/`.
- **Older title updates**, named in uppercase like `TU_16L61V6_0000008000000.00000000000O2`, sit in the drive's cache area (`Hdd1:\Cache`). Clearing the system cache deletes them. ✅ (Microsoft: "Clearing the cache does remove previously downloaded game updates.")

**Names.** Every title update on the real drives was named `tu<8 hex digits>_<8 hex digits>`, in lowercase. ✅ The first number isn't the update's number: *Fallout: New Vegas*'s "Title Update #5" is `tu00000001_00000000`. ❓ What the numbers mean is unknown.

**Title updates aren't cumulative layers.** A title update holds a patch, `default.xexp`, made against the base game's `default.xex`, never against an earlier update. ✅ So each update stands alone: a later one doesn't need the earlier ones, and includes their changes. 🔶 Only one is active at a time. ✅ An update applies only to the build it was made for. xenia checks a hash in the patch against the game's `.xex` and skips an update that doesn't match. ✅ A game with several builds (regions, disc and GOD versions, or discs of a multi-disc game) may have a separate update line for each. 🔶 So a store of title updates may hold several updates for one title, not all of which will apply to a given copy.

**Matching a build.** A title update's media ID (`0x354`, §6.4) is probably that of the build it patches. 🔶 On the real drives, it matched the game's media ID for 4 of 5 titles. The exception was *Skyrim*: the game was an Xbox Live GOD, and its title update had a different media ID, probably the disc build's. So a matching media ID is a cheap hint that an update applies, but not proof. 🔶

On a modded console, Aurora downloads title updates from the community site xboxunity and lets the user choose which one is active.

### 4.6 Player profiles, including avatars

A **profile** is a player's identity on the console. Each one is a single STFS package, signed by the console it was created on. ✅ It lives at:

```
Content/<ProfileID>/FFFE07D1/00010000/<ProfileID>
```
(`FFFE07D1` is the dashboard's Title ID.) ✅

Inside the profile package are several files:

- the **Account** file: gamertag, Xbox Live details and core settings, encrypted ✅
- one **GPD** file per game played, holding that game's achievements and per-game settings ✅
- a **dashboard GPD** (`FFFE07D1.gpd`), holding the list of games played and profile settings such as the gamerscore, motto and gamer picture ✅
- **images**: the gamer picture, as `tile_64.png` and `tile_32.png` ✅. The rendered picture of the avatar is not a file: it is an image stored inside the dashboard GPD ✅
- a **PEC** holding the avatar award GPDs (§3.3) ✅

**Avatars.** A player's avatar is stored in three places:

- **Its look** is a setting in the dashboard GPD. ✅ There is no separate avatar file.
- **Avatar items** the player owns, such as clothing and props, are separate packages (`00009000`, §4.4). ✅
- **Avatar awards** a game gives are in two parts. The record of earning one is kept in a GPD inside the PEC. ✅ The item itself is an ordinary avatar item package. When an award unlocks, the game reports only which award it is. The system then fetches the item, most likely from Xbox Live, and stores it. 🔶 It sits in the public partition, under the awarding game's Title ID, at `Content/0000000000000000/<TitleID>/00009000/`, the same place as avatar items bought on the Marketplace. ✅ On a real drive, award items were `PIRS` and bought items `LIVE`. 🔶 (Which items were awards was judged by their names.) Community tools also build award items as `PIRS`. Avatar item packages are named with their asset ID (§5).

### 4.7 System content

The console keeps some of its own content as packages, in the same layout as everyone else's. This section covers that system content.

> **There is a second `Content/` directory.** The System Extended area of the hard drive (§5) has its own `Content/` tree, laid out exactly like the user's: partitions, then Title IDs, then content types. ✅ It is hidden from users, and this specification doesn't cover it. Everywhere else, "`Content/`" in this spec means the user's directory, in the main data area.
>
> The System Extended area was added in 2008, with the System Auxiliary area, to hold system features too large for the flash memory, such as avatars and later Kinect. Since late 2012 the dashboard itself also runs from there. ✅

#### Content types found only in the system `Content/` directory

| Content type | Where | What it holds | |
|---|---|---|---|
| SUStoragePack (`00008000`) | `Content/0000000000000000/FFFE07DF/00008000/` | System update storage packs: system components installed by a system update, such as the avatar system's base assets and Kinect assets | ✅ |

❓ Whether any other content types appear there is unknown. System updates list their packages in a manifest, which could name others.

#### System content in the user's `Content/` directory

Some system content does sit in the user's `Content/` directory, under system Title IDs:

- **Profiles** (`00010000`) live under the dashboard's Title ID, `FFFE07D1`, in each profile partition (§4.6). ✅
- **Gamer pictures and themes** (`00020000` and `00030000`) live under `FFFE07D1` in the public partition (§2.1). ✅ The gamer pictures come in two kinds: `PIRS` packs named `FFFE07D1<4 digits>.GamerPicture`, and console-made `CON` caches named with a game's Title ID in lowercase, such as `4d5307d6`.
- **The optional media update**, which adds MP4, DivX and Xvid playback, is a `00000002` package at `Content/0000000000000000/FFFE07DF/00000002/`. ✅
- **System data packages** under `FFFE07DF`, all console-made `CON`: ✅
  - `00040000/ContentCache.pkg` (the content cache), `InGameAccessTimes` and `Bookmarks.dat` (video bookmarks)
  - `000F0000/JanusDatastore.dat`, a "Rights Database" for Zune
- **Other system packages:** `FFFE07D1/000A0000/MCXFile` (Windows Media Center) and `584D07D1/00040000/asset_refresh_cookie` (the avatar editor). ✅

#### Known system Title IDs

| Title ID | What it is | |
|---|---|---|
| `FFFE07D1` | The Xbox 360 dashboard. Profiles live under it. | ✅ |
| `584D07D1` | The avatar editor | ✅ |
| `FFFE07DF` | System content: system update storage packs, the optional media update and a content cache | ✅ |
| `FFFE07D2` | The original Xbox backward-compatibility emulator | ✅ |
| `FFFE07DE` | Xbox Live sign-up. Its GPD appears in profiles created through it. | ✅ |
| `584E07D1` | XNA Creators Club | 🔶 |
| `584E07D2` | The XNA Indie Player, for Xbox Live Indie (community) games | ✅ |

Homebrew uses made-up Title IDs that look like these: 🔶

- `FFFF0055` is used by XeXMenu, and reused by other homebrew.
- `C0DE9999` is the directory XeXMenu's package installs to (§4.3), and other homebrew installs there too.
- `FFFF011D` is DashLaunch, and `F5D10000` is FreeStyle Dash.

### 4.8 Other stored content

Other content found as packages in `Content/`:

| Kind of content | What it is | Content type |
|---|---|---|
| **Cache packages** | Cached data, such as the system content cache under `FFFE07DF` (§4.7) | `00040000` ✅ |
| **Original Xbox saves and downloads** | Saves and downloaded content for original Xbox games | `00060000` and `00070000` ❓ |
| **IPTV pause buffer** | Live TV pause storage (IPTV services) | `00002000` ❓ |

> **Aside: unlocked packages and `BACKUP/` directories.** On a real drive, unlocked Games on Demand came with the original header kept beside them: ✅
>
> - **Where:** a `BACKUP/` directory inside the content-type directory, holding a header with the same name, such as `…/00007000/BACKUP/<header name>`. One title used a `7000_BACKUP/` directory next to `00007000/` instead.
> - **What changed:** the licences (§6.3) and the signature. ✅ The original had the buyer's XUID licence and a console licence. The unlocked copy has two unrestricted licences (`0xFFFFFFFFFFFFFFFF`). Arcade games on the same drive had the same pair.
> - **The signature** was overwritten with the ASCII text `ByromWasHereUnlockingYourGODGame`, repeated to fill all `0x100` bytes. It was the same in all 10 GODs. The unlocked Arcade games instead kept signatures that look genuine but no longer match. 🔶
> - **What didn't:** the content ID, which confirms that it doesn't cover the licences (§6.3).
> - **Orphans:** one backup had no main header beside it.
>
> The marker suggests a GOD unlocker by "Byrom". 🔶 Tools should treat these directories as invalid (§7.3).

### 4.9 Game and app save data

**Format.** A save is an STFS package with content type `00000001`, signed `CON`. The console creates and signs it when a game asks for one. ✅ It is usually stored in the profile partition of the player who made it (§2.1). ✅

- **Names:** the game chooses the save's file name, of up to 42 characters, and its display name. ✅ Some games use odd names, even with trailing spaces. ✅
- **Contents:** the files inside are in a format the game defines. Many games add their own checksum inside them. ✅

**Who can use a save.** By default, a save is tied to the profile that made it. ✅ The game decides this for each save, using flags in the package header: ✅

- it can allow the save to be moved to other profiles
- it can tie the save to one storage device
- it can allow the save to be moved but not copied

Most games keep the default, so a save usually can't simply be given to another player. 🔶 A save can still be copied to another console along with its profile (§2.2). ✅

**Apps** keep their data as saves in the public partition, for example PlayReady licence stores, Zune and Sky Player. ✅ Some of them have Title ID 0 in the header.

> **Aside: other data games create, and other uses of saves.**
>
> - **Player-made content:** *Halo 3*, *Halo: Reach* and *Halo 4* Forge maps and map variants are ordinary saves (`00000001`) in the profile partition. ✅ *Minecraft* worlds are probably the same. 🔶
> - **Unlocks across games:** sequels such as *Mass Effect 2* import an earlier game's saves. They do this by listing its Title ID as an "alternate title ID" in their `.xex`. ✅
> - **Modding:** tools such as Horizon and Velocity can edit a save, then rehash and re-sign it (§2.3). ✅
> - **Exploits:** since 2025, crafted *Tony Hawk's American Wasteland* and *Rock Band Blitz* saves were used to launch the BadUpdate exploit. Before that, Xbox 360 save exploits were rare. ✅
> - **Built or downloaded data:** some games keep data they build in their own packages, such as *Rock Band 3*'s song cache. 🔶
> - **Game cache:** games also have their own cache storage, in the drive's cache areas rather than in packages (§4.10). ✅

### 4.10 Content outside `Content/`

> **This whole section is an aside.** The content here isn't stored as packages in `Content/`, so this specification doesn't cover it. It is collected here to help readers identify content that is not part of the `Content/` tree.
>
> #### Media
>
> - **Music ripped from CDs** is stored as FMIM files (§3.4) in a `mindex` directory on the main data area, not inside `Content/`. ✅ It is probably at the top level, next to `Content/`. 🔶 It holds an index file, `mindex.xmi`, and a `media` directory of numbered FMIM files. ✅
> - **Videos and pictures copied to the console** from a USB drive: ❓ the dashboard can copy videos to the hard drive, but where they're stored is unknown. They may be Video (`00090000`) packages in `Content/` after all.
>
> #### Caches, compatibility data and homebrew
>
> | Kind of content | What it is | Where it is stored |
> |---|---|---|
> | **Game cache** | Scratch space games use to speed up loading. Safe to clear. | The drive's game cache area (§5) ✅ |
> | **Original Xbox compatibility data** | The emulator and the original Xbox's own save storage | Its own area of the drive (§5). ✅ What it holds is 🔶. |
> | **Homebrew data** (Aurora, FSD, plugins) | Dashboard settings, artwork caches, scripts | Plain files outside `Content/`. Not packages. ✅ |

---

## 5. File systems: a short summary

| File system | Used on | Notes |
|---|---|---|
| **FATX** | Hard drives, memory units, built-in storage | Microsoft's own version of FAT. Each file can be at most 4 GB, which is why SVOD splits large games. File and directory names are limited to 42 characters. ✅ Sometimes called "XTAF". |
| **SFCX** | The hard drive's two cache areas | A separate format used only for caches. ✅ |
| **FATX inside image files** | USB sticks set up by the dashboard | The stick stays FAT32, but the Xbox storage lives inside large `Xbox360\Data0000`, `Data0001`… files. These have **nothing to do with** SVOD's `Data####` files. ✅ |
| **FAT32** | USB drives on modded consoles | Holds a normal `Content/` tree that a PC can read directly. ✅ |
| **XDVDFS / GDF** (Xbox DVD File System / Game Disc Format) | Game discs, extracted rip images (ISO files), and the disc image inside every SVOD package | The disc format. A GOD package's data files hold a disc image in this format. ✅ |
| **STFS's internal file system** | Inside every STFS package | A small file system inside each package file (§3.1). ✅ |
| **Raw NAND** | Internal flash memory | System software. It isn't a user-facing file system. 🔶 |

> **Aside: areas of a hard drive.** This isn't needed for working with packages, but it explains where things outside `Content/` live. A retail hard drive has no partition table: the console knows where each area starts. ✅ In order, the areas are:
>
> 1. a **security sector**, used to check that the drive is genuine
> 2. the **system cache** and the **game cache** (SFCX)
> 3. two small system areas, **System Auxiliary** and **System Extended** (FATX), which hold system updates and dashboard extensions (§4.7)
> 4. an area for **original Xbox games** (FATX)
> 5. the main **data area** (FATX), which holds `Content/` and fills the rest of the drive
>
> Free60 and Velocity give the two system areas opposite names. This spec follows Velocity's. 🔶

**Names on FATX.** File and directory names can be at most 42 characters, using letters, digits, spaces and ``! # $ % & ' ( ) - . @ [ ] ^ _ ` { } ~``. ✅ Names keep the case they were written with. ✅ The console most likely ignores case when looking names up, but no source confirms it. 🔶 PC tools for FATX, such as Velocity, match names exactly, including case. ✅ FAT32 USB drives on modded consoles ignore case, as FAT32 always does. 🔶

The limit explains how real packages are named. These patterns were checked against real drives (§8.3): ✅

- **Xbox Live STFS packages** (DLC, Arcade games, gamer pictures, trailers and similar) are named with 42 uppercase hex digits: the 20-byte **content ID** (`0x32C`, §6.3) as 40 digits, then the first byte of the Title ID. An example is `E42409217241BEFFDAE1EFBA10F7DA460283CFB358` under Title ID `5841098F`.
- **Xbox Live Games on Demand** headers are named with 34 hex digits: the **first 32 digits** of the content ID (its first 16 bytes), then the first byte of the Title ID. With `.data` added, the directory name is 39 characters, which fits. Guides that say GOD names are 40 characters are wrong: a 45-character `.data` directory couldn't exist on FATX.
- **Avatar items** are named with 32 hex digits: the 16-byte avatar asset ID at `0x3E1` (§6.4).
- **Aurora's Disc to GOD rips and disc installs** are named with 32 hex digits. The last 8 are the media ID (`0x354`, §6.4). Where the first 24 come from is unknown. ❓
- **Other tool-made packages** use shorter names: 8 hex digits for iso2god-rs, 20 for Iso2God.

There are exceptions: ✅

- **`PIRS` themes** have 42 digits ending in the Title ID byte, but the first 40 aren't the content ID. Some have short names instead, such as `fc3theme` or `halo2theme`.
- ***Dragon Age: Origins* DLC** has 41 digits: the content ID plus only the first digit of the Title ID byte.

Why the Title ID's first byte is added is unknown. ❓

**Package names are a convention, not a requirement.** Whatever creates a package chooses its file name. ✅ Xbox Live's download system uses these hex names, games choose their own names for saves (for example, one is called `creep`), and tools such as iso2god-rs pick their own. The console finds a package by its device, content type and file name, and nothing checks what the name contains. ✅ So tools should read a package's identity from its header, not its name.

---

## 6. Package format in detail

This section is the technical reference for reading packages.

**Which formats have this header.** Every STFS and SVOD package starts with the same **XContent header** (§1). ✅

- **In an STFS package**, the header is the start of the single package file, and the package's blocks follow it.
- **In an SVOD package**, the header is the whole header file. The `Data####` files in the `.data/` directory have no header of their own.
- **PEC** uses a cut-down version of the header, described separately in §6.8.

Offsets and sizes are in bytes, and offsets are from the start of the file. Numbers are big-endian unless marked **LE** (little-endian). Field offsets are verified against xenia's `xcontent.h`, `stfs_xbox.h` and `xex2_info.h`, and Velocity's `XContentHeader.cpp`, unless marked otherwise.

### 6.1 Header overview

*Applies to STFS and SVOD packages.*

| Offset | Size | Region |
|---|---|---|
| `0x000` | `0x22C` (556) | Magic and signature (§6.2) |
| `0x22C` | `0x118` (280) | Licences, content ID and header size (§6.3) |
| `0x344` | `0x93D6` (37,846) | Metadata, ending at `0x971A` (§6.4, §6.5) |

- **Header size:** the size of the header that's actually used is stored at `0x340`. It is either `0x971A`, or `0xAD0E` for packages that add extra installer metadata. 🔶 It is usually `0x971A` for `CON` packages and `0xAD0E` for `LIVE` and `PIRS`, but not always: disc installs and downloads in progress (§4.4) are `CON` with `0xAD0E`. ✅ So read the size at `0x340`. Don't infer it from the magic.
- **Padding:** the header is padded to the next 4 KiB boundary: `0xA000` for a `0x971A` header, `0xB000` for a `0xAD0E` header. ✅ The padding is part of the header: the content ID covers it (§6.3).
- **How much to read:** a tool doesn't need the whole header to identify a package.
  - The **first `0x2000` bytes** (8 KiB) hold every field up to the start of the thumbnails at `0x171A`. That covers the magic, signature, licences, metadata and the nine main language strings.
  - To get the **thumbnails**, read up to `0x971A`.
  - The **three extra languages** of metadata version 2 are stored in the thumbnails' space (§6.5), so they need a read up to `0x971A` too.

**Metadata versions.** The metadata layout has two versions, 1 and 2, identified by the value at `0x348`. ✅ **Version 1 is stored as 0**, and version 2 as 2. ✅ No package on the real drives checked (§8.3) stores 1. Only 0 and 2 have been found. xenia and Velocity only test whether the value is 2, so a reader should treat any other value as version 1. ✅ Every offset is the same in both versions. Version 2 only puts some unused space to work:

| | Version 1 | Version 2 |
|---|---|---|
| `0x3D9` (`0x24` bytes) | Unused | Media data or avatar asset data (§6.4) |
| Languages | 9 | 12. The three extra are stored in the thumbnails' space (§6.5). |
| Space for each thumbnail | `0x4000` | `0x3D00` |

> ⚠️ **xenia reads the thumbnail space differently.** xenia-canary allows `0x4000` only when the stored version is exactly 1, and `0x3D00` for anything else, including 0. ✅ So for real version 1 packages, which store 0, it allows less space than they have. This looks like a bug in xenia. Other parts of xenia treat only 2 as version 2, as described above.

### 6.2 Magic and signature (`0x000`–`0x22C`)

*Applies to STFS and SVOD packages.*

A **magic** is a fixed value at the start of a file that identifies its format, such as `%PDF` at the start of a PDF. For a package, the magic also says how it is signed.

The first 4 bytes are the magic: `CON ` (note the trailing space), `LIVE` or `PIRS` (§2.2). ✅ What follows depends on the magic.

**`CON` packages** carry the signing console's certificate: ✅

| Offset | Size | Field |
|---|---|---|
| `0x004` | `0x2` (2) | Public key certificate size |
| `0x006` | `0x5` (5) | Certificate owner console ID |
| `0x00B` | `0x14` (20) | Console part number (text) |
| `0x01F` | `0x1` (1) | Console type: `0x01` devkit, `0x02` retail |
| `0x020` | `0x8` (8) | Certificate date (text, see below) |
| `0x028` | `0x4` (4) | Public exponent |
| `0x02C` | `0x80` (128) | Public modulus |
| `0x0AC` | `0x100` (256) | Certificate signature (by Microsoft) |
| `0x1AC` | `0x80` (128) | Package signature (RSA-1024, by the console) |

**`LIVE` and `PIRS` packages** carry a `0x100`-byte Microsoft signature at `0x004`, followed by padding up to `0x22C`. ✅ Tool-made `LIVE` packages leave the signature empty (§2.3).

#### The certificate date field

The certificate date at `0x020` is 8 bytes of ASCII text. ✅ Free60 calls it the "Certificate Date of Generation", and Velocity reads it as a plain string without parsing it. Neither gives its format.

Real `CON` packages hold text that looks like a date, with two-digit fields separated by hyphens. ✅ 29 `CON` packages were checked, and held two values:

| Value | Packages |
|---|---|
| `11-06-09` | 28 |
| `01-12-10` | 1 |

The format is not known. ❓
- **Field order:** both values are valid as month-day-year and as day-month-year, so they don't show which it is. A value with a number above 12 in either of the first two fields would settle it.
- **Year:** it has only two digits, and no source says which century.
- **Time zone:** no source gives one.
- **Enforcement:** nothing suggests the console checks this text. Treat it as a string that may hold anything.

So a reader should return the text as it is, and not parse it into a date.

### 6.3 Licences, content ID and header size (`0x22C`–`0x344`)

*Applies to STFS and SVOD packages.*

A package's **licences** say who may use it: anyone, a particular Xbox Live account, or a particular console (§2.2). The console checks them when the package is used.

| Offset | Size | Field |
|---|---|---|
| `0x22C` | `0x100` (256) | 16 licence entries of `0x10` bytes each (below) |
| `0x32C` | `0x14` (20) | Content ID: a SHA-1 hash of the header from `0x344` up to the end of the padded header: `0xA000` for a `0x971A` header, `0xB000` for a `0xAD0E` header (§6.1). ✅ It covers the padding, not just the bytes up to the header size at `0x340`. It doesn't cover the licences: unlocking a package leaves it unchanged (§4.8). ✅ Velocity calls it the header hash. |
| `0x340` | `0x4` (4) | Header size (§6.1) |

Each licence entry is: ✅

| Offset | Size | Field |
|---|---|---|
| `0x0` | `0x8` (8) | Licensee ID. The top 16 bits are a type, and the low 48 bits are its data. |
| `0x8` | `0x4` (4) | Licence bits. Bit 0 is generally the full-version licence for Arcade games. |
| `0xC` | `0x4` (4) | Licence flags |

Licensee types (Velocity): `0xFFFF` unrestricted (so `0xFFFFFFFFFFFFFFFF` means anyone), `0x0009` an Xbox Live account (XUID), `0x0003` a Windows Live account, `0xF000` a console, and `0xE000`, `0xD000`, `0xC000` and `0xB000` for media, keyvault, hypervisor and user privilege flags. `0x0000` means unused. ✅ Console-signed packages such as saves usually have one unrestricted entry (§2.2). ✅

### 6.4 Metadata (`0x344` onward)

*Applies to STFS and SVOD packages.*

| Offset | Size | Field |
|---|---|---|
| `0x344` | `0x4` (4) | Content type (§4.2) |
| `0x348` | `0x4` (4) | Metadata version: 0 for version 1, 2 for version 2 (§6.1) |
| `0x34C` | `0x8` (8) | Content size |
| `0x354` | `0x4` (4) | Media ID |
| `0x358` | `0x4` (4) | Version |
| `0x35C` | `0x4` (4) | Base version |
| `0x360` | `0x4` (4) | Title ID (§1) |
| `0x364` | `0x1` (1) | Platform |
| `0x365` | `0x1` (1) | Executable type |
| `0x366` | `0x1` (1) | Disc number |
| `0x367` | `0x1` (1) | Disc count |
| `0x368` | `0x4` (4) | Save game ID |
| `0x36C` | `0x5` (5) | Console ID of the creating console |
| `0x371` | `0x8` (8) | Profile ID of the owning profile, or 0 (§2.1) |
| `0x379` | `0x24` (36) | Volume descriptor: STFS (§6.6) or SVOD (§6.7) |
| `0x39D` | `0x4` (4) | Data file count: 0 for STFS |
| `0x3A1` | `0x8` (8) | Combined size of the data files (SVOD) |
| `0x3A9` | `0x4` (4) | Volume type: 0 STFS, 1 SVOD |
| `0x3AD` | `0x8` (8) | Online creator |
| `0x3B5` | `0x4` (4) | Category |
| `0x3B9` | `0x20` (32) | Reserved |
| `0x3D9` | `0x24` (36) | Metadata version 2 only (§6.1): either media data (series ID, season ID, season and episode numbers) or avatar asset data (sub-category, colourisable flag, the 16-byte asset ID at `0x3E1`, skeleton version) |
| `0x3FD` | `0x14` (20) | Device ID of the storage device |
| `0x411` | `0x900` (2,304) | Display names (§6.5) |
| `0xD11` | `0x900` (2,304) | Descriptions (§6.5) |
| `0x1611` | `0x80` (128) | Publisher name |
| `0x1691` | `0x80` (128) | Title name |
| `0x1711` | `0x1` (1) | Transfer flags (below) |
| `0x1712` | `0x4` (4) | Thumbnail size |
| `0x1716` | `0x4` (4) | Title thumbnail size |
| `0x171A` | `0x4000` (16,384) or `0x3D00` (15,616) | Thumbnail (PNG) |
| `0x571A` | `0x4000` (16,384) or `0x3D00` (15,616) | Title thumbnail (PNG) |

Fields `0x354`–`0x36B` are the same execution info a game's `.xex` carries in its optional header `0x40006`. ✅ The Media ID identifies a particular disc or build, and the Title ID identifies the game.

> ⚠️ **Sources disagree about `0x3AD`–`0x3D8`.** rom-properties and Free60's version 2 table put a series ID at `0x3B1`, inside the online creator field. emoose's template and acceleration agree with this specification: online creator at `0x3AD`, category at `0x3B5`, reserved bytes at `0x3B9`–`0x3D8`, and the version 2 media or avatar data at `0x3D9`. 🔶

> ⚠️ **Iso2God writes the data file count in the wrong place.** iso2god-rs and the original Iso2God write it as a little-endian 4-byte number at `0x3A0`, not big-endian at `0x39D`. ✅ The two read the same only for counts below 256, about 41 GB of data files, so real GODs aren't affected.

**Transfer flags** (`0x1711`), as Velocity reads them: ✅

| Bit | Meaning |
|---|---|
| `0x80` | Can be moved to another profile |
| `0x40` | Can be moved to another storage device |
| `0x20` | Can be moved but not copied |
| `0x10` | Kinect enabled |
| `0x08` | Network storage disabled |
| `0x04` | Deep links supported |
| `0x02`, `0x01` | Unknown |

xenia declares the same six flags as a C bitfield, which a reader could take to mean the opposite bit order. Velocity's explicit values are the safer reference. 🔶

### 6.5 Display strings and thumbnails

*Applies to STFS and SVOD packages.*

**Encoding.** All text fields are **UTF-16BE**. ✅ Real files store the character "D" as `0x00 0x44`. Free60 wrongly calls these "UTF-8 strings". rom-properties documents UTF-16BE, and notes that some content stores UTF-8 bytes as if they were UTF-16BE, which produces garbled text. One of this repo's fixtures, *South Park: The Stick of Truth*, has this problem.

**Language slots.** The display name and description fields are each **9 slots of `0x100` bytes** (128 UTF-16 characters) ✅ (xenia: `chars[kNumLanguagesV1][128]` with `kNumLanguagesV1 = 9`.)

Slot *n* holds the language with ID *n* + 1: ✅ Slots 9 to 11 exist only in metadata version 2 (see below).

| Slot | Language |
|---|---|
| 0 | English |
| 1 | Japanese |
| 2 | German |
| 3 | French |
| 4 | Spanish |
| 5 | Italian |
| 6 | Korean |
| 7 | Traditional Chinese |
| 8 | Portuguese |
| 9 | Unnamed Language (possibly Simplified Chinese) 🔶 |
| 10 | Polish |
| 11 | Russian |

Each slot is padded with zeros. Empty slots are all zeros, so a reader should treat them as empty.

**Metadata version 2** (§6.1) adds three more languages: slots 9 to 11. ✅ Their names and descriptions go in `0x300`-byte blocks taken from the end of each thumbnail's space: names at `0x541A` and descriptions at `0x941A`. ✅ So each thumbnail can be at most `0x3D00` bytes in version 2, instead of `0x4000`. The thumbnails don't move. ✅

xenia reads the extra slots with the same rule as the first nine: slot = language ID − 1. ✅ The *South Park* fixture confirms two of them, once its UTF-8 problem is undone. Slot 10 holds its Polish name ("South Park™: KP") and slot 11 its Russian name ("Южный парк™: П. И."). ✅ Slot 9 is less certain. xenia, rom-properties and Free60 all give language ID 10 as Simplified Chinese. xenia-canary has since moved Simplified Chinese to ID 17 and left ID 10 unnamed. No fixture has text in slot 9. 🔶

There are no slots for languages beyond ID 12. ✅ Later consoles have more language IDs (xenia-canary lists Swedish, Turkish, Norwegian and Dutch as 13 to 16), but xenia reads the English slot for any ID above 12. 

> ⚠️ rom-properties declares 18 slots of `0x80` bytes, plus 6 more in version 2. The fixtures don't match that: their language names are `0x100` bytes apart. This is assumed to be a mistake in rom-properties. ❓ Further research may prove otherwise.

### 6.6 STFS: blocks, hash tables and files

**The volume descriptor** (`0x379`, `0x24` bytes): ✅

| Offset | Size | Field |
|---|---|---|
| `0x00` | `0x1` (1) | Descriptor length: `0x24` |
| `0x01` | `0x1` (1) | Version |
| `0x02` | `0x1` (1) | Flags: bit 0 read-only format (one copy of each hash table), bit 1 root active index (which copy of the top hash table is current), bits 2–3 directory flags |
| `0x03` | `0x2` (2) **LE** | File table block count |
| `0x05` | `0x3` (3) **LE** | File table starting block |
| `0x08` | `0x14` (20) | Hash of the top hash table |
| `0x1C` | `0x4` (4) | Total block count |
| `0x20` | `0x4` (4) | Free block count |

**Blocks.** After the padded header (§6.1), the package is a run of 4 KiB (`0x1000`) blocks. Data blocks are numbered from 0, and hash tables sit between them, without numbers of their own. ✅

- **Level 0:** a hash table comes *before* each run of 170 data blocks, and holds one entry per block. ✅
- **Level 1:** a hash table covers each 170 level-0 tables (28,900 blocks).
- **Level 2:** a hash table covers each 170 level-1 tables. ✅
- **Copies:** in writable packages (`CON`) every hash table has two copies in a row, and a bit in the entry above says which is current. Read-only packages (`LIVE`, `PIRS`) have one copy (§3.1). ✅

xenia's `StfsContainerDevice::BlockToOffset` gives the exact formula for turning a block number into a file offset.

**A hash entry** is `0x18` bytes: a 20-byte SHA-1 of the block, then a 4-byte info word. ✅

- **At level 0**, the info word's top 2 bits are the block's state (free or in use), and its low 24 bits are the next block in the file's chain. `0xFFFFFF` ends the chain.
- **At higher levels**, the info word holds the active-copy bit (`0x40000000`) and a count of free blocks.

A hash table holds 170 entries plus a 4-byte block count, filling one block.

**The file table** is a chain of blocks starting at the block in the volume descriptor. Each block holds 64 entries of `0x40` bytes: ✅

| Offset | Size | Field |
|---|---|---|
| `0x00` | `0x28` (40) | Name. **At most 40 characters**, two fewer than FATX allows. |
| `0x28` | `0x1` (1) | Bits 0–5: name length. Bit 6: blocks are contiguous. Bit 7: is a directory. |
| `0x29` | `0x3` (3) **LE** | Valid data blocks |
| `0x2C` | `0x3` (3) **LE** | Allocated data blocks |
| `0x2F` | `0x3` (3) **LE** | Starting block |
| `0x32` | `0x2` (2) | Parent directory's index in the file table. `0xFFFF` is the root. |
| `0x34` | `0x4` (4) | File size in bytes |
| `0x38` | `0x2` (2) + `0x2` (2) | Created date and time (FAT format) |
| `0x3C` | `0x2` (2) + `0x2` (2) | Modified date and time (FAT format) |

Note the mixed byte order: the 2- and 3-byte block fields are little-endian, and everything else is big-endian. ✅

### 6.7 SVOD: descriptor and data files

**The volume descriptor** (`0x379`, `0x24` bytes): ✅

| Offset | Size | Field |
|---|---|---|
| `0x00` | `0x1` (1) | Descriptor length: `0x24` |
| `0x01` | `0x1` (1) | Block cache element count |
| `0x02` | `0x1` (1) | Worker thread processor |
| `0x03` | `0x1` (1) | Worker thread priority |
| `0x04` | `0x14` (20) | Hash of the first data file's first hash table |
| `0x18` | `0x1` (1) | Features: bit `0x40` means the Enhanced GDF layout |
| `0x19` | `0x3` (3) **LE** | Number of data blocks |
| `0x1C` | `0x3` (3) **LE** | First data block |
| `0x1F` | `0x5` (5) | Reserved |

**Data files.** ✅

- **Location:** the data files are in `<header name>.data/`, next to the header. A missing directory means the package is incomplete (§7.3).
- **Names:** `Data0000`, `Data0001`… The number is 4-digit decimal, and there are no gaps. Nothing else is in the directory, except during a download (§4.4).
- **Count:** the number of files must equal the data file count at `0x39D`. Readers sort them by name.
- **Size:** each file is exactly `0xA290000` bytes (170,459,136, about 162.6 MiB), except the last, which can be shorter. Each holds 0x14388 data blocks of `0x800` bytes, plus their hash tables.

**Disc image layouts.** The data files hold a disc image, which starts with the magic `MICROSOFT*XBOX*MEDIA`. Where it is found depends on the layout: ✅

| Layout | Magic found at | Typical of |
|---|---|---|
| Enhanced GDF | `0x2000` in `Data0000` | Xbox Live downloads and most tools |
| XSF | `0x12000` in `Data0000` | Some third-party tools |
| One data file | `0xD000` | Small packages with a single data file |

### 6.8 PEC header

PEC (§3.3) has no magic, and starts directly with a `0x228`-byte console certificate laid out as in §6.2. ✅

| Offset | Size | Field |
|---|---|---|
| `0x228` | `0x14` (20) | Header hash, covering `0x23C`–`0x1000` |
| `0x244` | `0x24` (36) | STFS volume descriptor |
| `0x26C` | `0x8` (8) | Profile ID |
| `0x275` | `0x5` (5) | Console ID. It must match the certificate's console ID. |
| | `0x1` (1) | "Enabled" byte, which must be 1 |

The header is `0x1000` bytes. Hash table 0 starts at `0x1000`, and data block 0 at `0x3000`, since a PEC always has two copies of each hash table. ✅ (Free60 PEC page; Velocity `MetadataIsPEC`.)

### 6.9 Identifying a package

To read a package's basic identity:

1. **Magic** at `0x000`: `CON `, `LIVE` or `PIRS`. Anything else means it isn't a package, or it's a PEC (§6.8).
2. **Content type** at `0x344` (§4.2).
3. **Title ID** at `0x360`.
4. **Profile ID** at `0x371`, as a cross-check only. The partition directory decides ownership (§7.2).
5. **Volume type** at `0x3A9`: 0 means STFS, 1 means SVOD.
   - Don't use the content type to decide this. GameOnDemand (`00007000`), XboxTitle (`00005000`) and InstalledGame (`00004000`) all use SVOD. ✅
   - Don't use the presence of a `.data/` directory either, since a broken package may have lost it.
6. **For SVOD**, the data file count at `0x39D` says how many `Data####` files to expect.

## 7. Rules for tools in this repo

These rules say how a tool should read, copy, compare and remove packages. They are written for `xcontent-header`, `xcontent-fs-web` and the apps built on them, but apply to any tool that works with a `Content/` directory. Each rule points to the sections that explain why.

### 7.1 Walking a `Content/` directory

```
directory name = 16 hex chars?   /^[0-9a-fA-F]{16}$/
  └─ no  → not a partition (ignore)
  └─ yes → partition
       └─ name = "0000000000000000"? → public  (profileId: null)
       └─ otherwise                  → profile (profileId: directoryName)
```

- **Directly inside `Content/`**, only partition directories are content. Files are always ignored, whatever their name (§2.1).
- **Inside a partition**, Title ID directories are named with 8 hex digits, such as `4D5307E6` (§1).
- **Inside a Title ID directory**, content-type directories are named with 8 hex digits, such as `00007000` or `000D0000` (§1). ✅
- **Inside a content-type directory**, every file is a package file. The only directory that belongs there is an SVOD package's `<header name>.data` (§7.3).
- **Anything else** isn't part of the content tree. A tool should skip it and may report it, but shouldn't treat it as a package. The exception is unexpected directories in and beside content-type directories, such as `BACKUP/`, `7000_BACKUP/` and empty nested `00080000/00080000`, which are found on real drives. ✅ Treat these as invalid packages (§7.3).
- **Downloads in progress** (§4.4) sit in content-type directories like real packages. Skip them, along with their `.data` directory (§7.2).
- **Case:** match names without regard to case, but write them in their usual case:
  - uppercase hex for Title ID and content-type directories
  - an SVOD package's data directory spelled exactly `<header name>.data`

  The console probably accepts other cases, but PC tools for FATX don't (§5). 🔶
- **System and homebrew titles** appear as ordinary Title ID directories, such as `FFFE07D1`, `FFFE07DF` and `C0DE9999` (§4.7). A tool that lists titles should recognise them, rather than show them as games.

### 7.2 Identifying a package

- **Read the header, not the name.** A package's file name is opaque (§5). Identify a package from its header, following the steps in §6.9.
- **Ignore file extensions.** Package names can end in `.xml`, `.dat` or `.pkg`, such as the saves `C5Data.xml` and `LicenseStore.dat` (§4.9). These say nothing about the format. Only the magic does. ✅
- **Check the magic first.** A file in a content-type directory whose magic isn't `CON `, `LIVE` or `PIRS` isn't a package (§6.2).
- **Ownership:** trust the partition directory's name to tell which profile a package belongs to. The profile ID in the header (`0x371`) normally matches it, but nothing enforces that, so use it only as a cross-check (§2.1). ✅
- **The directory decides the Title ID and content type too.** Headers often disagree with their directory. ✅ On real drives, these all had Title ID 0 in the header:
  - system packages under `FFFE07DF` and `584D07D1`
  - the dashboard's gamer picture caches
  - some app saves (§4.9)
- **Skip downloads in progress** (§4.4). Recognise one as a `CON` package whose header says Title ID `FFFE07D1` and content type `000B0000`, but which sits somewhere other than `FFFE07D1/000B0000/`. 🔶 Its display name, "Title Content Progress cache", is a second sign, but it may be localised. ❓
- **Signatures:** the magic says only which kind of signature a package *claims*. A `LIVE` label doesn't prove a package came from Xbox Live (§2.3).

### 7.3 Treating a package as one unit

A package is the unit that is copied, moved, compared or removed.

- **An STFS package** is one file.
- **An SVOD package** is its header file, plus the `<header name>.data` directory next to it, plus every `Data####` file inside that directory (§3.2).

**Checking that an SVOD package is complete.** An SVOD package is complete only if all of these are true: ✅ (§6.7)

1. The `<header name>.data` directory exists. A missing directory means the package is incomplete, not a valid variant. xenia refuses to load one, and Velocity always expects the directory.
2. The directory holds exactly as many files as the data file count at `0x39D`.
3. They are named `Data0000` up to `Data` + (count − 1), with no gaps.
4. Every file except the last is exactly `0xA290000` bytes, and the last is no larger.
5. The sizes of the data files add up to the combined size at `0x3A1`. ✅ (All 24 complete packages on a real drive passed every check.)

**Invalid packages.** These layouts are always wrong. A tool should treat each as an invalid package and follow whatever process it has for invalid packages:

- an STFS package (volume type 0) with a `.data` directory next to it
- an SVOD header with no `.data` directory ✅ found
- a `.data` directory with no header file of the same name ✅ found
- an empty `.data` directory ✅ found
- a `.data` directory holding anything other than `Data####` files, outside a download in progress (§4.4)
- any other directory inside a content-type directory, such as `BACKUP/` (§4.8) or an empty nested `00080000/` ✅ found
- a non-hex directory beside the content-type directories, such as `7000_BACKUP/` ✅ found

### 7.4 Copying and moving

- **Copy the whole unit,** and keep every name exactly as it is in the source.
- **Keep the path:** copy a package to the same partition, Title ID and content-type directories as in the source.
- **Order:** write an SVOD package's data files first, from the highest-numbered down to `Data0000`, and its header file last.
  - A tool that finds packages by their header then won't mistake a half-copied package for a complete one.
  - Because `Data0000` is written last, a non-empty `Data0000` means every other data file was written before it.
  - So an interrupted copy always leaves a `.data` directory without its header, or without `Data0000`, which a tool can detect from names alone, without reading a header.
- **Write each file in one go,** if the platform allows it, so that a file is either complete or was never committed. Browsers using the File System Access API work this way (see "Leftovers" below).
- **Limits when writing to FATX** (§5):
  - every name must be at most 42 characters, including `.data`
  - every file must be at most 4 GB
  - a browser writing through the File System Access API needs room for a swap file named `<name>.crswap`, 7 characters longer than the name. So a browser can't write a 36-character or longer name to FATX, which rules out Xbox Live packages' 42-character names. ✅ (Checked in Chrome on FAT32, which allows 255: names of up to 248 characters could be written, and longer ones failed.)
- **Leftovers that aren't part of any package.** Two kinds of file appear in real `Content/` trees, and a tool should neither copy them nor treat them as packages: ✅ (Checked on a FAT32 USB drive with Chrome 155 on macOS 26.3, 2026-10-15.)
  - **Swap files** (`<name>.crswap`, or `<name>.1.crswap` and so on if that name is taken). Chromium writes each file into one, and replaces the target with it when the write finishes. A crash, power cut or pulled drive leaves the swap file behind, beside an empty file with the target's name. Stopping a write, or closing the tab, doesn't: Chromium deletes the swap file, leaving only the empty file. ✅ (Checked 2026-10-17.)
  - **AppleDouble files** (`._<name>`, 4 KiB). macOS writes one beside every file and directory it creates on a drive that can't store its extended attributes, such as FAT32, including inside `.data` directories (`._Data0000`). They start with the bytes `00 05 16 07`. Deleting a file on macOS also deletes its AppleDouble file. macOS writes them for swap files too (`._Data0000.crswap`), but not on APFS, which stores extended attributes itself. ✅ (Checked 2026-10-17.)
- **Things a copy doesn't bring along.** A tool should say so when it matters:
  - Older title updates, in `Hdd1:\Cache`, are outside `Content/` (§4.5). 🔶
  - Saves and other profile content are tied to their profile, which a game may require on the target device (§2.2).
  - Purchased content may need its licence on the target console. ❓ Whether a modded console checks it is unknown (§2.2).

### 7.5 Comparing and verifying

- **A full comparison** compares every file in the unit. For an SVOD package, that includes every data file.
- **A quick comparison** can use the content ID at `0x32C` (§6.3). For an STFS package, the content ID is a hash of the header, and the header holds the hash of the top of the package's hash tree (§6.6). So two STFS packages with the same content ID should have the same contents. 🔶 For an SVOD package, the content ID covers the hash of only the first data file's first hash table (§6.7). So a quick comparison should also check that the data file names and sizes match.

### 7.6 Removing

- **Remove the whole unit.**
- **Order:** remove an SVOD package's header file first, then its data files from `Data0000` upwards, then the empty `.data` directory.
  - The console and dashboard then never list a package whose data is half gone.
  - If removal is interrupted, what's left is a `.data` directory without its header and without its lowest-numbered data files. A tool can detect that from names alone, the same way as an interrupted copy (§7.4).
  - The opposite order (data first, header last) leaves a header without its data, which the console may still list. 🔶
  - With the header-first order, a tool that finds packages only by their header would miss a leftover `.data` directory. So tools should also look for `.data` directories without a header (§7.3).
- **Empty directories:** after removing the last package in a content-type, Title ID or partition directory, a tool may remove the empty directory.

## 8. Sources

### 8.1 How sources are weighed

| Kind of source | Examples | Best mark it can support |
|---|---|---|
| **Primary** | Microsoft material (support pages, patents, SDK names quoted in code); the source code of tools that read real packages; real files | ✅ |
| **Community reference** | Free60, xboxdevwiki | ✅ for formats they document in detail; 🔶 otherwise |
| **Secondary** | ConsoleMods, guides, forums, community lists | 🔶 at best |
| **Search snippet only** | Pages that blocked direct reading, so only a search engine's summary was seen. Marked *(snippet)* below. | 🔶 at best |

### 8.2 Main sources

These are cited by file name below, without repeating their links.

| Source | Link | Notes |
|---|---|---|
| **xenia** | https://github.com/xenia-project/xenia | Xbox 360 emulator. Its code shows how the console reads packages. |
| **xenia-canary** | https://github.com/xenia-canary/xenia-canary | xenia's actively developed fork. Most xenia paths below are from xenia-canary. |
| **Velocity** (XboxInternals) | https://github.com/hetelek/Velocity | Package, profile and FATX editor |
| **Free60** | https://free60.org/ | Reverse-engineering wiki, mirrored at https://github.com/Free60Project/wiki |
| **iso2god-rs** | https://github.com/iliazeus/iso2god-rs | Disc-to-GOD converter |
| **Iso2God** (r4dius) | https://github.com/r4dius/Iso2God | The original Disc-to-GOD converter |
| **rom-properties** | https://github.com/GerbilSoft/rom-properties | File-properties tool. Xbox 360 structures are in `src/libromdata/Console/xbox360_stfs_structs.h`. |
| **emoose/xbox-reversing** | https://github.com/emoose/xbox-reversing | Format templates (`Xbox360Container.bt`) and `stfschk` |
| **ConsoleMods** | https://consolemods.org/wiki/ | Modding wiki. It blocked direct reading, so its pages were mostly seen in snippets. |
| **X1 research** | [x1-research-findings.md](../session_context/loadout/docs/x1-research-findings.md) | The full list of sources for the SVOD layout and Aurora's ripping methods |
| **Real drives** | [xcontent-specification-research.md](xcontent-specification-research.md) | Primary research on real `Content/` trees (§8.3). The research record holds the method, the evidence and the open questions. |
| **This repo's fixtures** | `packages/xcontent-header/src/__tests__/fixtures/` | The first `0xB000` bytes of real packages: LIVE, PIRS and CON headers, both STFS and SVOD, among them GOD headers (`live-svod-god-dead-island-riptide`, `live-svod-god-south-park-mojibake`) and DLC (`live-stfs-dlc-halo-wars`) |

### 8.3 Primary research

Some claims were checked directly against real drives, on 2026-10-12. ✅ The sources were:
- a FAT32 USB drive holding four `Content/` trees, 591 packages in all
- a copy of part of one of those trees

Every package's header was read, and the layout of every directory was checked. The method, every question asked and the questions still open are in the research record ([xcontent-specification-research.md](xcontent-specification-research.md)).

What the drives established, by section:

- **§2.1:** the public partition holds GOD, Arcade games, disc installs, DLC, title updates, avatar items, gamer pictures, themes, trailers and app saves. A profile partition can hold saves without its profile package. Profile partition names don't always start with `E0` (`E812CECF9EA2AF5F`).
- **§2.2, §2.3:**
  - Disc installs are `CON`, with one console licence.
  - Aurora's Disc to GOD rips are `LIVE`, with an all-zero signature.
  - Paid DLC has an XUID licence and a console licence.
- **§3.2, §6.7:** all 24 complete SVOD packages match the layout exactly: count, names, the `0xA290000` size, and the total at `0x3A1`. A finished `.data` directory holds only `Data####` files.
- **§4:**
  - Title update format and names (§4.5).
  - Downloads in progress (§4.4).
  - Avatar award items under the awarding title (§4.6).
  - System data (§4.7).
  - Unlocked packages and `BACKUP/` directories (§4.8).
  - App saves in the public partition, and *Halo* Forge maps as saves (§4.9).
  - XNA indie saves (§4.3).
- **§5:** how packages are named. Xbox Live packages are named from the content ID, avatar items from the asset ID, and disc-made packages end with the media ID.
- **§6:**
  - Metadata version 1 is stored as 0.
  - `CON` headers can be `0xAD0E`.
  - The content ID doesn't cover the licences.
  - The content ID is the SHA-1 of `0x344` up to the end of the padded header (§6.1, §6.3), checked on 2026-10-13. It matched every package: all 591 on the USB drive and all 181 in the copy, of every magic and both header sizes. Hashing only up to the header size matched none.
  - The certificate date's values (§6.2), from 29 `CON` packages in the copy, checked on 2026-10-13.
- **§7:** the invalid layouts in §7.3 were all found on real drives, except where marked. Headers often disagree with their directory (§7.2). The old copier's output had every SVOD header but no `.data` directories (the X1 question).
- **§7.4, a browser writing to a drive** (2026-10-15): a test page wrote files with the File System Access API in Chrome 155 on macOS 26.3, to a FAT32 USB drive. It established the swap files and their names, the empty file created before writing, the 248-character limit for names on FAT32, and the AppleDouble files macOS adds. The full results are in the `xcontent-fs-web` design decision record (`packages/xcontent-fs-web/docs/xcontent-fs-web-design-decision-record.md`, §2.4).
- **§7.4, interruptions** (2026-10-17): the finished `xcontent-fs-web` package copied real packages from a vault to an APFS volume and a FAT32 USB drive in Chrome 155 on macOS 26.3, and each kind of interruption was tried. It established what a stopped write, a closed tab and a pulled drive leave behind, and where macOS writes AppleDouble files. The results are in the same record, §2.5.

### 8.4 §1: The big picture

- **Package terminology:**
  - Microsoft patent US7337147 (https://patents.google.com/patent/US7337147) says "content package".
  - xenia `xam_content.cc` implements `XamContentCreate` and the `XCONTENT_DATA` type, names taken from Microsoft's SDK.
  - Velocity's main class is `StfsPackage`.
  - Horizon says "Xbox 360 XContent Package ( 'LIVE'.'PIRS'.'CON')". ConsoleMods says "STFS/SVOD package".
  - xenia-canary uses `StfsContainerDevice` and `SvodContainerDevice`, and also says "XContent packages".
  - emoose's stfschk calls itself an "STFS filesystem checker/verifier, used to check the validity of Xbox 360 XContent packages".
- **NAND:**
  - Free60 Boot Process (https://free60.org/System-Software/Boot_Process/): "1BL (Inside CPU)".
  - Free60 NAND File System (https://free60.org/System-Software/NAND_File_System/) gives the layout: SMC, keyvault, CB, CD, CE (base kernel), CF/CG.
  - Eaton Works (https://eaton-works.com/2023/01/09/how-microsoft-attempted-to-make-the-xbox-360-dashboard-load-faster/): the dashboard "was moved to the hard-drive's System Extended partition … still on the nand as a fallback."
- **Homebrew as raw files:**
  - The Aurora installation guide (https://elmajor9.github.io/xbox360-aurora-guide/installation/aurora/) shows `Aurora.xex` with `Data/`, `Plugins/` and `Skins/`, installed to `Hdd1:/Aurora/`.
  - GamerGen's FSD guide (https://gamergen.com/tutoriels/glitch-freestyle-dashboard-12824-2) gives `Hdd:\FSD\default.xex` and DashLaunch's `default.xex`.
- **Title IDs:**
  - xenia-canary `src/xenia/kernel/title_id_utils.h`:
    - `GetTitlePublisher`
    - `IsValidGameId`: `(title_id >> 16) != 0xFFFE`
    - `IsXblaTitle` and `IsAppTitle`
    - `IsOriginalXboxTitle`: `(title_id & 0x7FFF) < 0x7D0`
  - xboxdevwiki Xbe (https://xboxdevwiki.net/Xbe): "usually 2 ASCII letters for the publisher … followed by a u16 integer game number".
  - ConsoleMods' List of Multi-ID Games (https://consolemods.org/wiki/Xbox_360:List_of_Multi-ID_Games) *(snippet)*: releases with different Title IDs.
- **Content types** (also §4.2): see §8.7.

### 8.5 §2: Who owns content, and who can use it

- **Partitions:**
  - xenia-canary `xam_content.cc`: in `XamContentCreate`, the owner comes from `user_index`, and DLC is forced to xuid 0.
  - xenia-canary `content_manager.cc`: the path is `<{:016X} xuid>/<title>/<type>/<file>`, and listing merges the common directory.
  - xenia-canary `xam_avatar.cc`, and `xam_user.cc` (gamer pictures under xuid 0).
  - xenia-canary `profile_manager.cc`: the profile path is `<xuid>/FFFE07D1/00010000/<xuid>`, and IDs start `E0`.
  - Velocity `profilecreatorwizard.cpp`.
  - ConsoleMods' Files and Directories and Saves pages *(snippet)*.
  - GamerGen's USB guide (https://gamergen.com/tutoriels/explorer-cle-usb-xtaf-4700-3/amp): themes and gamer pictures under `0000000000000000/FFFE07D1/`.
- **Signature kinds:**
  - Free60 STFS (https://free60.org/System-Software/Formats/STFS/):
    - CON is "Found on many files such as cache files, profiles, saved games".
    - PIRS is "delivered by Microsoft through non-Xbox Live means such as system updates".
    - LIVE is "delivered over Xbox Live such as items from the Marketplace like themes".
  - Velocity `creationwizard.ui`: PIRS is "used for on disc content".
  - ConsoleMods *(snippet)*: Disc to GOD "is signed as a digital GOD instead of a console signed disc installation".
- **Licences:**
  - Free60 STFS: licence entries are "License ID (XUID / PUID / console id)".
  - Velocity `StfsDefinitions.h` (licence types), `StfsPackage.cpp` (new CON packages are unrestricted) and `licensingdatadialog.cpp`.
  - xenia-canary `xcontent.h` (`XContentLicense`).
  - Wikipedia's Xbox Games Store article: the licence "is tied to both a specific user and to a specific console".
  - Shacknews on the licence transfer tool (https://www.shacknews.com/article/53337/xbox-360-license-migration-tool).
- **Purchased-content licences:**
  - Microsoft's DRM FAQ (https://web.archive.org/web/20131117062807/http://support.xbox.com/en-US/xbox-360/downloadable-content/download-content): "The license has two parts: the system license and the local license."
  - Xbox.com, 2006 (https://web.archive.org/web/20090826163526/http://www.xbox.com/en-US/community/personality/elle/20060814-shoptilyoudrop.htm): "The console license allows anyone to use that content on that console, online or off. The profile license allows you to use the content on any console, as long as you're signed in to Xbox Live".
- **Moving saves:** Microsoft's USB flash drive FAQ (https://web.archive.org/web/20150609225744/http://support.xbox.com/en-US/xbox-360/accessories/usb-flash-drive-faq): "A USB flash drive is a great way to take your game saves or gamertag with you to another console."
- **Unlocking:** Velocity `licensingdatadialog.cpp`: "Content unlocked this way can only be used on a JTAG/RGH/Dev. If you try and play on a retail, it will show up as corrupt."
- **Re-signing:**
  - Velocity `qthelpers.cpp` (`GetKVPath`, which looks for `KV_R.bin`/`KV_D.bin`) and `XContentHeader.cpp` (`ResignHeader`, which takes the certificate and key from the keyvault).
  - iso2god-rs `src/god/empty_live.bin` (a blank LIVE header).
- **Modded consoles:**
  - The freeBOOT changelog and patch list (https://assemblergames.org/viewtopic.php?t=30068): "Disable PIRS/LIVE Signature Check".
  - XeUnshackle (https://github.com/Byrom90/XeUnshackle) notes that xeBuild applies the same patches.
  - Free60 PEC page: a package with mismatched IDs is "seen as a corrupted file".

### 8.6 §3: Package formats

- **STFS as a file system:** Free60 STFS: STFS "is the file system used by the Xbox 360 for all packages", and it is "secure and transacted (multiple file / directory revisions)".
- **STFS hash table copies:**
  - xenia-canary `stfs_xbox.h`: `read_only_format` is described as "if set, only uses a single backing-block per hash table (no resiliency), otherwise uses two". Also `root_active_index`, and `stfs_container_device.cc`.
  - Velocity `StfsPackage.cpp`: `SwapTable`, which is never called.
  - emoose stfschk `Program.cs` expects read-only format for LIVE and PIRS, and not for CON.
- **Package formats:** only STFS (0) and SVOD (1) are defined as volume types:
  - xenia (`XContentVolumeType`)
  - rom-properties
  - Velocity (`enum FileSystem`)
  - Free60
- **SVOD layout:**
  - iso2god-rs `src/god/file_layout.rs`, xenia `svod_container_device.cc` and Velocity `XboxInternals/Disc/Svod.cpp`.
  - The other sources are in the X1 research (§8.2).
- **SVOD on real files:** this repo's fixtures (§8.2).
- **SVOD name:**
  - Microsoft patent US20090143145A1, "Read Redirection of Physical Media" (https://patents.google.com/patent/US20090143145A1/en), says "a secure virtual optical disc layer 404 is used". The patent doesn't write "SVOD", but the phrase matches the initials and the feature.
  - xenia, Velocity, rom-properties and Free60 use the acronym without expanding it.
  - The Xeren wiki (https://www.xeren.com/wiki/xcontent.html) says "SVOD(Secure Virtual Offline Disk)", without citing a source. `xbox360-content-format.md` used the same wording.
- **Disc installs:**
  - Velocity `XboxInternals/Disc/Svod.cpp`: SVOD is accepted only for GameOnDemand and InstalledGame.
  - The Le Fluffie guide (https://stainedfuture.wordpress.com/2010/01/01/le_fluffie/) converts a disc install by copying `00004000` to `00007000` and changing only the header.
  - ConsoleMods *(snippet)*: "a console-signed SVOD container similar to a Game on Demand".
  - Microsoft (https://support.xbox.com/en-US/help/xbox-360/games/game-setup/install-play-delete-game): "you still need to have the game disc in the disc drive".
- **PEC:** Free60 PEC page (https://free60.org/System-Software/Formats/PEC/); Velocity `XboxInternals/Stfs/XContentHeader.cpp` (`MetadataIsPEC`) and `Velocity/profileeditor.cpp`.
- **Files inside packages:**
  - **GPD and Account:**
    - Free60 GPD page: "each named under their respective titles id (e.g. 4D5307E6.gpd for Halo 3)", and title entries "are only located in the FFFE07D1 gpd".
    - Free60 Profile Account page (https://free60.org/System-Software/Profile_Account/).
    - Velocity `XboxInternals/Gpd/` (`EntryType`, `DashboardGpd`) and `XboxInternals/Account/Account.cpp`.
    - xenia-canary `user_profile.cc` (`{:08X}.gpd`) and `profile_manager.cc`.
  - **SPA:** xenia-canary `kernel_state.cc` (`module_xdbf()` reads the XEX resource named after the Title ID) and `xdbf/spa_info.h`.
  - **XEXP:** xenia `XexModule::ApplyPatch`.
  - **FMIM:** Free60 FMIM (https://free60.org/System-Software/Formats/FMIM/): "FMIM" magic, track metadata, then WMA audio from `0xD08`.
  - **XCP:** Free60 XCP (https://free60.org/System-Software/Formats/XCP/): "encrypted and compressed (with zlib)", "Underneath, they are STFS containers".
  - **XUI archives:** xenia-canary `xam_info.cc` (`file://media:/{}.xzp` and `section://` resource paths).
  - **Others:** the Free60 Formats section lists FMIM, GPD, SPA, XCP, XDBF and XEX.

### 8.7 §4: Content types

- **Names and IDs:**
  - xenia `src/xenia/xbox.h`
  - Velocity `XboxInternals/Stfs/StfsConstants.h`
  - Free60 STFS
  - rom-properties `xbox360_stfs_structs.h`
- **SUStoragePack (`00008000`):**
  - xenia-canary `xbox.h` (`kSUStoragePack`, "SU Storage Pack") and emoose `Xbox360Container.bt` (`SUStoragePack = 0x8000`).
  - XeBuild `tools/su_check/su_check/main.c` (https://github.com/cOzInABox/XeBuild): the system update manifest lists items with `dwContentType; // 0x14 ie 0x00008000` and `dwContentTitleId; // 0x18 ie 0xFFFE07DF`.
  - RGLoader `sysext.cpp` (https://github.com/RGLoader/RGLoader): `SEP:\Content\0000000000000000\fffe07df\00008000`.
  - Velocity's name, AvatarAssetPack, matches the best-known package of this type, the avatar system's base assets.
- **Licence store:**
  - xenia-canary `xbox.h` (`kLicenseStore`).
  - Velocity `StfsConstants.h`, and `creationwizard.cpp` (offered under CON and LIVE).
  - Free60 STFS lists "0x000F0000: License Store" without explanation.
- **Games** (§4.3): the X1 research (§8.2), for Aurora's ripping methods and extracted rips. The XeXMenu package path comes from ConsoleMods (https://consolemods.org/wiki/Xbox_360:XeXmenu) and Se7enSins *(snippet)*.
- **Title updates** (§4.5):
  - ConsoleMods' Title Updates and Manually Installing Title Updates pages *(snippet)*: lowercase `tu…` files go in `Hdd1/Content/0000000000000000/TITLE_ID/000B0000`, and uppercase `TU_…` files in `Hdd1/Cache`.
  - Microsoft's clear-cache page (https://support.xbox.com/en-RS/help/xbox-360/console/clear-system-cache).
  - xenia-canary `kernel_state.cc` loads title updates from Installer content. It applies only the first one found, as a `.xexp` delta patch, and skips it if the hash in its delta patch descriptor (`xex2_info.h`) doesn't match the base `.xex` (`IsPatchSignatureProper`).
  - emoose `Xbox360Container.bt`: Installer subtypes `TITLE_UPDATE = 'TUPD'` and `PROGRESS_CACHE_TITLE_UPDATE = 'P$TU'`.
- **Profile images and avatars** (§4.6):
  - Velocity `profilecreatorwizard.cpp`: writes `tile_64.png` and `tile_32.png`, and the avatar image entry `0x8007` in `FFFE07D1.gpd`.
  - Velocity `XdbfDefininitions.h` (`AvatarImage`, `GamercardAvatarInfo1/2`) and `profileeditor.cpp` (builds award items as AvatarItem packages).
  - xenia-canary `user_profile.h` (tile file names), `user_settings.h` (`XPROFILE_GAMERCARD_AVATAR_INFO_1` = `0x63E80044`) and `xam_avatar.cc` (an installed award item is `kAvatarItem` with xuid 0).
- **Avatar award items** (§4.6):
  - xenia-canary `xgi_app.cc` (`XUserAwardAvatarAssets` passes only the user and award ID) and `xam_avatar.cc` (xuid 0, the awarding title, `kAvatarItem`).
  - Free60 GPD: title flag 0x10 means "Avatar Award Unlocked, needs to be downloaded".
  - Velocity `avatarassetdownloader.cpp`: downloads from `download.xboxlive.com/content/<titleID>/avataritems/`.
  - For where bought items are stored, `<TitleID>/00009000`:
    - NextGenUpdate (https://nextgenupdate.com/forums/xbox-360-cheats-customization/67307-how-get-avatar-items-free.html)
    - Digiex's AvatarFridayPatcher thread (https://digiex.net/threads/avatarfridaypatchergui.16256/)
- **System content** (§4.7):
  - RGLoader `RGLoader/sysext.cpp` mounts `\Device\Harddisk0\SystemExtPartition\` and builds `Content\0000000000000000\<TID>\<Type>\<name>` on it, creating `Content\...\FFFE07DF\00008000`.
  - c373z/xenia-guide-hud `system_update_import.cc`: "The hard drive's SystemExtPartition as an installed update leaves it".
  - Digiex on the optional media update (https://digiex.net/threads/xbox-360-optional-media-update-download.3143/): copied to `\Content\0000000000000000\FFFE07DF\00000002`.
  - patatetom/xtaf README: `Content/0000000000000000/FFFE07DF/00040000/ContentCache.pkg`.
- **System Title IDs** (§4.7):
  - xenia-canary `title_id_utils.h` (`kDashboardID`, `kAvatarEditorID`).
  - A private XAM header quoted in open-source projects: `XENON_SIGNUP_TITLE_ID 0xFFFE07DE` and `XCODEC_TYPE_AAC_TITLE_ID 0xFFFE07DF`.
  - grimdoomer/Halo-2-Unlock: `xbox.xex` has "Title Id: FFFE07D2".
  - Horizon `TitleCrawler.cs` treats the `FFFE07xx` block as system titles.
  - Velocity `profilecleanerwizard.cpp` (`FFFE07DE`).
  - Community lists: https://gist.github.com/AdrianCassar/c0d05a14608168259232b3ed8c77f28c, and the Sentry game list (Element18592/Sentry) for apps and homebrew.
  - J-Runner `DashLaunch.cs` for `C0DE9999`.
- **Saves** (§4.9):
  - xenia-canary `kernel/xam/xcontent/xcontent.h`:
    - `file_name_raw[42]`
    - the create flags `kNoProfileTransfer`, `kNoDeviceTransfer`, `kAllowProfileTransfer` and `kMoveOnly`
    - the header bits `profile_transfer`, `device_transfer` and `move_only_transfer`
  - Velocity `XContentHeader.cpp` (`transferFlags`).
  - A forum report (https://forums.penny-arcade.com/discussion/21367/360-save-file-question): "Some games allow cross-profile copying… The vast majority don't."
- **Other data games create, and other uses of saves** (§4.9):
  - *Halo 3* Forge maps: a Nexus Mods thread (https://www.nexusmods.com/halothemasterchiefcollection/mods/456?tab=posts).
  - *Rock Band 3*'s save and song cache: https://rhythmgamingworld.com/?p=395965.
  - *Mass Effect 2*'s import: GameBanshee (https://gamebanshee.com/k8ahr) and Shacknews (https://www.shacknews.com/article/61759/mass-effect-2-details-about).
  - *Dragon Age II*'s import: Shacknews (https://www.shacknews.com/article/65900/dragon-age-origins-save-file).
  - Alternate title IDs: xenia-canary `xam_content_aggregate.cc` ("used by games to load saves from other titles") and `xex2_info.h` (`XEX_HEADER_ALTERNATE_TITLE_IDS`).
  - The modding workflow: WeMod forum guides (https://community.wemod.com/t/dead-or-alive-xtreme-2-save-editor/2132).
  - BadUpdate: https://github.com/grimdoomer/Xbox360BadUpdate ("the Rock Band save game exploit is specific to Rock Band Blitz") and Free60 (https://free60.org/Hacks/Bad_Update_Hack/).
  - The game cache API: xenia-canary `xam_table.inc` (`XamCacheStoreFile` and related).
- **Ripped music** (§4.10): FATXplorer (https://fatxplorer.eaton-works.com/how-to-organize-and-extract-xbox-360-music-files/): "Content Partition:\\mindex" holds "a mindex.xmi file and a media folder".

### 8.8 §5: File systems

- **FATX names:**
  - Free60 FATX (https://free60.org/System-Software/Systems/FATX/): "Maximum Filename Length: 0x2A (42)".
  - Velocity `XboxInternals/Fatx/FatxConstants.h` (`FATX_ENTRY_MAX_NAME_LENGTH 0x2A`), `IO/FatxIO.cpp` ("Entry name must be less than 42 characters") and `FatxDrive.cpp` (the allowed characters).
- **Package names:**
  - The No-Intro Xbox 360 dats (https://github.com/libretro-mirrors/nointro-db): in the DLC dat, 4,555 package names are 42 hex characters. The Games on Demand dat's headers are 34.
  - xenia-canary `kernel/xam/xcontent/xcontent.h`: the header's `content_id[0x14]`, and `XCONTENT_DATA`'s `file_name_raw[42]`. Its comments say "DLC packages usually fill the entire file_name_raw array" and "Package is located via device_id/content_type/file_name".
- **FATX case:**
  - xenia-canary `src/xenia/vfs/entry.cc`: `Entry::GetChild` matches each path part with `xe::utf8::equal_case`.
  - Velocity `XboxInternals/Fatx/FatxDrive.cpp` and mborgerson/fatx `libfatx/fatx_dir.c` use exact `strcmp` matching.
  - Free60 FATX: names are stored as given, "padded with either 0x00 or 0xFF bytes".
- **Hard drive areas:**
  - Free60 FATX: retail offsets are "built in to the kernel".
  - Velocity `XboxInternals/Fatx/FatxConstants.h` and `FatxDrive.cpp` ("System Extended", "System Auxiliary", "Content").
  - Eaton Works (§8.4) on the 2008 system areas and the 2012 dashboard move.
- **USB `Data####` files:** Digiex (https://digiex.net/threads/please-help-how-can-i-make-my-usb-xtaf-files-data0000-files-usable.12890/), and Free60's USB page.

### 8.9 §6: Package format in detail

- **Header and metadata layout:**
  - xenia-canary `kernel/xam/xcontent/xcontent.h` (`XContentHeader`, `XContentMetadata`, `XContentLicense`, `XContentAttributes`).
  - xenia-canary `kernel/util/xex2_info.h` (`xex2_opt_execution_info`).
  - Velocity `XboxInternals/Stfs/XContentHeader.cpp` and `StfsDefinitions.h` (`Certificate`).
  - **Certificate date:** Free60's STFS page (an 8-byte ASCII string, "Certificate Date of Generation", with no format) and Velocity `XboxInternals/Stfs/StfsDefinitions.cpp` (`ReadCertificateEx` reads it as a plain string).
- **STFS and SVOD structures:** xenia-canary `vfs/devices/stfs_xbox.h` (`StfsVolumeDescriptor`, `StfsHashEntry`, `StfsHashTable`, `StfsDirectoryEntry`, `SvodDeviceDescriptor`) and `xcontent_devices/stfs_container_device.cc` (`BlockToOffset`).
- **SVOD layouts:** xenia-canary `xcontent_devices/svod_container_device.cc` (`SvodLayoutType`).
- **Languages:**
  - xenia-canary `xcontent.h` (`kNumLanguagesV1 = 9`, `kNumLanguagesV2 = 12`, and `display_name()`, which reads slot ID − 1 and falls back to English above 12). Checked at commit `2372a54`.
  - xenia `xbox.h` (`XLanguage`: Simplified Chinese 10, Polish 11, Russian 12). Checked at commit `95a5c3e`.
  - xenia-canary `xbox.h` (`XLanguage`: ID 10 unnamed, Polish 11, Russian 12, Swedish to Dutch 13 to 16, Simplified Chinese 17). The change is commit `9ce91e5` ("Listed extended languages").
  - rom-properties `xbox360_xdbf_structs.h` (`XDBF_Language_e`: Simplified Chinese 10, Polish 11, Russian 12) and `xbox360_stfs_structs.h` (18 slots of `0x80` bytes).
  - Free60 `System-Software/Profile_Account.md` (`ConsoleLanguage`: SChinese, Polish, Russian after Portuguese).
  - The *South Park* fixture (§8.2): Polish and Russian names in slots 10 and 11.
- **Transfer flags:** Velocity `Velocity/transferflagsdialog.cpp` (explicit bit values).
- **String encoding:** rom-properties (UTF-16BE, and the UTF-8-as-UTF-16BE problem), and the *South Park* fixture (§8.2).
- **How other software treats header fields** (checked on 2026-10-13, for §6.1 and §6.4):
  - xenia-canary @ `2372a54`: `kernel/xam/xcontent/xcontent_package_container.cc` (thumbnail space by metadata version).
  - Velocity @ `cf0b84c`: `XboxInternals/Stfs/XContentHeader.cpp` (`readMetadata`).
  - rom-properties @ `75fb203` (`xbox360_stfs_structs.h`) and Free60's STFS page: series ID at `0x3B1`.
  - emoose `Xbox360Container.bt` @ `5f85b9e` and acceleration @ `e7a6851`: the layout used here.
  - iso2god-rs @ `76207d7` (`src/god/con_header.rs`) and Iso2God (decompiled, r4dius/Iso2God @ `09a6edf`, `ConHeaderWriter.cs`): the data file count at `0x3A0`.
- **Header sizes:** emoose `Xbox360Container.bt` (LIVE and PIRS headers are `0xAD0E` "because they include XCONTENT_METADATA_INSTALLER"), and the GOD fixtures (§8.2).

### 8.10 §7: Rules for tools

§7's rules are built on the sections they cite. Their sources are listed under those sections above.

- **Writing from a browser** (§7.4): the real-drive test in §8.3; MDN browser-compat-data for `showDirectoryPicker`, `createWritable` and `move` (checked 2026-10-15); the WHATWG File System standard (writes don't show until the stream is closed).
