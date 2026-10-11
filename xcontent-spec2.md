# Xbox 360 Content Specification (v2)

This document describes what the Xbox 360 stores, where it stores it, and in what format. It replaces `xbox360-content-format.md` and `xbox360-content-partitions.md`.

It is written for the developers and AI agents working on `xcontent`, `xcontent-web` and the apps built on them.

> **Status: draft.** The non-technical parts (§1–§5) are drafted. The technical parts (§6 and §7) are outlines only.

### How confidence is marked

| Mark | Meaning |
|---|---|
| ✅ | Verified against source code or primary documentation. Sources are listed in §8. |
| 🔶 | Widely reported, but not yet verified against a primary source. |
| ❓ | Open question. Do not rely on it. |

---

## 1. The big picture

### Packages

The Xbox 360 keeps almost everything a user downloads, installs, saves or creates in **packages**. A package is a single unit of content, such as a game, a DLC pack, a save or a profile. Most packages are one file. Large ones are a small header file plus a directory of data files (§3.2). ✅

"Package" is the common term. Microsoft calls these *content packages*, and the community calls them *XContent packages*, after the `XContent` header they start with. ✅

Packages are stored on storage devices: hard drives, memory units, USB drives and, on some later models, built-in storage. ✅

> **Out of scope: discs and system flash.** Two other kinds of storage don't use packages, and this repo doesn't handle them. They are mentioned only where they help explain packages.
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

> **Terminology note:** this project defined the term *partition*. The wider Xbox 360 community has no agreed name for these directories. *Partition* was chosen because each directory holds content for one owner, and no two overlap. It has nothing to do with the partitions of a hard drive.

Not everything sits inside `Content/`. System software updates, game caches and backward-compatibility data use other areas of the drive (§4.6 and §4.7). Homebrew dashboards such as Aurora, and some homebrew software, also keep their own files elsewhere. ✅

> **Aside: games and apps as raw files.** A game or app doesn't have to be a package. It can also be stored as a plain directory of files, with a `.xex` file at the top, usually `default.xex`. ✅
> - **XEX** (Xbox Executable) is the Xbox 360's program file format, similar to a `.exe` file on Windows. The console runs the `.xex`, and the program reads the other files in its directory. ✅
> - **Game discs** ship like this: a retail DVD holds a `default.xex` and the game's files. ✅
> - **Homebrew** apps and dashboards usually ship like this. Their program file is typically `default.xex`, but not always. ✅
> - **Extracted disc rips** are a copy of a disc's files in this form (§4.3). ✅
>
> Games and apps in `.xex` format are not packages. They also bundle their metadata in a different way, so they are incompatible with tools that are designed for packages. 

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

**A profile partition** holds content tied to one profile. Its name is the profile's ID: 16 hex digits starting `E0`, which is also the file name of the profile package. ✅ It is not the profile's Xbox Live ID, which is a different number stored inside the profile. ✅

A profile partition exists only on a device where something belonging to that profile is stored. 🔶 So a device can have a profile partition without the profile itself: for example, a profile's saves can be on the hard drive while the profile is on a memory unit. A partition can also be left behind after its profile has been deleted. ❓

Typical content in a profile partition:

- the profile itself (`00010000`) ✅
- saves (`00000001`) ✅ A game can also put saves in the public partition, but this is unusual. 🔶

### 2.2 Signing and licensing, in plain terms

Every package declares one of three kinds of signature, shown by the label at the start of the file (except PEC, §3.3). ✅ The signature controls whether the console trusts the package. Whether a package can be used on another console or by another profile is decided by its licence and its header IDs (see below). A package can declare a kind without being genuinely signed. Tools that make or edit packages often can't produce a real Microsoft signature (§2.3).

| Signed by | Label in the file | Typical content | Can it move to another console? |
|---|---|---|---|
| A console | `CON` | Saves, profiles, cache files ✅. Probably disc installs 🔶 | Yes. Any console can check a `CON` signature. ✅ A game may still refuse a save made under a different profile. |
| Microsoft, through Xbox Live | `LIVE` | Marketplace downloads: games, DLC, themes, avatar items ✅ | Yes, but using it needs a licence (see below). ✅ |
| Microsoft, outside Xbox Live | `PIRS` | System updates and content on game discs ✅. Probably title updates 🔶 | Generally yes. 🔶 |

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

