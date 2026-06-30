import { LitElement, html, css, nothing, type TemplateResult } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js'
import type { ContentTypeName, TitleXContent, Partition } from 'xcontent-web'
import { copyTitleDirectory, CONTENT_TYPE_HEX, type CopyTitleDirEvent, type CopyContentDirEvent } from 'xcontent-web'

type LogKind = 'title' | 'ct-dir' | 'file' | 'error'
type LogEntry = { message: string; pending: boolean; kind: LogKind }
type Status = 'running' | 'done' | 'cancelled' | 'error'

const CHUNK = 20 * 1024 * 1024

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

const HEX_TO_CONTENT_TYPE_NAME = new Map<string, ContentTypeName>()
for (const [name, hex] of CONTENT_TYPE_HEX) HEX_TO_CONTENT_TYPE_NAME.set(hex, name)

function ctDirLabel(directoryName: string): string {
  const typeName = HEX_TO_CONTENT_TYPE_NAME.get(directoryName.toLowerCase())
  if (!typeName) return directoryName
  return `${CONTENT_TYPE_LABELS[typeName] ?? typeName} [${directoryName}]`
}

function renderMessage(message: string): Array<string | TemplateResult> {
  const parts = message.split(/(\[[^\]]+\])/g)
  if (parts.length === 1) return [message]
  return parts.map(part =>
    part.startsWith('[') && part.endsWith(']')
      ? html`<span class="id-tag">${part}</span>`
      : part,
  )
}

@customElement('copy-titles-modal')
export class CopyTitlesModal extends LitElement {
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

    .log p { margin: 0; overflow-wrap: break-word; }
    .log .pending { color: var(--sl-color-neutral-400); }

    .log p.ct-dir { padding-left: 2ch; }

    /* hanging indent: first line at 4ch, continuation at 16ch */
    .log p.file { padding-left: 16ch; text-indent: -12ch; overflow-wrap: anywhere; }

    .log p.error { padding-left: 2ch; color: var(--sl-color-danger-600); }

    .log .id-tag { font-size: 0.85em; color: var(--sl-color-neutral-500); }

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
  @state() private status: Status = 'running'

  @query('dialog') private dialog!: HTMLDialogElement
  @query('.log') private logEl!: HTMLElement

  private titles: TitleXContent[] = []
  private partitionTuples: [Partition, FileSystemDirectoryHandle][] = []
  private targetHandle: FileSystemDirectoryHandle | null = null
  private allowedContentTypeNames: ReadonlySet<ContentTypeName> = new Set()
  private abortController: AbortController | null = null
  private currentCopyFileName: string | null = null

  open(
    titles: TitleXContent[],
    partitionTuples: [Partition, FileSystemDirectoryHandle][],
    targetHandle: FileSystemDirectoryHandle,
    allowedContentTypeNames: ReadonlySet<ContentTypeName>,
  ): void {
    this.titles = titles
    this.partitionTuples = partitionTuples
    this.targetHandle = targetHandle
    this.allowedContentTypeNames = allowedContentTypeNames
    this.log = []
    this.progress = { completed: 0, total: titles.length }
    this.status = 'running'
    this.currentCopyFileName = null
    this.dialog.showModal()
    void this.startCopy()
  }

  protected updated() {
    if (this.logEl) this.logEl.scrollTop = this.logEl.scrollHeight
  }

  private appendLog(message: string, kind: LogKind, pending = false): void {
    this.log = [...this.log, { message, kind, pending }]
  }

  private appendToLast(suffix: string, pending: boolean): void {
    if (this.log.length === 0) return
    const last = this.log.at(-1)!
    this.log = [...this.log.slice(0, -1), { ...last, message: last.message + suffix, pending }]
  }

  private handleEvent(event: CopyTitleDirEvent | CopyContentDirEvent): void {
    switch (event.type) {
      case 'title-dir-directory-start':
        this.currentCopyFileName = null
        this.appendLog(ctDirLabel(event.directoryName), 'ct-dir')
        break
      case 'content-dir-file-progress':
        if (event.fileName !== this.currentCopyFileName) {
          this.currentCopyFileName = event.fileName
          this.appendLog(`${event.fileName}.`, 'file', true)
        } else {
          this.appendToLast('.', true)
        }
        break
      case 'content-dir-file-done':
        if (this.currentCopyFileName === event.fileName) {
          this.appendToLast('..done', false)
          this.currentCopyFileName = null
        } else {
          // 0-byte file: no progress events fired
          this.appendLog(`${event.fileName}..done`, 'file', false)
        }
        break
      case 'title-dir-no-op':
        this.appendLog('(nothing to do)', 'ct-dir')
        break
      case 'title-dir-err-spec-violation-contains-files':
        this.appendLog('Error: title directory contains files', 'error')
        break
      case 'content-dir-err-spec-violation-contains-directories':
        this.appendLog('Error: unexpected subdirectory in content type directory', 'error')
        break
      case 'content-dir-err-file-size-mismatch':
        this.appendLog(`Error: ${event.fileName} – size mismatch (expected ${event.expectedBytes} B, got ${event.actualBytes} B)`, 'error')
        break
    }
  }

  private async startCopy(): Promise<void> {
    if (!this.targetHandle) return
    this.abortController = new AbortController()
    const { signal } = this.abortController
    const total = this.titles.length
    let completed = 0

    try {
      for (const title of this.titles) {
        this.appendLog(`Copying ${title.displayName} [${title.titleIdHex}]`, 'title')
        for (const [partition, partitionHandle] of this.partitionTuples) {
          let sourceTitleDir: FileSystemDirectoryHandle
          try {
            sourceTitleDir = await partitionHandle.getDirectoryHandle(title.titleIdHex)
          } catch {
            continue
          }
          const targetPartitionDir = await this.targetHandle.getDirectoryHandle(partition.directoryName, { create: true })
          const targetTitleDir = await targetPartitionDir.getDirectoryHandle(title.titleIdHex, { create: true })
          await copyTitleDirectory(
            sourceTitleDir,
            targetTitleDir,
            CHUNK,
            (event) => this.handleEvent(event),
            signal,
            this.allowedContentTypeNames,
          )
        }
        completed++
        this.progress = { completed, total }
      }
      this.status = 'done'
    } catch (err) {
      if (signal.aborted) {
        this.status = 'cancelled'
      } else {
        this.appendLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
        this.status = 'error'
      }
    }
  }

  private cancel() {
    this.abortController?.abort()
  }

  private closeModal() {
    this.dialog.close()
  }

  render() {
    const pct = this.progress
      ? Math.round((this.progress.completed / this.progress.total) * 100)
      : 0

    return html`
      <dialog @cancel=${(e: Event) => {
        e.preventDefault()
        if (this.status !== 'running') this.closeModal()
      }}>
        <div class="modal-header">Copy Titles</div>
        <div class="log">
          ${this.log.length === 0
            ? html`<p class="pending">Starting…</p>`
            : this.log.map(e => html`<p class="${e.kind}${e.pending ? ' pending' : ''}">${renderMessage(e.message)}</p>`)
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
            ? html`<p class="status-cancelled">Copy cancelled.</p>`
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
      </dialog>
    `
  }
}
