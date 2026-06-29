import { LitElement, html, css, nothing } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js'
import { discoverPartitions, scanPartitions, type Partition, type TitleXContent } from 'xcontent-web'
import type { MergeSource } from 'xcontent-web'
import { showToast } from '../utils/toast.js'
import './merge-modal.js'
import type { MergeModal } from './merge-modal.js'

type SourceEntry = {
  handle: FileSystemDirectoryHandle
  partitionTuples: [Partition, FileSystemDirectoryHandle][]
  titles: TitleXContent[] | null
}

@customElement('merge-tab')
export class MergeTab extends LitElement {
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
      align-items: flex-start;
      gap: 1.5rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }

    .picker-group {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .dir-label {
      font-size: 0.8125rem;
      font-family: var(--sl-font-mono);
      color: var(--sl-color-neutral-500);
    }

    .sources {
      background: var(--app-surface-bg);
      border: 1px solid var(--app-surface-border);
      border-radius: 8px;
      backdrop-filter: var(--app-blur);
      -webkit-backdrop-filter: var(--app-blur);
      overflow: hidden;
      margin-bottom: 1.25rem;
    }

    .sources-header {
      padding: 0.6rem 1.25rem;
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      border-bottom: 1px solid var(--app-surface-border);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .source-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 1.25rem;
      border-bottom: 1px solid rgba(139, 92, 246, 0.08);
      font-size: 0.875rem;
    }

    .source-row:last-child { border-bottom: none; }
    .source-row:hover { background: rgba(139, 92, 246, 0.04); }

    .source-name {
      flex: 1;
      font-family: var(--sl-font-mono);
      font-size: 0.8125rem;
      color: var(--sl-color-neutral-900);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .title-count {
      font-size: 0.8125rem;
      color: var(--sl-color-neutral-500);
      white-space: nowrap;
      flex-shrink: 0;
    }
  `

  @state() private targetHandle: FileSystemDirectoryHandle | null = null
  @state() private sources: SourceEntry[] = []

  @query('merge-modal') private modal!: MergeModal

  private get canMerge() {
    return this.targetHandle !== null
      && this.sources.length > 0
      && this.sources.every(s => s.titles !== null)
  }

  private async pickTarget() {
    const picker = window as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
    let handle: FileSystemDirectoryHandle
    try {
      handle = await picker.showDirectoryPicker()
    } catch {
      return
    }
    for (const src of this.sources) {
      if (await handle.isSameEntry(src.handle)) {
        showToast('Cannot use a source directory as the target.', 'danger')
        return
      }
    }
    this.targetHandle = handle
  }

  private async addSource() {
    const picker = window as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
    let handle: FileSystemDirectoryHandle
    try {
      handle = await picker.showDirectoryPicker()
    } catch {
      return
    }
    if (this.targetHandle && await handle.isSameEntry(this.targetHandle)) {
      showToast('Cannot use the target directory as a source.', 'danger')
      return
    }
    for (const src of this.sources) {
      if (await handle.isSameEntry(src.handle)) {
        showToast('This directory has already been added as a source.', 'warning')
        return
      }
    }

    const entry: SourceEntry = { handle, partitionTuples: [], titles: null }
    this.sources = [...this.sources, entry]

    try {
      const { partitions } = await discoverPartitions(handle)
      const { titles } = await scanPartitions(partitions)
      this.sources = this.sources.map(s =>
        s.handle === handle ? { handle, partitionTuples: partitions, titles } : s
      )
    } catch {
      this.sources = this.sources.filter(s => s.handle !== handle)
      showToast('Failed to scan the selected directory.', 'danger')
    }
  }

  private removeSource(handle: FileSystemDirectoryHandle) {
    this.sources = this.sources.filter(s => s.handle !== handle)
  }

  private openModal() {
    if (!this.canMerge || !this.targetHandle) return
    const mergeInputs: MergeSource[] = this.sources.map(s => ({
      name: s.handle.name,
      partitions: s.partitionTuples,
    }))
    void this.modal.open(mergeInputs, this.targetHandle)
  }

  render() {
    return html`
      <div class="instructions">
        <p>Select a <strong>target</strong> <code>Content/</code> directory — this is where content will be merged into.</p>
        <p>Then add one or more <strong>source</strong> <code>Content/</code> directories. For each title in each source, any content type directory not already present in the target will be copied over.</p>
      </div>

      <div class="picker-row">
        <div class="picker-group">
          <sl-button @click=${this.pickTarget}>Select target</sl-button>
          ${this.targetHandle ? html`<span class="dir-label">${this.targetHandle.name}</span>` : nothing}
        </div>
        <div class="picker-group">
          <sl-button @click=${this.addSource}>Add source</sl-button>
        </div>
      </div>

      ${this.sources.length > 0 ? html`
        <div class="sources">
          <div class="sources-header">${this.sources.length} source${this.sources.length === 1 ? '' : 's'}</div>
          ${this.sources.map(s => html`
            <div class="source-row">
              <span class="source-name">${s.handle.name}</span>
              ${s.titles === null
                ? html`<sl-spinner></sl-spinner>`
                : html`<span class="title-count">${s.titles.length} title${s.titles.length === 1 ? '' : 's'}</span>`
              }
              <sl-button size="small" @click=${() => this.removeSource(s.handle)}>Remove</sl-button>
            </div>
          `)}
        </div>

        <sl-button
          variant="primary"
          ?disabled=${!this.canMerge}
          @click=${this.openModal}
        >Merge</sl-button>
      ` : nothing}

      <merge-modal></merge-modal>
    `
  }
}