- **Tool-made packages.** Iso2God and iso2god-rs start from a blank `LIVE` header, with an empty signature. ✅ Aurora's Disc to GOD also writes a `LIVE` package, not a console-signed disc install. 🔶 None of these has a genuine Microsoft signature, since only Microsoft holds that key. ✅
- **Edited packages.** Once a save or profile has been edited on a PC, its hashes have to be recalculated and the package re-signed. ✅
  - **`CON` packages:** tools such as Velocity and Horizon re-sign them with the private key from a real console's keyvault (`KV.bin`). Any genuine retail keyvault works, so even a stock console accepts the result. ✅ A re-signed `CON` package is genuinely signed, just not by the console that made it.
  - **`LIVE` and `PIRS` packages:** no tool can produce a genuine signature. ✅
- **Homebrew packages** may carry blank signatures, or a `CON` signature made with someone else's keyvault. 🔶

**Whether this matters depends on the console.** A stock console treats a package that isn't genuinely signed as corrupt. ✅ A soft-modded console runs a patched kernel that skips the `LIVE` and `PIRS` signature checks, which is why tool-made packages, such as a Disc to GOD rip, work on it. ✅

For this repo, the label says only which kind of signature a package *claims*. A `LIVE` label is not proof that a package came from Xbox Live.

---

## 3. Package formats: a short summary

A **package format** is the way a package is built: how its contents are laid out inside it, and how the console checks that they haven't been changed. Some tools, notably xenia, call this a *container format*. ✅

There are two package formats, STFS and SVOD. No source defines any other. ✅ A third, PEC, is a cut-down variant of STFS that is only found inside profile packages (§3.3).

### 3.1 STFS: single-file packages ✅

**STFS** (Secure Transacted File System) is the standard package format. The whole package is one file containing three parts:

- a header that describes it
- a small file system holding the package's own files
- a tree of hashes that lets the console detect tampering

The file system inside is a real one: files are stored in fixed-size blocks, with a table of file names and their blocks. The console mounts an STFS package and reads its files through it, much as a Mac mounts a `.dmg` disk image. It is not like a `.tar` archive, which just stores files one after another. ✅

"Transacted" refers to how STFS handles changes. Free60 says it keeps "multiple file / directory revisions". In the code of Velocity and xenia, a package can keep two copies of its hash blocks and switch which one is active. 🔶 That suggests a change is written to the inactive copy and then made active, so an interrupted save doesn't corrupt the package. No source says this outright.

Saves, DLC, title updates, profiles, Arcade games, themes and most other content use STFS.

### 3.2 SVOD: split packages for large content ✅

**SVOD** (Secure Virtual Optical Disc 🔶) holds a whole disc image, such as a full game. A disc image is too big for one file on the console's file system, so SVOD splits it into two parts:

- a **header file** of about 44 KB, holding the same kind of header as STFS
- a **companion directory** with the header's name plus `.data`, holding numbered data files (`Data0000`, `Data0001`…) of about 163 MB each

The two parts are one package. Copying, moving or deleting one without the other breaks the game.

Unlike STFS, SVOD has no file system of its own. It is a signed, hashed wrapper around a disc image, much like a signed `.iso` split into pieces. The game's files are inside that disc image, in the disc's own file system, XDVDFS (§5). ✅ The disc image's start is marked with the disc format's magic, `MICROSOFT*XBOX*MEDIA`.

> **Checked against real files.** This repo's test fixtures include two real GOD headers, from *Dead Island Riptide* and *South Park: The Stick of Truth*. Both are exactly 45,056 bytes, with volume type 1 (SVOD). Their data file counts are 22 and 23, which match their combined data sizes (3.43 and 3.63 GiB) split into ~163 MB files. Two real DLC packages in the fixtures have volume type 0 (STFS) and a data file count of 0. ✅

SVOD is used for Games on Demand and for original Xbox games converted with tools such as Iso2God. Disc installs made by the dashboard probably use it too 🔶. Because it is a format and not a content type, the only reliable test is the package's header (§6).

> **About the name.** Microsoft never spells out the acronym SVOD. A Microsoft patent calls this layer a "secure virtual optical disc", which matches the initials. One community wiki, Xeren, says "Secure Virtual Offline Disk" instead, without a source. This spec uses Microsoft's wording. 🔶

