# Xbox 360 Content Specification: research record

This document records the primary research behind [xcontent-spec2.md](xcontent-spec2.md): the questions that online sources couldn't settle, how they were checked against real drives, and what was found. The specification states the results. This record holds the evidence and the questions that are still open.

## Sources examined

- **A FAT32 USB drive** ("USB Storage Device") holding four `Content/` trees of unknown provenance: `Content/`, `ContentFromDisk/`, `OldContent2/` and `NewContent/`. That is 591 packages in all. `NewContent/` is the old Loadout copier's output.
- **A 181-package copy** of part of `NewContent/`, linked in this repo as `fixtures/Content`.

**Method.** The drives were treated as read-only, and read as little as possible:
- one walk of names, sizes and dates
- one read of the first `0x1800` bytes of every package file
- a few small re-reads of signatures

No `Data####` file was read. Every header field was decoded as described in the specification's §6.

**Detailed findings:**
- [real-drive-findings.md](session_context/loadout/docs/real-drive-findings.md): every result, with counts and examples
- [x1-research-findings.md](session_context/loadout/docs/x1-research-findings.md): the SVOD `.data/` question (X1)

## Questions checked against real drives

These questions were checked on 2026-10-12. The section numbers refer to the specification.

1. **Public partition contents (§2.1).** Are Games on Demand, Arcade games, demos, disc installs, gamer pictures and themes all under `0000000000000000`?
   - **Mostly yes.** ✅ GOD, disc installs, gamer pictures, themes, avatar items, DLC, title updates, trailers and app saves are all there. Arcade games are there too. ✅ Demo directories held only downloads in progress, so demos are unconfirmed.
2. **Profile partitions (§2.1).** Does a profile partition exist only where that profile has content? Are there partitions whose profile isn't on the drive, or that were left behind by a deleted profile?
   - **Yes, a partition can exist without its profile.** ✅ One profile partition held only saves, and its profile package wasn't on the drive. Its name, `E812CECF9EA2AF5F`, is why §2.1 doesn't require an `E0` prefix.
   - **Left-behind partitions:** won't be checked. Tools should assume they occur (§2.1). 🔶
3. **Saves in the public partition (§2.1).** Are there any saves (`00000001`) under `0000000000000000`?
   - **Yes.** ✅ Seven `CON` saves, all app data: PlayReady licence stores, Zune, Xbox Music and Video, Sky Player and Demand 5. No game saves.
4. **Package names and content IDs (§5).** For a few Xbox Live DLC and GOD packages, does the file name start with the 20-byte content ID at header offset `0x32C`, written in hex?
   - **Yes.** ✅ All 59 42-character names are the content ID plus the Title ID's first byte. Exceptions: `PIRS` themes (the 40 digits aren't the content ID, and some names are short words such as `fc3theme`), *Dragon Age: Origins* DLC (41 characters: only the first digit of the Title ID byte), and avatar items (the 16-byte asset ID at `0x3E1`).
5. **GOD header names (§5).** How long are the header names of Aurora's Disc to GOD rips? Do real Xbox Live GOD headers have 34-character names?
   - **Yes.** ✅ A real Xbox Live GOD has 34 characters: the first 32 digits of the content ID plus the Title ID byte. Aurora's Disc to GOD rips and disc installs have 32 characters, ending with the media ID.
6. **Disc install signatures (§2.2).** Is a disc install (`00004000`) header labelled `CON`?
   - **Yes.** ✅ `CON`, signed, with one console licence.
7. **Aurora's Disc to GOD signature (§2.3).** Is the header of an Aurora Disc to GOD rip labelled `LIVE`, with a blank signature?
   - **Yes.** ✅ All 8 Disc to GOD rips (made with Aurora's Disc to GOD, the drive owner confirmed) are `LIVE` with an all-zero signature.
8. **Licences on a modded console (§2.2).** Does purchased content copied to another modded console play without being unlocked?
   - **Left open.** It needs a second console, and none is available. The files do confirm that paid DLC has two licences: an XUID and the console.
9. **Avatar award items (§4.6).** Is an awarded item stored at `Content/0000000000000000/<awarding TitleID>/00009000/`, and what is its header labelled (`PIRS`, `LIVE` or `CON`)?
   - **Yes.** ✅ Under the awarding title (for example *Halo Waypoint*'s `4D5308CE`). Award items are `PIRS`, and bought ones `LIVE`. 🔶 (Award or bought is judged by name.) **Left open:** confirming it would mean reading inside packages, which won't be done.
10. **Player-made content (§4.9).** What content type do *Halo 3* Forge maps, saved films and screenshots, and *Minecraft* worlds use?
   - **For *Halo*: SavedGame (`00000001`)** ✅ in the profile partition. *Halo 3* Forge maps are `usermap…` saves, and *Reach* and *Halo 4* map variants are saves too. Saved films, screenshots and *Minecraft* worlds weren't on either drive. They are probably saves too. 🔶 Left as that: other games' content won't be checked one by one.
11. **FATX case (§5).** Does the console find content in lowercase directories, such as `4d5307e6/000d0000/`, and a data directory spelled `<name>.DATA`?
   - **Partly.** Every directory was uppercase, but the console writes some file names in lowercase (title updates, XNA packages, gamer picture caches). Whether it finds lowercase directories, or `.DATA`, would need a test on a real FATX drive. **Left open:** that test won't be done. The spec treats the console as probably case-insensitive (§5, §7.1). 🔶
12. **The X1 question.** What format are the user's ripped games in (§4.3), and were past copies complete?
   - **Answered.** ✅ The games are SVOD, not extracted rips. The old app's output (`NewContent/` on the USB drive, of which the local copy is a subset) has every SVOD header but no `.data/` directories. The 24 complete SVOD packages elsewhere on the drive match §3.2 exactly.

## Still open

These were left open by decision:

- **Q2:** whether deleting a profile leaves its partition behind. Tools should assume it does (spec §2.1).
- **Q8:** whether purchased content plays on a second modded console without being unlocked. No second console is available.
- **Q9:** whether avatar award items are always `PIRS`. Checking would mean reading inside packages.
- **Q10:** player-made content other than *Halo*'s. It is probably saves 🔶. Other games won't be checked one by one.
- **Q11:** how the console handles name case on FATX. No FATX test will be done. The spec treats the console as probably case-insensitive 🔶.

Some ❓ and 🔶 marks also remain throughout the specification. They have been reviewed and accepted as they are.
