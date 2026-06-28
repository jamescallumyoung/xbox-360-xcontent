import { LitElement, html, css, nothing } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js'
import type { TitleXContent, Partition } from 'xcontent-web'
import { copyTitles } from 'xcontent-web'

type LogEntry = { message: string; pending: boolean }
type Status = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

@customElement('copy-modal')
export class CopyModal extends LitElement {
  static styles = css`
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

    .footer-actions { display: flex; justify-content: flex-end; }
  `

  @state() private log: LogEntry[] = []
  @state() private progress: { completed: number; total: number } | null = null
  @state() private status: Status = 'idle'

  @query('dialog') private dialog!: HTMLDialogElement
  @query('.log') private logEl!: HTMLElement

  private abortController: AbortController | null = null

  async open(
    titles: TitleXContent[],
    partitionTuples: [Partition, FileSystemDirectoryHandle][],
    targetHandle: FileSystemDirectoryHandle,
  ): Promise<void> {
    this.log = []
    this.progress = null
    this.status = 'running'
    this.dialog.showModal()
    this.abortController = new AbortController()
    try {
      await copyTitles(titles, partitionTuples, targetHandle, (event) => {
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
      }, this.abortController.signal)
    } catch (err) {
      this.log = [...this.log, {
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        pending: false,
      }]
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
          ${this.log.length === 0 && this.status === 'running'
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
      </dialog>
    `
  }
}
