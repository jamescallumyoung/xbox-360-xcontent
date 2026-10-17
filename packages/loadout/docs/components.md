# Loadout — Component Spec

Status: **v3, the first real version.** v2 described the clickable proof of concept. v3 removes demo-only parts and the features `features.md` v4 leaves out of scope. Stack: Lit 3 web components with standard decorators (`@property() accessor name`), TypeScript.

**Components are views.** They read the store and call its actions. They never import `xcontent-fs-web` or `xcontent-header` (an ESLint rule enforces it): file and header work happens in `src/lib/`, through the store.

Terminology: the UI says **titles** everywhere (the Xbox 360 community's term). A _playable_ title contains a game or app. An _other_ title only has DLC, title updates or other content.

The user defined five components (Drive Widget, Title Grid, Game Tile, Discover Section, Header). The rest were added while composing the pages from the feature spec, and are marked _(added)_.

---

## Header - `<app-header>`

A sticky top bar with search and one status indicator. The logo and app name stay in the sidebar.

| Input          | Type                    | Notes                                          |
| -------------- | ----------------------- | ---------------------------------------------- |
| `query`        | string                  | Search text                                    |
| `titles`       | `Title[]`               | What search covers: **vault titles only**      |
| `status`       | `AppStatus`             | The store's one status (`lib-design.md` T1.11) |
| `error-count`  | number                  | Apply errors plus folder errors                |
| `progress`     | `ApplyProgress \| null` | Property only; shown while copying             |
| `queued-count` | number                  | Titles with queued changes                     |

**Search.** Results show in a dropdown under the box, which is normally hidden. It lists up to 8 matches (`searchTitles`, T1.12), each with its thumbnail, name, publisher and Title ID. The arrow keys, Enter and Escape work. Choosing a result opens that title's Manage page.

**Status indicator.** Exactly one state shows. Highest priority wins:

1. **Error**: alert icon, "N errors"
2. **Vault disconnected**: amber pulse
3. **Drive disconnected**: amber pulse
4. **Copying**: spinner, "Copying 2 of 5 · 41%"
5. **Ready to copy**: queued count, "Queued to copy"
6. **OK**: check, "Up to date"

These were "No vault/drive selected" in v1. Before setup the welcome modal covers the app, so after setup these states can only mean disconnected. On phones the long text is hidden. Clicking the indicator does nothing for now (user: "nothing right now"). _Which errors exist and what they say: "can be defined later"._

**Events**

- `search`, with `{ query }`
- `open-title`, with `{ titleId }`

---

## Drive Widget - `<drive-widget>`

One widget, used on Discover (`mini`) and the Drive page (`full`).

| Input          | Type           | Notes                                                                         |
| -------------- | -------------- | ----------------------------------------------------------------------------- |
| `name`         | string         | The drive folder's own name                                                   |
| `summary`      | `DriveSummary` | Playable and other title counts, total bytes, and one entry per title (T1.6e) |
| `health`       | `FolderHealth` | `{ state: connected \| disconnected \| error, message }`                      |
| `queued-bytes` | number         | Size of queued adds                                                           |
| `remove-bytes` | number         | Size of queued removals                                                       |
| `mode`         | `mini \| full` | `mini` hides the file tree                                                    |
| `scanning`     | boolean        | Spinner in place of the status icon. Disables Rescan                          |

**Layout** (design "A", chosen by the user)

- **Hero count** on the left: a big gradient number of **playable titles**, the label "PLAYABLE TITLES", and "+ N other titles" underneath. It sits beside both rows on the right.
- **Name row:** "Drive", because the browser can't read the device name. On the right are the status icon and **Rescan drive**. The icon is a green ✓ when connected, amber × when disconnected, and red ! on error.
- **Directory row:** "Directory name: <name>" (`FileSystemHandle.name`), kept tight against the name row as the user asked.
- **Problem line** (disconnected or error only): a message. Rescan is disabled.
- **Usage bar:** a _proportion_ bar of titles vs queued adds, with legend sizes, plus "To remove −X" on the right when removals are queued. The browser can't read capacity or free space, so neither is shown.
- **File tree** (full mode only): rooted at the directory name, `<name>/0000000000000000/<TitleID>   <title name>`, for the public partition only.
- **Background:** a gradient with generous padding, the "flare" from the original Discover strip.

**Events**

- `rescan`

---

## Game Tile - `<game-tile>`

| Input  | Type                                           |
| ------ | ---------------------------------------------- |
| `item` | `LibraryTitle` (`{ title, status, corrupt? }`) |

**What it shows**

- **Cover:** `<title-cover>` (below).
- **Type capsule:** `GOD` or `Other`.
- **Status badge:** on drive (green ✓), partly on drive (yellow half), changes queued (indigo clock). No badge when the title isn't on the drive.
- **Corrupt overlay:** a red "CORRUPT" strip along the bottom of the cover when any of the title's vault packages is corrupt (`features.md` §6).
- **Hover overlay:** publisher, name, chips (total size, "No game", TU count, DLC count, Other, Corrupt) and a **Manage** button. There's no release year.
- **Caption:** the title name.
- **Clicking anywhere** on the tile, or Manage, opens the Manage page. On touch screens there's no overlay; tapping opens it.

**Events**

- `tile-open`, with `{ titleId, status }`. It bubbles and composes.

---

## Title Cover - `<title-cover>` _(added)_

2:3 cover art, in this order of preference:

1. `coverUrl`: real cover art. This is a future enhancement.
2. Otherwise **generated art** (a hue from the Title ID) with the 64×64 header `thumbnail` as a **crisp centred icon**, plus the title name and publisher. This is option **A** from Q19.
3. Otherwise the generated art alone.

The green band at the top is decoration only, because real covers have the banner printed in, so it carries no text. Title text is sized in container units so that the longest word fits.

Inputs: `name`, `publisher`, `title-id`, `cover-url`, `thumbnail`.

---

## Title Grid - `<title-grid>`

A grid of Game Tiles. It has **no filter or sort controls**; the parent owns those.

| Input        | Type             | Default |
| ------------ | ---------------- | ------- |
| `titles`     | `LibraryTitle[]` | `[]`    |
| `filters`    | `TitleFilters`   | `{}`    |
| `sort`       | `TitleSort`      | `name`  |
| `length`     | number           | all     |
| `single-row` | boolean          | `false` |

**Filters.** All combine with AND.

- `status`: `all` / `on-drive` (includes partly on drive) / `not-on-drive` / `queued`
- `gameType`: `GOD` / `Other` (Other is every title that isn't Games on Demand)
- `hasTitleUpdate`, `hasDlc`, `hasOtherContent`: simple on/off. Other content is anything that isn't a game, DLC, a save or a title update, such as videos, themes or avatar items. (There's no `hasSaves` in this version: saves live in profile partitions, which Loadout doesn't manage.)

**Sorts.** Ties fall back to alphabetical.

| Value                      | Order                                          |
| -------------------------- | ---------------------------------------------- |
| `name`                     | Alphabetical (default)                         |
| `size-desc` / `size-asc`   | Size: largest / smallest first                 |
| `added-desc` / `added-asc` | Date added to the vault: newest / oldest first |

Release-date sorts are **removed for now**, and will be re-added once there's a release-date data source.

**Empty state:** "No titles found" plus a sentence built from the filters (`describeEmpty()`), for example _"There are no queued Games on Demand titles with DLC and title updates."_

**Single-row mode:** one horizontally scrolling row.

---

## Discover Section - `<discover-section>`

A heading, a **See all ›** link on the right, and a single-row Title Grid with preset filters and sort. There are no filter controls.

| Input         | Type             | Default                                               |
| ------------- | ---------------- | ----------------------------------------------------- |
| `heading`     | string           |                                                       |
| `titles`      | `LibraryTitle[]` |                                                       |
| `filters`     | `TitleFilters`   | `{}`                                                  |
| `sort`        | `TitleSort`      | `name`                                                |
| `length`      | number           | 20                                                    |
| `see-all-url` | string           | Overrides the target. The queue section uses `/queue` |

**Slot `action`:** an optional control beside "See all". The Discover page's queue section puts **Apply N changes** here.

**See all**

- Links to the Library with the same filters and sort as query parameters (`libraryUrl()`), for example `/library?status=queued&type=god&dlc=1&sort=added-desc`. `parseLibraryUrl()` reverses it.
- Fires `see-all` with `{ url }`. It bubbles, composes and is cancelable.
- Hidden when the section is empty. The grid then shows its empty message.

The Publishers sections from the first draft are dropped.

---

## Side Nav - `<side-nav>` _(added; desktop only)_

- The logo and "Loadout".
- The pages: Discover, Library, Queue (with the queued-titles badge), Drive, Settings.
- At the bottom, **vault and drive status indicators**. They replaced the old path cards, because the browser can't give full paths:
  - Each shows a name, plus "READ ONLY" for the vault, and its state: **Connected** (green), **Disconnected** (amber pulse, "Plug the drive back in.") or **Error** (red, plus a message).
  - Hovering shows an **×** that opens the reset dialog ("De-select this vault/drive"). It's the same as the Settings action, and warns that the queue will be cleared.

Inputs: `items: NavItem[]`, `current`, `vault: FolderHealth | null`, `drive: FolderHealth | null`.

**Events**

- `navigate`, with `{ id }`
- `deselect`, with `{ which }`

## Tab Bar - `<tab-bar>` _(added; mobile only)_

The same five pages with the queue badge. It doesn't show vault or drive status, which the user accepted.

**Events**

- `navigate`, with `{ id }`

## Welcome Modal - `<welcome-modal>` _(added)_

A near-full-page modal that can't be dismissed.

- **`welcome` mode:**
  - The brand, a headline, and a short intro.
  - Two **Folder Pickers**, Vault and Drive, each with a hint.
  - "Loadout never writes to the vault."
  - **Continue**, enabled only when both pickers are valid.
- **`reconnect` mode**, after a reload:
  - "Welcome back", plus how many changes are saved in the queue.
  - Both directory names.
  - **Reconnect**, which takes one click to re-grant both folders.
  - "Start over with different folders".

**Events**

- `select-folder`, with `{ role, handle }`
- `continue`
- `reconnect`
- `start-over`

## Folder Picker - `<folder-picker>` _(added)_

One card per folder.

- **Header:** an icon, the name, and a "Read only" or "Read and write" tag.
- **Hint.**
- **Selection box:** "Directory name <name>" and the validation result (checking spinner, valid ✓ or invalid ! with the reason).
- **Choose folder…** button.

The button calls `showDirectoryPicker` with the folder's mode. If the user picks the folder already chosen for the other side (`isSameEntry`), the picker shows that as invalid itself and doesn't fire `pick`. Cancelling the dialog does nothing.

**Events**

- `pick`, with `{ handle }`. This is the parent's to translate.
- `refuse`, when the folder picked is the other side's: the parent clears this side.

Inputs: `kind` (`vault` or `drive`), `selection` (the store's view of this side), `other` (the other side's handle, for the same-folder check).

## Library Filters - `<library-filters>` _(added)_

Chips for status, type and the three "has" flags, a Clear filters link, and a sort select. Together they expose every Title Grid option.

**Events**

- `filters-change`, with `{ filters, sort }`

## Confirm Dialog - `<confirm-dialog>` _(added)_

A native `<dialog>` modal.

- `tone="danger"` adds a prominent red warning panel (slot `warning`) and a red confirm button.
- It's used for the reset dialog and the irreversible-removal warning.
- Escape and clicking the backdrop both count as cancel.

**Events**

- `confirm`
- `cancel`

## Notice Banner - `<notice-banner>` _(added)_

An inline banner with tones `ok`, `warn`, `bad` and `info`, an optional `busy` spinner, and a slot `actions`. It's used for corrupt packages, the "N changes queued" notice and apply errors.

## Toast Stack - `<toast-stack>` _(added)_

Short notices, bottom-right, that expire after about 4 seconds. On phones they sit above the tab bar.

## Apply Summary - `<apply-summary>` _(added; feature §7a)_

The "All changes applied" modal shown when an apply completes.

- Stats, then changes grouped by title.
- **Keep a record:**
  - **Download JSON**
  - **Save to drive…**, with a one-off permission
  - a preview of the JSON
- **Done** closes it.

**Events**

- `close`
- `download`
- `save-to-drive`

## Pages _(added)_

`discover-page`, `library-page`, `queue-page`, `drive-page`, `settings-page` and `manage-page` are composed from the components above. See `features.md`.

---

## Event conventions

These were learned from a bug: picking a vault folder also set the drive.

- **Events for the direct parent don't bubble or compose**: `new CustomEvent(name, { detail })`. The parent listens on the element itself. Nearly every event is this kind.
- **Only app-level intents cross shadow roots** (`bubbles: true, composed: true`): `tile-open` and `see-all`. A page or the app shell handles them, several shadow roots up.
- **Never re-dispatch an event under the same name.** A parent that translates a child's event stops the child's event (`e.stopPropagation()`) and fires its own, differently named event. For example, `folder-picker`'s `pick` becomes `welcome-modal`'s `select-folder`.
- **Don't reuse native event names** (`change`, `input`, `select`…) for custom events. For example, `library-filters` fires `filters-change`.
- **Always assign new objects or arrays** to reactive properties (never mutate in place). Lit compares by identity, so mutating in place left a picker stuck on "Checking folder…".

## Shared modules

- `src/lib/`: the domain types and every function with behaviour worth testing. Each module and its numbered behaviour statements are in `lib-design.md`.
- `src/app/store.ts`: the store, the app's single state object. `src/app/store-controller.ts` re-renders a Lit host when it changes.
- `styles/tokens.css`: Seerr-style single dark theme tokens. `styles/shared.ts` holds base, button, pill and spinner CSS. `styles/icons.ts` holds the inline SVG icons.