### 3.3 PEC: profile embedded content ✅

**PEC** (Profile Embedded Content) is an STFS package with most of its header removed. It isn't stored in `Content/` on its own. It is a file named `PEC` inside a profile package (§4.5).

- **What it holds:** the GPD files for a player's avatar awards (§3.4), and some other GPD files moved there from the profile. Free60 describes PEC as "an additional layer of security on profiles".
- **How it differs from STFS:** it has no `CON`/`LIVE`/`PIRS` magic, no display information and no thumbnails. Its short header has the console's certificate, the profile's ID and the ID of the console it belongs to. The details are in §6.

### 3.4 File formats found inside packages

These are not package formats. They are the kinds of file a package can hold.

| Format | What it is | Where it appears |
|---|---|---|
| **XEX** (Xbox Executable) | A game's or app's program file, such as `default.xex` | Discs, game packages, title updates, extracted rips. ✅ |
| **XDBF / GPD** (Xbox Database File / Gamer Profile Data) | A small database of achievements, settings and play history for one title | Inside profile packages: one per game played, plus one for the dashboard. Avatar award GPDs are inside the PEC. 🔶 |
| **Account** | The profile's identity: gamertag, Xbox Live details, settings. Encrypted. | Inside profile packages. 🔶 |
| **Images** (PNG) | Thumbnails, gamer pictures, avatar renders | In package headers and inside packages. ✅ |
| **SPA** | A game's achievement and settings definitions. It is an XDBF file. | Inside game packages. ✅ |
| **XEXP** (XEX patch) | A patch that updates a game's `.xex` | Inside title update packages. ✅ |
| **FMIM** | Music ripped from a CD: a WMA file with a small header | System music storage, outside `Content/` (§4.6). ✅ |
| **Game-defined files** | Whatever a game chooses to write | Inside saves and DLC; the format is the game's own. ✅ |

Two more formats look like package formats but aren't:

- **XCP** (Xbox Content Package) is how Xbox Live delivers downloads: an STFS package, compressed and encrypted. It is unpacked on download, so it never appears in `Content/`. 🔶
- **XUI resource files** (`.xzp`, `.xuiz`) and **Kinect data** are probably ordinary data files. No source says otherwise. ❓

---

## 4. Content types: what is stored, and in what format

This section lists every content type, then describes each kind of content in turn: what it is, which content type it uses, and what format it is stored in.

### 4.1 Content type names

❓ **Content type names aren't consistent across the community.** Microsoft's own names aren't public, so each tool picks its own. The names in §4.2 follow the majority of four sources: xenia, Velocity, Free60 and rom-properties (§8). Other names in use are listed alongside. The IDs are consistent across all sources. ✅

This repo's code (`ContentTypeName` in `xcontent`) still uses Velocity's names, which differ in places. Where they do, the code's name is under "Other names".

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
| AvatarAssetPack ❓ | SUStoragePack (xenia) | Disputed: a bundle of avatar assets (Velocity), or a system update storage pack (xenia) | `0x00008000` | `00008000` |
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
| GameTitle | GamerTitle (Velocity, this repo) | Game title content | `0x000A0000` | `000A0000` |
| Installer | | A title update (game patch) or other install package | `0x000B0000` | `000B0000` |
| GameTrailer | | A game trailer video | `0x000C0000` | `000C0000` |
| ArcadeTitle | ArcadeGame (Velocity, this repo) | An Xbox Live Arcade (XBLA) game | `0x000D0000` | `000D0000` |
| XNA | | An XNA game | `0x000E0000` | `000E0000` |
| LicenseStore | | Licence data | `0x000F0000` | `000F0000` |
| Movie | | A film | `0x00100000` | `00100000` |
| TV | Video (Velocity, this repo) | A TV episode | `0x00200000` | `00200000` |
| MusicVideo | | A music video | `0x00300000` | `00300000` |
| GameVideo | | A video about a game | `0x00400000` | `00400000` |
| PodcastVideo | | A video podcast | `0x00500000` | `00500000` |
| ViralVideo | | A shared or viral video | `0x00600000` | `00600000` |
| CommunityGame | | A community (Xbox Live Indie) game | `0x02000000` | `02000000` |

