# Xbox 360 Content Specification: corrections to the old docs

[xcontent-spec2.md](xcontent-spec2.md) replaces two older documents:
- `xbox360-content-format.md` ("format" below)
- `xbox360-content-partitions.md` ("partitions" below)

These claims in the old documents were wrong, and are corrected in the specification. Section numbers refer to the specification.

## Package formats

| Old claim | Correction | Doc |
|---|---|---|
| SVOD data files are "up to ~4 GB each" | Each is exactly `0xA290000` bytes (~162.6 MiB), except the last (§6.7) | format |
| SVOD is "used exclusively" for GameOnDemand | XboxTitle and InstalledGame use it too (§6.9) | both |
| A `.data/` directory reliably means SVOD | Use the volume type at `0x3A9` (§6.9) | format |
| SVOD data files are raw game content, read in order to rebuild the image | Each data file also holds hash tables (§6.7) | format |
| A disc install (`00004000`) has a different internal layout from GOD | It uses SVOD, in the same layout as GOD (§3.2) | format |
| SVOD stands for "Secure Virtual Offline Disk" | Microsoft's wording is "secure virtual optical disc" (§3.2) | format |

## Header fields

| Old claim | Correction | Doc |
|---|---|---|
| Display names are 18 slots of `0x80` bytes | 9 slots of `0x100` bytes (§6.5) | format |
| `0x004` is "Certificate owner console ID size" | It's the public key certificate size (§6.2) | format |
| `0x32C` is a hash "over entire header" | It's the content ID, a hash of the header from `0x344` on (§6.3) | format |
| The volume descriptor (`0x379`) "includes Media ID" | The Media ID is at `0x354`, outside the volume descriptor (§6.4) | format |
| Thumbnails are "raw PNG/JPEG blobs", and the header holds "region flags" | Thumbnails are PNG, and the header has no region field (§6.4) | format |
| The first data block is at `0xC000` | It depends on the header size and the hash table copies (§6.1, §6.6) | format |
| A level-0 hash table comes "after every 170 data blocks" | It comes before the blocks it covers (§6.6) | format |

## Signing and licences

| Old claim | Correction | Doc |
|---|---|---|
| `CON` packages "are locked to the console that created them" | Any console can check a `CON` signature. A save is tied to a profile, and sometimes a device, by IDs in its header (§2.2) | format |
| A `CON` package with a zeroed console ID has been re-signed and "functions on any console" | Unsupported. Re-signing uses a real console's keyvault (§2.3) | format |
| Aurora and FSD disc rips are `CON`-signed | Disc to GOD writes a `LIVE` package with an all-zero signature (§2.3) | format |

## Partitions and directories

| Old claim | Correction | Doc |
|---|---|---|
| The public partition holds content "whose licence is attached to the device" | The software that writes a package chooses its partition. Where a package is stored doesn't change its licence (§2.1, §2.2) | partitions |
| "Any profile signed in on the console can access content from the public partition" | Every profile can see it, but a licence can still restrict who may use it (§2.1) | partitions |
| There is one profile partition "per gamertag that has been active on the device" | A profile partition exists only where something belonging to that profile is stored. It can exist without the profile, and may be left behind after the profile is deleted (§2.1) | partitions |
| Gamer pictures and themes are in profile partitions | They are in the public partition, under `FFFE07D1` (§2.1, §4.7) | both |
| Content-type directory names are lowercase hex | They are uppercase (§7.1) | both |
| Package files have "no extension" | Names can end in `.xml`, `.dat` or `.pkg`, which say nothing about the format (§7.2) | both |

## Content types

| Old claim | Correction | Doc |
|---|---|---|
| `0x00008000` is AvatarAssetPack | It's a system update storage pack (§4.2) | format |
| XNA (`000E0000`) is an "XNA community game" | It holds saves and data for Indie games, under the XNA Indie Player's Title ID (§4.3) | format |
