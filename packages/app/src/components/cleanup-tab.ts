import { LitElement, html, css, nothing } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js'
import type { CleanupEvent } from 'xcontent-web'
import { cleanupContentRoot } from 'xcontent-web'

type Status = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

@customElement('cleanup-tab')
export class CleanupTab extends LitElement {
  static styles = css`
    :host { display: block; }

    .instructions {
      padding: 1rem 1.25rem;
      background: var(--app-surface-bg);
      border: 1px solid var(--app-surface-border);
      border-radius: 8px;
      backdrop-filter: var(--app-blur);
      -webkit-backdrop-filter: var(--app-blur);
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--sl-color-neutral-700);
      margin-bottom: 1.25rem;
    }
    .instructions p { margin: 0 0 0.5rem; }
    .instructions p:last-child { margin: 0; }

    code {
      background: rgba(139, 92, 246, 0.12);
      border: 1px solid rgba(139, 92, 246, 0.2);
      padding: 1px 5px;
      border-radius: 3px;
      color: var(--sl-color-primary-400);
      font-size: 0.8em;
    }

    .picker-row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
    }

    .dir-label {
      font-size: 0.8125rem;
      font-family: var(--sl-font-mono);
      color: var(--sl-color-neutral-500);
    }

    dialog {
      border: none;
      border-radius: 12px;
      padding: 0;
      width: 600px;
      max-width: min(600px, 90vw);
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
      display: flex;
      align-items: center;
      gap: 0.75rem;
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
    .log .empty { color: var(--sl-color-neutral-400); }

    .modal-footer {
      padding: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }

    .status-messages { display: flex; flex-direction: column; gap: 0.25rem; }

    .status-done { color: var(--sl-color-success-600); font-size: 0.875rem; font-weight: 500; margin: 0; }
    .status-none { color: var(--sl-color-neutral-500); font-size: 0.875rem; margin: 0; }
    .status-cancelled { color: var(--sl-color-warning-600); font-size: 0.875rem; margin: 0; }
    .status-error { color: var(--sl-color-danger-600); font-size: 0.875rem; margin: 0; }

    .footer-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `

  @state() private handle: FileSystemDirectoryHandle | null = null
  @state() private status: Status = 'idle'
  @state() private log: string[] = []
  @state() private result: { removedContentTypeDirs: number; removedTitleDirs: number } | null = null

  @query('dialog') private dialog!: HTMLDialogElement
  @query('.log') private logEl!: HTMLElement

  private abortController: AbortController | null = null

  private async pickRoot() {
    const picker = window as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
    try {
      this.handle = await picker.showDirectoryPicker()
    } catch {
      // cancelled
    }
  }

  private async runCleanup() {
    if (!this.handle) return
    this.log = []
    this.result = null
    this.status = 'running'
    this.dialog.showModal()
    this.abortController = new AbortController()
    this.log = ['Scanning…']
    try {
      await cleanupContentRoot(this.handle, (event: CleanupEvent) => {
        if (event.type === 'log') {
          this.log = [...this.log, event.message]
        } else if (event.type === 'done') {
          this.result = { removedContentTypeDirs: event.removedContentTypeDirs, removedTitleDirs: event.removedTitleDirs }
          this.status = 'done'
        } else if (event.type === 'cancelled') {
          this.status = 'cancelled'
        }
      }, this.abortController.signal)
    } catch (err) {
      this.log = [...this.log, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`]
      this.status = 'error'
    }
  }

  protected updated() {
    if (this.logEl) this.logEl.scrollTop = this.logEl.scrollHeight
  }

  private cancel() {
    this.abortController?.abort()
  }

  private closeModal() {
    this.dialog.close()
    this.status = 'idle'
  }

  private renderResult() {
    if (!this.result) return nothing
    const { removedContentTypeDirs, removedTitleDirs } = this.result
    if (removedContentTypeDirs === 0 && removedTitleDirs === 0) {
      return html`<p class="status-none">Nothing to clean up — no empty directories found.</p>`
    }
    const parts: string[] = []
    if (removedContentTypeDirs > 0) parts.push(`${removedContentTypeDirs} empty content type dir${removedContentTypeDirs === 1 ? '' : 's'}`)
    if (removedTitleDirs > 0) parts.push(`${removedTitleDirs} empty title dir${removedTitleDirs === 1 ? '' : 's'}`)
    return html`<p class="status-done">Done — removed ${parts.join(', ')}.</p>`
  }

  render() {
    const busy = this.status === 'running'

    return html`
      <div class="instructions">
        <p>Select a <code>Content/</code> root directory to scan for empty directories.</p>
        <p>Empty <strong>content type directories</strong> (with no files or subdirectories) will be removed. If that leaves a <strong>title directory</strong> completely empty, it will be removed too. Subdirectories inside content type directories are always preserved.</p>
      </div>

      <div class="picker-row">
        <sl-button @click=${this.pickRoot}>Select directory</sl-button>
        ${this.handle ? html`<span class="dir-label">${this.handle.name}</span>` : nothing}
      </div>

      ${this.handle ? html`
        <sl-button variant="primary" @click=${this.runCleanup}>Run Cleanup</sl-button>
      ` : nothing}

      <dialog @cancel=${(e: Event) => {
        e.preventDefault()
        if (!busy) this.closeModal()
      }}>
        <div class="modal-header">
          Cleanup
          ${busy ? html`<sl-spinner style="font-size:1rem"></sl-spinner>` : nothing}
        </div>

        <div class="log">
          ${this.log.length === 0
            ? html`<p class="empty">Starting…</p>`
            : this.log.map(m => html`<p>${m}</p>`)
          }
        </div>

        <div class="modal-footer">
          <div class="status-messages">
            ${this.renderResult()}
            ${this.status === 'cancelled' ? html`<p class="status-cancelled">Cleanup cancelled.</p>` : nothing}
            ${this.status === 'error' ? html`<p class="status-error">An unexpected error occurred.</p>` : nothing}
          </div>

          <div class="footer-actions">
            ${busy
              ? html`<sl-button @click=${this.cancel}>Cancel</sl-button>`
              : html`<sl-button variant="primary" @click=${this.closeModal}>Close</sl-button>`
            }
          </div>
        </div>
      </dialog>
    `
  }
}
