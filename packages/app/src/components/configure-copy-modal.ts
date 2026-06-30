import { LitElement, html, css } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js'
import type { ContentTypeName, TitleXContent, Partition } from 'xcontent-web'

const CONTENT_TYPE_LABELS: Partial<Record<ContentTypeName, string>> = {
  Xbox360Title:       'Game (Disc)',
  InstalledGame:      'Installed Game',
  XboxOriginalGame:   'Original Xbox Game',
  GameOnDemand:       'Game on Demand',
  ArcadeGame:         'Arcade Game',
  XNA:                'XNA',
  CommunityGame:      'Community Game',
  Installer:          'Title Update',
  MarketPlaceContent: 'DLC / Marketplace',
  SavedGame:          'Saved Game',
  Publisher:          'Publisher Content',
  Profile:            'Profile',
  GamerPicture:       'Gamer Picture',
  Theme:              'Theme',
  GamerTitle:         'Gamer Title',
  AvatarAssetPack:    'Avatar Asset Pack',
  AvatarItem:         'Avatar Item',
  CacheFile:          'Cache File',
  StorageDownload:    'Storage Download',
  XboxSavedGame:      'Original Xbox Saved Game',
  XboxDownload:       'Original Xbox Download',
  GameDemo:           'Game Demo',
  GameTrailer:        'Game Trailer',
  LicenseStore:       'License Store',
  Movie:              'Movie',
  Video:              'Video',
  MusicVideo:         'Music Video',
  GameVideo:          'Game Video',
  PodcastVideo:       'Podcast Video',
  ViralVideo:         'Viral Video',
  Unknown:            'Unknown',
}

function labelFor(name: ContentTypeName): string {
  return CONTENT_TYPE_LABELS[name] ?? name
}

@customElement('configure-copy-modal')
export class ConfigureCopyModal extends LitElement {
  static styles = css`
    dialog {
      border: none;
      border-radius: 12px;
      padding: 0;
      width: 560px;
      max-width: min(560px, 90vw);
      background: var(--sl-color-neutral-0);
      box-shadow: var(--sl-shadow-x-large);
      color: var(--sl-color-neutral-900);
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--sl-color-neutral-100);
      font-size: 1rem;
      font-weight: 600;
    }

    .config-body {
      padding: 1rem 1.5rem;
    }

    .config-section-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--sl-color-neutral-500);
      margin: 0 0 0.625rem;
    }

    .type-list {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .type-list sl-checkbox {
      font-size: 0.875rem;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }

    .footer-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `

  @state() private availableTypes: ContentTypeName[] = []
  @state() private enabledTypes = new Set<ContentTypeName>()

  @query('dialog') private dialog!: HTMLDialogElement

  private titles: TitleXContent[] = []
  private partitionTuples: [Partition, FileSystemDirectoryHandle][] = []
  private targetHandle: FileSystemDirectoryHandle | null = null

  open(
    titles: TitleXContent[],
    partitionTuples: [Partition, FileSystemDirectoryHandle][],
    targetHandle: FileSystemDirectoryHandle,
  ): void {
    this.titles = titles
    this.partitionTuples = partitionTuples
    this.targetHandle = targetHandle

    const union = new Set<ContentTypeName>()
    for (const t of titles) for (const ct of t.contentTypes) union.add(ct)
    this.availableTypes = [...union].sort()
    this.enabledTypes = new Set(union)

    this.dialog.showModal()
  }

  private toggleType(name: ContentTypeName, checked: boolean) {
    const next = new Set(this.enabledTypes)
    if (checked) next.add(name); else next.delete(name)
    this.enabledTypes = next
  }

  private confirm(): void {
    if (!this.targetHandle || this.enabledTypes.size === 0) return
    const detail = {
      titles: this.titles,
      partitionTuples: this.partitionTuples,
      targetHandle: this.targetHandle,
      allowedContentTypeNames: new Set(this.enabledTypes) as ReadonlySet<ContentTypeName>,
    }
    this.dialog.close()
    this.dispatchEvent(new CustomEvent('copy-titles-started', { detail, bubbles: true, composed: true }))
  }

  private closeModal() {
    this.dialog.close()
  }

  render() {
    const n = this.titles.length
    const label = `Copy ${n} Title${n === 1 ? '' : 's'}`

    return html`
      <dialog @cancel=${(e: Event) => { e.preventDefault(); this.closeModal() }}>
        <div class="modal-header">Copy Titles</div>
        <div class="config-body">
          <p class="config-section-label">Content types to copy</p>
          <div class="type-list">
            ${this.availableTypes.map(name => html`
              <sl-checkbox
                ?checked=${this.enabledTypes.has(name)}
                @sl-change=${(e: CustomEvent) => this.toggleType(name, (e.target as HTMLInputElement).checked)}
              >${labelFor(name)}</sl-checkbox>
            `)}
          </div>
        </div>
        <div class="modal-footer">
          <div class="footer-actions">
            <sl-button @click=${this.closeModal}>Cancel</sl-button>
            <sl-button variant="primary" ?disabled=${this.enabledTypes.size === 0} @click=${this.confirm}>${label}</sl-button>
          </div>
        </div>
      </dialog>
    `
  }
}