Descriptions are inferred from the names and from community knowledge. None of the sources describe what each type holds. 🔶

### 4.3 Games

Many content types hold something that could be called a game. They differ in where the game came from and how the console runs it.

| Content type | What it is | Where it comes from | Package format | On a modded console's drive |
|---|---|---|---|---|
| GameOnDemand (`00007000`) | A full retail disc game, packaged to run from storage | Bought from Xbox Live (`LIVE`), or converted from a disc (see below) | SVOD | Very common ✅ |
| InstalledGame (`00004000`) | A copy of a disc game on the hard drive, to speed up loading. The disc is still needed to play. | The dashboard's "Install to Hard Drive" (`CON`, signed by that console 🔶) | Probably SVOD 🔶 | Uncommon. NXE2GOD converts these to GameOnDemand. 🔶 |
| ArcadeTitle (`000D0000`) | A smaller, download-only Xbox Live Arcade game | Xbox Live (`LIVE`) | STFS | Common ✅ |
| XboxTitle (`00005000`) | An original Xbox game, run through the backward-compatibility emulator | Xbox Live ("Xbox Originals"), or converted with tools such as Iso2God | SVOD | Occasional 🔶 |
| GameDemo (`00080000`) | A free, limited version of a game | Xbox Live | STFS | Occasional 🔶 |
| CommunityGame (`02000000`) | An Xbox Live Indie Game: a small game made by an independent developer with XNA | Xbox Live | STFS 🔶 | Occasional 🔶 |
| XNA (`000E0000`) | An XNA game, probably from the earlier XNA Creators Club ❓ | ❓ | STFS 🔶 | Rare ❓ |
| XNACommunity (`00003000`) | ❓ Only xenia lists it. | ❓ | ❓ | Rare ❓ |
| Xbox360Title (`00001000`) | ❓ An Xbox 360 game or app package. What uses this type in practice is unclear. | ❓ | ❓ | ❓ |
| GameTitle (`000A0000`) | ❓ Unclear. | ❓ | ❓ | ❓ |
| SocialTitle (`00006000`) | ❓ A social app or title. Only xenia lists it. | ❓ | ❓ | ❓ |

Notes on games:

