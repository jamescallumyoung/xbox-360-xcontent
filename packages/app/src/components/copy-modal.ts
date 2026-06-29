import { LitElement, html, css, nothing } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js'
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js'
import type { ContentTypeName, TitleXContent, Partition } from 'xcontent-web'
import { copyTitles } from 'xcontent-web'

type LogEntry = { message: string; pending: boolean }
type Status = 'configuring' | 'running' | 'done' | 'cancelled' | 'error'

const CONTENT_TYPE_LABELS: Partial<Record<ContentTypeName, string>> = {
  Xbox360Title:      'Game (Disc)',
  InstalledGame:     'Installed Game',
  XboxOriginalGame:  'Original Xbox Game',
  GameOnDemand:      'Game on Demand',
  ArcadeGame:        'Arcade Game',
  XNA:               'XNA',
  CommunityGame:     'Community Game',
  Installer:         'Title Update',
  MarketPlaceContent:'DLC / Marketplace',
  SavedGame:         'Saved Game',
  Publisher:         'Publisher Content',
  Profile:           'Profile',
  GamerPicture:      'Gamer Picture',
  Theme:             'Theme',
  GamerTitle:        'Gamer Title',
  AvatarAssetPack:   'Avatar Asset Pack',
  AvatarItem:        'Avatar Item',
  CacheFile:         'Cache File',
  StorageDownload:   'Storage Download',
  XboxSavedGame:     'Original Xbox Saved Game',
  XboxDownload:      'Original Xbox Download',
  GameDemo:          'Game Demo',
  GameTrailer:       'Game Trailer',
  LicenseStore:      'License Store',
  Movie:             'Movie',
  Video:             'Video',
  MusicVideo:        'Music Video',
  GameVideo:         'Game Video',
  PodcastVideo:      'Podcast Video',
  ViralVideo:        'Viral Video',
  Unknown:           'Unknown',
}

function labelFor(name: ContentTypeName): string {
  return CONTENT_TYPE_LABELS[name] ?? name
}

@customElement('copy-modal')
export class CopyModal extends LitElement {
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

    .log {
      padding: 1rem 1.5rem;
      font-family: var(--sl-font-mono);
      font-size: 0.8125rem;
      line-height: 1.7;
      min-height: 160px;
      max-height: 40vh;
      overflow-y: auto;
      background: var(--sl-color-neutral-50);
      border-bottom: 1px solid var(--sl-color-neutral-100);
    }

    .log p { margin: 0; }
    .log .pending { color: var(--sl-color-neutral-400); }

    .modal-footer {
      padding: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }

    .status-done { color: var(--sl-color-success-600); font-size: 0.875rem; font-weight: 500; margin: 0; }
    .status-cancelled { color: var(--sl-color-warning-600); font-size: 0.875rem; margin: 0; }
    .status-error { color: var(--sl-color-danger-600); font-size: 0.875rem; margin: 0; }

    .footer-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `

  @state() private log: LogEntry[] = []
  @state() private progress: { completed: number; total: number } | null = null
  @state() private status: Status = 'configuring'
  @state() private availableTypes: ContentTypeName[] = []
  @state() private enabledTypes = new Set<ContentTypeName>()

  @query('dialog') private dialog!: HTMLDialogElement
  @query('.log') private logEl!: HTMLElement

  private titles: TitleXContent[] = []
  private partitionTuples: [Partition, FileSystemDirectoryHandle][] = []
  private targetHandle: FileSystemDirectoryHandle | null = null
  private abortController: AbortController | null = null

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

    this.log = []
    this.progress = null
    this.status = 'configuring'
    this.dialog.showModal()
  }

  protected updated() {
    if (this.logEl) this.logEl.scrollTop = this.logEl.scrollHeight
  }

  private toggleType(name: ContentTypeName, checked: boolean) {
    const next = new Set(this.enabledTypes)
    if (checked) next.add(name); else next.delete(name)
    this.enabledTypes = next
  }

  private async startCopy(): Promise<void> {
    if (!this.targetHandle) return
    this.log = []
    this.progress = null
    this.status = 'running'
    this.abortController = new AbortController()
    try {
      await copyTitles(
        this.titles,
        this.partitionTuples,
        this.targetHandle,
        (event) => {
          if (event.type === 'log') {
            if (event.replace && this.log.length > 0) {
              this.log = [...this.log.slice(0, -1), { message: event.message, pending: false }]
            } else {
              this.log = [...this.log, { message: event.message, pending: true }]
            }
          } else if (event.type === 'progress') {
            this.progress = { completed: event.completed, total: event.total }
          } else if (event.type === 'done') {
            this.status = 'done'
          } else if (event.type === 'cancelled') {
            this.status = 'cancelled'
          }
        },
        this.abortController.signal,
        new Set(this.enabledTypes) as ReadonlySet<ContentTypeName>,
      )
    } catch (err) {
      this.log = [...this.log, {
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        pending: false,
      }]
      this.status = 'error'
    }
  }

  private cancel() {
    this.abortController?.abort()
  }

  private closeModal() {
    this.dialog.close()
  }

  private renderConfiguring() {
    const n = this.titles.length
    const label = `Copy ${n} Title${n === 1 ? '' : 's'}`

    return html`
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
          <sl-button variant="primary" ?disabled=${this.enabledTypes.size === 0} @click=${this.startCopy}>${label}</sl-button>
        </div>
      </div>
    `
  }

  private renderRunning() {
    const pct = this.progress
      ? Math.round((this.progress.completed / this.progress.total) * 100)
      : 0

    return html`
      <div class="log">
        ${this.log.length === 0
          ? html`<p class="pending">Starting…</p>`
          : this.log.map(e => html`<p class=${e.pending ? 'pending' : ''}>${e.message}</p>`)
        }
      </div>
      <div class="modal-footer">
        ${this.progress !== null ? html`
          <sl-progress-bar value=${pct}>${pct}%</sl-progress-bar>
        ` : nothing}

        ${this.status === 'done'
          ? html`<p class="status-done">All titles copied successfully.</p>`
          : nothing}
        ${this.status === 'cancelled'
          ? html`<p class="status-cancelled">Copy cancelled. Any incomplete content has been removed from the target.</p>`
          : nothing}
        ${this.status === 'error'
          ? html`<p class="status-error">An unexpected error occurred. The copy may be incomplete.</p>`
          : nothing}

        <div class="footer-actions">
          ${this.status === 'running'
            ? html`<sl-button @click=${this.cancel}>Cancel</sl-button>`
            : html`<sl-button variant="primary" @click=${this.closeModal}>Close</sl-button>`
          }
        </div>
      </div>
    `
  }

  render() {
    return html`
      <dialog @cancel=${(e: Event) => {
        e.preventDefault()
        if (this.status === 'configuring' || this.status !== 'running') this.closeModal()
      }}>
        <div class="modal-header">Copy Titles</div>
        ${this.status === 'configuring' ? this.renderConfiguring() : this.renderRunning()}
      </dialog>
    `
  }
}
