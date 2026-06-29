import { LitElement, html, css, nothing } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js'
import type { MergeSource, FixupEntry, VerifyMode } from 'xcontent-web'
import { mergeSources, verifySources, repairFiles } from 'xcontent-web'

type LogEntry = { message: string; pending: boolean }
type VerifyResult = { verified: number; mismatches: number }
type RepairResult = { repaired: number; failed: number }

type Status =
  | 'idle'
  | 'merging'
  | 'merge-done'
  | 'verifying'
  | 'repairing'
  | 'merge-cancelled'
  | 'merge-error'

@customElement('merge-modal')
export class MergeModal extends LitElement {
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

    .status-messages {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .status-done { color: var(--sl-color-success-600); font-size: 0.875rem; font-weight: 500; margin: 0; }
    .status-cancelled { color: var(--sl-color-warning-600); font-size: 0.875rem; margin: 0; }
    .status-error { color: var(--sl-color-danger-600); font-size: 0.875rem; margin: 0; }

    .footer-actions { display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap; }
  `

  @state() private log: LogEntry[] = []
  @state() private progress: { completed: number; total: number } | null = null
  @state() private status: Status = 'idle'
  @state() private activeVerify: VerifyMode | null = null
  @state() private fastResult: VerifyResult | null = null
  @state() private slowResult: VerifyResult | null = null
  @state() private fixupList: FixupEntry[] = []
  @state() private repairResult: RepairResult | null = null

  @query('dialog') private dialog!: HTMLDialogElement
  @query('.log') private logEl!: HTMLElement

  private abortController: AbortController | null = null
  private sources: MergeSource[] = []
  private storedTargetHandle: FileSystemDirectoryHandle | null = null

  async open(sources: MergeSource[], targetHandle: FileSystemDirectoryHandle): Promise<void> {
    this.sources = sources
    this.storedTargetHandle = targetHandle
    this.log = []
    this.progress = null
    this.fastResult = null
    this.slowResult = null
    this.fixupList = []
    this.repairResult = null
    this.activeVerify = null
    this.status = 'merging'
    this.dialog.showModal()
    this.abortController = new AbortController()
    try {
      await mergeSources(sources, targetHandle, (event) => {
        if (event.type === 'log') {
          this.appendLog(event.message, event.replace)
        } else if (event.type === 'progress') {
          this.progress = { completed: event.completed, total: event.total }
        } else if (event.type === 'done') {
          this.status = 'merge-done'
        } else if (event.type === 'cancelled') {
          this.status = 'merge-cancelled'
        }
      }, this.abortController.signal)
    } catch (err) {
      this.appendLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      this.status = 'merge-error'
    }
  }

  protected updated() {
    if (this.logEl) this.logEl.scrollTop = this.logEl.scrollHeight
  }

  private appendLog(message: string, replace = false) {
    if (replace && this.log.length > 0) {
      this.log = [...this.log.slice(0, -1), { message, pending: false }]
    } else {
      this.log = [...this.log, { message, pending: true }]
    }
  }

  private cancel() {
    this.abortController?.abort()
  }

  private verifyFast() { void this.runVerify('fast') }
  private verifySlow() { void this.runVerify('slow') }

  private async runVerify(mode: VerifyMode) {
    if (!this.storedTargetHandle) return
    this.activeVerify = mode
    this.progress = null
    this.repairResult = null
    this.status = 'verifying'
    const label = mode === 'fast' ? 'fast verification' : 'slow verification'
    this.appendLog(`── ${label} ──`)
    this.abortController = new AbortController()
    try {
      await verifySources(this.sources, this.storedTargetHandle, (event) => {
        if (event.type === 'log') {
          this.appendLog(event.message, event.replace)
        } else if (event.type === 'progress') {
          this.progress = { completed: event.completed, total: event.total }
        } else if (event.type === 'done') {
          const result = { verified: event.verified, mismatches: event.mismatches }
          if (mode === 'fast') this.fastResult = result
          else this.slowResult = result
          this.fixupList = event.fixupList
          this.status = 'merge-done'
          this.activeVerify = null
        } else if (event.type === 'cancelled') {
          this.appendLog(`  ${label} cancelled.`)
          this.status = 'merge-done'
          this.activeVerify = null
        }
      }, this.abortController.signal, mode)
    } catch (err) {
      this.appendLog(`Error during ${label}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      this.status = 'merge-done'
      this.activeVerify = null
    }
  }

  private async repair() {
    if (!this.fixupList.length) return
    this.status = 'repairing'
    this.progress = null
    this.repairResult = null
    this.appendLog('── repair ──')
    this.abortController = new AbortController()
    try {
      await repairFiles(this.fixupList, (event) => {
        if (event.type === 'log') {
          this.appendLog(event.message, event.replace)
        } else if (event.type === 'progress') {
          this.progress = { completed: event.completed, total: event.total }
        } else if (event.type === 'done') {
          this.repairResult = { repaired: event.repaired, failed: event.failed }
          this.fixupList = []
          this.status = 'merge-done'
        } else if (event.type === 'cancelled') {
          this.appendLog('  repair cancelled.')
          this.fixupList = []
          this.status = 'merge-done'
        }
      }, this.abortController.signal)
    } catch (err) {
      this.appendLog(`Error during repair: ${err instanceof Error ? err.message : 'Unknown error'}`)
      this.fixupList = []
      this.status = 'merge-done'
    }
  }

  private closeModal() {
    this.dialog.close()
    this.status = 'idle'
  }

  private renderVerifyResult(label: string, result: VerifyResult) {
    const total = result.verified + result.mismatches
    return result.mismatches === 0
      ? html`<p class="status-done">${label} passed — all ${result.verified} file${result.verified === 1 ? '' : 's'} match.</p>`
      : html`<p class="status-error">${label} failed — ${result.mismatches} mismatch${result.mismatches === 1 ? '' : 'es'} out of ${total} files checked.</p>`
  }

  render() {
    const pct = this.progress
      ? Math.round((this.progress.completed / this.progress.total) * 100)
      : 0

    const busy = this.status === 'merging' || this.status === 'verifying' || this.status === 'repairing'
    const showPostMergeActions = this.status === 'merge-done'

    return html`
      <dialog @cancel=${(e: Event) => {
        e.preventDefault()
        if (!busy) this.closeModal()
      }}>
        <div class="modal-header">Merge Sources</div>

        <div class="log">
          ${this.log.length === 0 && this.status === 'merging'
            ? html`<p class="pending">Starting…</p>`
            : this.log.map(e => html`<p class=${e.pending ? 'pending' : ''}>${e.message}</p>`)
          }
        </div>

        <div class="modal-footer">
          ${this.progress !== null ? html`
            <sl-progress-bar value=${pct}>${pct}%</sl-progress-bar>
          ` : nothing}

          <div class="status-messages">
            ${this.status === 'merge-done' || this.status === 'verifying' || this.status === 'repairing'
              ? html`<p class="status-done">Merge complete.</p>`
              : nothing}
            ${this.fastResult !== null ? this.renderVerifyResult('Fast verify', this.fastResult) : nothing}
            ${this.slowResult !== null ? this.renderVerifyResult('Slow verify', this.slowResult) : nothing}
            ${this.repairResult !== null
              ? this.repairResult.failed === 0
                ? html`<p class="status-done">Repair complete — ${this.repairResult.repaired} file${this.repairResult.repaired === 1 ? '' : 's'} repaired.</p>`
                : html`<p class="status-error">Repair incomplete — ${this.repairResult.failed} file${this.repairResult.failed === 1 ? '' : 's'} could not be repaired. Run verification to check remaining issues.</p>`
              : nothing}
            ${this.status === 'merge-cancelled'
              ? html`<p class="status-cancelled">Merge cancelled. Any incomplete content has been removed from the target.</p>`
              : nothing}
            ${this.status === 'merge-error'
              ? html`<p class="status-error">An unexpected error occurred. The merge may be incomplete.</p>`
              : nothing}
          </div>

          <div class="footer-actions">
            ${busy
              ? html`<sl-button @click=${this.cancel}>Cancel</sl-button>`
              : nothing}
            ${showPostMergeActions ? html`
              <sl-button @click=${this.verifyFast}>Fast Verify</sl-button>
              <sl-button @click=${this.verifySlow}>Slow Verify</sl-button>
              ${this.fixupList.length > 0 ? html`
                <sl-button variant="warning" @click=${this.repair}>
                  Repair (${this.fixupList.length})
                </sl-button>
              ` : nothing}
            ` : nothing}
            ${!busy
              ? html`<sl-button variant="primary" @click=${this.closeModal}>Close</sl-button>`
              : nothing}
          </div>
        </div>
      </dialog>
    `
  }
}