- **Games on Demand are stored in the public partition**, at `Content/0000000000000000/<TitleID>/00007000/`. ✅
- **GOD made from a disc** (Aurora's Disc to GOD, Iso2God and similar) has a `LIVE` header that isn't really signed, so it runs only on a modded console. Tools put it in the right place only if the user lets them create the directories. Each disc of a multi-disc game is its own package in the same directory. ✅
- **Homebrew can appear as a GameDemo.** XeXMenu ships as a `CON` package at `Content/0000000000000000/C0DE9999/00080000/C0DE99990F586558`, so it shows up in the stock dashboard's demos. 🔶
- **CommunityGame and XNA:** ❓ it isn't clear which of the two Xbox Live Indie Games use in practice.
- **Retail discs** aren't packages (§1, out of scope). The console can't run a disc game from storage unless it has been installed or converted. ✅
- **Extracted disc rips** aren't packages either. They are made by Aurora's Disc Ripper, its File Manager copy, FSD's DVD Extract and XeXMenu's CopyDVD. Each is a plain directory of the disc's files, with `default.xex` at the top (§1, "Aside: games and apps as raw files"). They sit wherever the user chose, usually outside `Content/` (for example `Hdd1:\Games\<name>`). They run only on a modded console, and our scanner doesn't see them. ✅

These content types sound like games but aren't:

- **Installer** (`000B0000`): a title update for a game, not the game itself.
- **GameTrailer** (`000C0000`) and **GameVideo** (`00400000`): videos about a game.
- **SavedGame** (`00000001`) and **XboxSavedGame** (`00060000`): save data.
- **MarketplaceContent** (`00000002`): DLC for a game.

### 4.4 DLC, Marketplace content and other downloads

| Kind of content | Format | Content type |
|---|---|---|
| **DLC** (map packs, add-ons) | STFS, `LIVE` | `00000002` ✅ |
| **Title updates** (game patches) | STFS, usually `PIRS` 🔶 | `000B0000` ✅ |
| **Avatar items** (clothing, props) | STFS, `LIVE` | `00009000` ✅ |
| **Avatar asset packs** | STFS | `00008000` 🔶 |
| **Gamer pictures** | STFS | `00020000` ✅ |
| **Dashboard themes** | STFS | `00030000` ✅ |
| **Videos** (trailers, movies, TV, music videos) | STFS | `000C0000`, `00100000`–`00600000` 🔶 |
| **Licences** | STFS | `000F0000` ❓ |

❓ Title updates for disc games may also be cached outside `Content/`, in the drive's cache area. On modded consoles, dashboards such as Aurora manage title updates in their own way. This needs research.

### 4.5 Player profiles, including avatars

A **profile** is a player's identity on the console. Each one is a single STFS package, signed by the console it was created on. 🔶 It lives at:

```
Content/<ProfileID>/FFFE07D1/00010000/<ProfileID>
```
(`FFFE07D1` is the dashboard's Title ID.) 🔶

Inside the profile package are several files 🔶:

- the **Account** file: gamertag, Xbox Live details and core settings, encrypted
- one **GPD** file per game played, holding that game's achievements and per-game settings
- a **dashboard GPD**, holding console-wide settings and the avatar's description
- **images**: the gamer picture, and rendered pictures of the avatar
- a **PEC** holding the avatar award GPDs (§3.3) ✅

**Avatars.** ❓ The avatar's look appears to be stored in the profile's dashboard settings, with rendered images of it alongside. Avatar items the player owns are separate packages (§4.4). Records of the avatar awards a player has earned are kept in GPD files inside the PEC. ✅ ❓ Where the award items themselves are stored, and how the avatar's look is stored, still needs research.

### 4.6 System and dashboard data

- **Base system software** (the kernel and dashboard) lives in the internal flash memory, not on the storage device. 🔶
- **System software updates and dashboard extensions** are stored on the hard drive, outside `Content/`. They include the dashboard features added in later updates, Kinect support and the avatar system. 🔶
- **Dashboard and system content** that looks like ordinary content uses system Title IDs, such as `FFFE07D1` for the dashboard. ❓ The full list needs research.
- **Music ripped from CDs** is stored as FMIM files (§3.4), outside the normal package tree. ✅ ❓ Where exactly, and how other media synced to the console is stored, needs research.

### 4.7 Other stored content

| Kind of content | What it is | Format |
|---|---|---|
| **Game cache** | Scratch space games use to speed up loading. Safe to clear. | A cache area of the drive, plus cache packages (`00040000`). 🔶 |
| **Original Xbox compatibility data** | The emulator and the original Xbox's own save storage | Its own area of the drive. 🔶 |
| **Original Xbox saves and downloads** | | `00060000` and `00070000` packages ❓ |
| **IPTV pause buffer** | Live TV pause storage (IPTV services) | `00002000` ❓ |
| **Homebrew data** (Aurora, FSD, plugins) | Dashboard settings, artwork caches, scripts | Plain files outside `Content/`. Not packages. ✅ |

### 4.8 Game and app save data

**Format.** A save is an STFS package with content type `00000001`, stored under the profile that made it. 🔶 Inside are files whose format the game defines. The package is signed by the console and tied to the player's profile, so a save can't simply be copied to another player. 🔶

**Saves used for other purposes.** Saves aren't always progress data. ❓ All of these need research and real examples:

- **Player-made content.** Games store user-created maps, replays and screenshots as save-type packages.
- **Unlocks across games.** Sequels read the earlier game's saves to carry choices or rewards forward.
- **Modding.** PC tools such as Horizon and Modio re-sign edited saves to change in-game stats or unlock items.
- **Exploits.** Specially built saves have been used to trigger bugs in games, for example to run unsigned code.
- **Downloaded data.** Some games keep data downloaded from their servers as saves or cache packages.

---

## 5. File systems: a short summary

| File system | Used on | Notes |
|---|---|---|
| **FATX** | Hard drives, memory units, built-in storage | Microsoft's own version of FAT. Each file can be at most 4 GB, which is why SVOD splits large games. File names are limited to 42 characters. 🔶 Sometimes called "XTAF". |
| **FATX inside image files** | USB sticks set up by the dashboard | The stick stays FAT32, but the Xbox storage lives inside large `Xbox360\Data0000`, `Data0001`… files. These have **nothing to do with** SVOD's `Data####` files. ✅ |
| **FAT32** | USB drives on modded consoles | Holds a normal `Content/` tree that a PC can read directly. ✅ |
| **XDVDFS / GDF** (Xbox DVD File System / Game Disc Format) | Game discs, extracted rip images (ISO files), and the disc image inside every SVOD package | The disc format. A GOD package's data files hold a disc image in this format. ✅ |
| **STFS's internal file system** | Inside every STFS package | A small file system inside each package file (§3.1). ✅ |
| **Raw NAND** | Internal flash memory | System software. It isn't a user-facing file system. 🔶 |

❓ Is the 42-character FATX name limit right? If so, a 40-character header name plus `.data` (45 characters) couldn't exist on FATX. That casts doubt on reports of 40-character GOD header names. To be checked against a real drive.

---

## 6. Package format in detail *(technical, to do)*

- For each content type: which can be SVOD, and which usually sit in the public partition and which in a profile partition.

To carry over and correct from the old spec:
- The header layout: magic, certificate, metadata, display strings (old §3 and §9).
- STFS blocks and the hash tree.
- The SVOD header fields:
  - data file count at `0x39D`
  - combined data size at `0x3A1`
  - descriptor type at `0x3A9` (big-endian u32: 0 means STFS, 1 means SVOD)
- The SVOD data-file rules:
  - each file is exactly `0xA290000` bytes, except the last
  - files are named `Data%04d`, with no gaps in the numbering
  - the directory is found by the header name plus `.data`
  - header names are set by the tool that made the package, and their length varies (8 hex characters for iso2god-rs, 20 for Iso2God)
- How to tell STFS from SVOD.
- The PEC header: no magic, so the file starts with the 0x228-byte console certificate. The fields are:
  - the header hash at `0x228`, covering `0x23C`–`0x1000`
  - the STFS volume descriptor at `0x244`
  - the profile ID at `0x26C`
  - the console ID at `0x275`, which must match the certificate's
  - an "enabled" byte that must be 1

  The header is `0x1000` bytes. Hash table 0 starts at `0x1000` and data block 0 at `0x3000` (Free60, Velocity).
- Fix the old spec's claims that:
  - Disc to GOD output is `CON`-signed
  - SVOD is used only for GOD
  - a `.data/` directory is the way to detect SVOD

## 7. Rules for tools in this repo *(technical, to do)*

### 7.1 Classifying partitions

From `xbox360-content-partitions.md`, §3:

```
directory name = 16 hex chars?   /^[0-9a-fA-F]{16}$/
  └─ no  → not a partition (ignore)
  └─ yes → partition
       └─ name = "0000000000000000"? → public  (profileId: null)
       └─ otherwise                  → profile (profileId: directoryName)
```

- Files directly inside `Content/` are always ignored, whatever their name.
- Inside a partition:
  - Title ID directories are named with 8 uppercase hex digits, such as `4D5307E6`.
  - Content-type directories are named with 8 zero-padded uppercase hex digits, such as `00007000` or `000D0000`. ✅ The old docs wrongly said lowercase.

### 7.2 Other rules

What `xcontent` and `xcontent-web` must do: for example, treat an SVOD header and its `.data/` directory as one unit when copying, merging, verifying or removing.

- Trust the partition directory's name to tell which profile a package belongs to. The profile ID in a package's header (`0x371`) normally matches it, but nothing enforces that, so use it only as a cross-check. ✅
- An SVOD package whose `.data/` directory is missing is incomplete, not a valid variant. xenia refuses to load one, and Velocity always expects the directory. ✅

## 8. Sources *(to do)*

- **Real files:** the package headers in `packages/xcontent/src/parse-header/__tests__/fixtures/`:
  - two GOD headers: `god-dead-island-riptide` and `god-south-park-tsot`
  - two DLC packages: `dlc-halo-reach-anniversary` and `dlc-halo-wars`

- **SVOD expansion:** Microsoft patent US20090143145A1, "Read Redirection of Physical Media" (https://patents.google.com/patent/US20090143145A1/en), says "a secure virtual optical disc layer 404 is used". The patent doesn't write "SVOD", but the phrase matches the initials and the feature. xenia, Velocity, rom-properties and Free60 use the acronym without expanding it. The Xeren wiki (https://www.xeren.com/wiki/xcontent.html) says "SVOD(Secure Virtual Offline Disk)", the old spec's wording, without citing a source.

- **Package terminology:**
  - Microsoft patent US7337147 (https://patents.google.com/patent/US7337147) says "content package".
  - xenia's `xam_content.cc` implements `XamContentCreate` and the `XCONTENT_DATA` type, names taken from Microsoft's SDK.
  - Velocity's main class is `StfsPackage`.
  - Horizon says "Xbox 360 XContent Package ( 'LIVE'.'PIRS'.'CON')". ConsoleMods says "STFS/SVOD package".
  - xenia-canary uses `StfsContainerDevice` and `SvodContainerDevice`, and also says "XContent packages".
  - emoose's stfschk calls itself an "STFS filesystem checker/verifier, used to check the validity of Xbox 360 XContent packages" (https://github.com/emoose/xbox-reversing/blob/master/stfschk/README.md).
- **STFS as a file system:** Free60 says STFS "is the file system used by the Xbox 360 for all packages", and that it is "secure and transacted (multiple file / directory revisions)" (https://free60.org/System-Software/Formats/STFS/). The dual hash blocks are in xenia's `stfs_xbox.h` (`root_active_index`) and Velocity's `SwapTable()`.
- **Package formats:** only STFS (0) and SVOD (1) are defined as volume types in xenia (`XContentVolumeType`), rom-properties, Velocity (`enum FileSystem`) and Free60.
- **PEC:** Free60 PEC page (https://free60.org/System-Software/Formats/PEC/); Velocity `XboxInternals/Stfs/XContentHeader.cpp` (`MetadataIsPEC`) and `Velocity/profileeditor.cpp`.
- **Other formats:** the Free60 Formats section (FMIM, GPD, SPA, XCP, XDBF, XEX); xenia `XexModule::ApplyPatch` for XEXP; xenia `SvodLayoutType` for the disc layouts inside SVOD.
- **NAND:** Free60 Boot Process (https://free60.org/System-Software/Boot_Process/): "1BL (Inside CPU)". Free60 NAND File System (https://free60.org/System-Software/NAND_File_System/) gives the layout: SMC, keyvault, CB, CD, CE (base kernel), CF/CG. Eaton Works (https://eaton-works.com/2023/01/09/how-microsoft-attempted-to-make-the-xbox-360-dashboard-load-faster/): the dashboard "was moved to the hard-drive's System Extended partition … still on the nand as a fallback."
- **Homebrew distribution:** the Aurora installation guide (https://elmajor9.github.io/xbox360-aurora-guide/installation/aurora/) shows `Aurora.xex` with `Data/`, `Plugins/` and `Skins/`, installed to `Hdd1:/Aurora/`. GamerGen's FSD guide (https://gamergen.com/tutoriels/glitch-freestyle-dashboard-12824-2) gives `Hdd:\FSD\default.xex` and DashLaunch's `default.xex`. The XeXMenu package path comes from search snippets of ConsoleMods (https://consolemods.org/wiki/Xbox_360:XeXmenu) and Se7enSins, so it is unverified.
- **Partitions:** xenia-canary `xam_content.cc` (`XamContentCreate`: the owner comes from `user_index`, and DLC is forced to xuid 0) and `content_manager.cc` (path `<{:016X} xuid>/<title>/<type>/<file>`; listing merges the common directory). Also `xam_avatar.cc`, `xam_user.cc` (gamer pictures under xuid 0) and `profile_manager.cc` (profile path `<xuid>/FFFE07D1/00010000/<xuid>`; IDs start `E0`). Velocity `profilecreatorwizard.cpp`. ConsoleMods' Files and Directories and Saves pages, from search snippets only. GamerGen's USB guide (https://gamergen.com/tutoriels/explorer-cle-usb-xtaf-4700-3/amp) for themes and gamer pictures under `0000000000000000/FFFE07D1/`.
- **Licences:** Free60 STFS (licence entries: "License ID (XUID / PUID / console id)"). Velocity `StfsDefinitions.h` (licence types), `StfsPackage.cpp` (new CON packages are unrestricted) and `licensingdatadialog.cpp`. xenia-canary `xcontent.h` (`XContentLicense`). Wikipedia's Xbox Games Store article: the licence "is tied to both a specific user and to a specific console". Shacknews on the licence transfer tool (https://www.shacknews.com/article/53337/xbox-360-license-migration-tool).
- **Signature kinds:** Free60 STFS: CON is "Found on many files such as cache files, profiles, saved games"; PIRS is "delivered by Microsoft through non-Xbox Live means such as system updates"; LIVE is "delivered over Xbox Live such as items from the Marketplace like themes". Velocity's `creationwizard.ui`: PIRS is "used for on disc content". ConsoleMods (search snippet): Disc to GOD "is signed as a digital GOD instead of a console signed disc installation".
- **Moving saves:** Microsoft's USB flash drive FAQ (https://web.archive.org/web/20150609225744/http://support.xbox.com/en-US/xbox-360/accessories/usb-flash-drive-faq): "A USB flash drive is a great way to take your game saves or gamertag with you to another console."
- **Purchased-content licences:** Microsoft's DRM FAQ (https://web.archive.org/web/20131117062807/http://support.xbox.com/en-US/xbox-360/downloadable-content/download-content): "The license has two parts: the system license and the local license." Xbox.com, 2006 (https://web.archive.org/web/20090826163526/http://www.xbox.com/en-US/community/personality/elle/20060814-shoptilyoudrop.htm): "The console license allows anyone to use that content on that console, online or off. The profile license allows you to use the content on any console, as long as you're signed in to Xbox Live".
- **Unlocking:** Velocity `licensingdatadialog.cpp`: "Content unlocked this way can only be used on a JTAG/RGH/Dev. If you try and play on a retail, it will show up as corrupt."
- **Re-signing:** Velocity `qthelpers.cpp` (`GetKVPath`, which looks for `KV_R.bin`/`KV_D.bin`) and `XContentHeader.cpp` (`ResignHeader`, which takes the certificate and key from the keyvault). iso2god-rs `src/god/empty_live.bin` (a blank LIVE header).
- **Modded consoles:** freeBOOT changelog and patch list ("Disable PIRS/LIVE Signature Check"; https://assemblergames.org/viewtopic.php?t=30068). XeUnshackle (https://github.com/Byrom90/XeUnshackle) notes that xeBuild applies the same patches. Free60 PEC page: a package with mismatched IDs is "seen as a corrupted file".
- **Content types:** xenia `src/xenia/xbox.h` (https://github.com/xenia-project/xenia/blob/master/src/xenia/xbox.h); Velocity `XboxInternals/Stfs/StfsConstants.h` (https://github.com/hetelek/Velocity/blob/master/XboxInternals/Stfs/StfsConstants.h); Free60 STFS (https://free60.org/System-Software/Formats/STFS/); rom-properties `xbox360_stfs_structs.h` (https://github.com/GerbilSoft/rom-properties/blob/master/src/libromdata/Console/xbox360_stfs_structs.h).

From the X1 research: iso2god-rs, Iso2God (r4dius), xenia, Velocity/XboxInternals, the Free60 STFS page, ConsoleMods' "Creating Game Backups" page, AuroraScripts (`DiscInstaller`, `DiscRipper`), and others.

## 9. To check against a real drive

These questions can be settled by looking at a real `Content/` directory. They are to be checked when one is available.

1. **Public partition contents (§2.1).** Are Games on Demand, Arcade games, demos, disc installs, gamer pictures and themes all under `0000000000000000`?
2. **Profile partitions (§2.1).** Does a profile partition exist only where that profile has content? Are there partitions whose profile isn't on the drive, or that were left behind by a deleted profile?
3. **Saves in the public partition (§2.1).** Are there any saves (`00000001`) under `0000000000000000`?
4. **GOD header names and FATX name lengths (§5).** How long are real GOD header names? Do any come close to FATX's 42-character limit once `.data` is added?
5. **Disc install signatures (§2.2).** Is a disc install (`00004000`) header labelled `CON`?
6. **Aurora's Disc to GOD signature (§2.3).** Is the header of an Aurora Disc to GOD rip labelled `LIVE`, with a blank signature?
7. **Licences on a modded console (§2.2).** Does purchased content copied to another modded console play without being unlocked?
8. **The X1 question.** What format are the user's ripped games in (§4.3), and were past copies complete?
