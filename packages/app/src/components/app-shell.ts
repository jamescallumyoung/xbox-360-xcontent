import { LitElement, html, css, nothing } from 'lit'
import { customElement, state, query } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/alert/alert.js'
import '@shoelace-style/shoelace/dist/components/icon/icon.js'
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js'
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js'
import '@shoelace-style/shoelace/dist/components/tab/tab.js'
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js'
import { discoverPartitions, scanPartitions, type Partition, type PartitionScanResult, type TitleXContent } from 'xcontent-web'
import retailTitleIds from '../../../../data/retail-title-ids.json'
import { showToast } from '../utils/toast.js'
import './partition-picker.js'
import './title-list.js'
import './header-inspector.js'
import './configure-copy-modal.js'
import './copy-titles-modal.js'
import './merge-tab.js'
import './cleanup-tab.js'
import type { ConfigureCopyModal } from './configure-copy-modal.js'
import type { CopyTitlesModal } from './copy-titles-modal.js'

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 1.5rem; letter-spacing: 0.01em; }

    sl-tab-group {
      --track-color: var(--app-surface-border);
    }

    sl-tab-panel {
      padding-top: 1.25rem;
    }

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
    }
    .instructions p { margin: 0 0 0.5rem; }
    .instructions p:last-child { margin: 0; }

    .scanning {
      margin-top: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
      color: var(--sl-color-neutral-500);
    }

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

  `

  @state() private sourceHandle: FileSystemDirectoryHandle | null = null
  @state() private targetHandle: FileSystemDirectoryHandle | null = null
  @state() private partitionTuples: [Partition, FileSystemDirectoryHandle][] = []
  @state() private library: PartitionScanResult | null = null
  @state() private selectedTitles: TitleXContent[] = []
  @state() private scanning = false
  @state() private picking = false
  @state() private unsupported = !('showDirectoryPicker' in window)

  @query('configure-copy-modal') private configureCopyModal!: ConfigureCopyModal
  @query('copy-titles-modal') private copyTitlesModal!: CopyTitlesModal

  private get partitions(): Partition[] {
    return this.partitionTuples.map(([p]) => p)
  }

  private async pickContentRoot() {
    if (!('showDirectoryPicker' in window)) return
    const picker = window as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
    this.picking = true
    try {
      const handle = await picker.showDirectoryPicker()
      const { partitions, ignoredCount } = await discoverPartitions(handle)
      this.sourceHandle = handle
      this.partitionTuples = partitions
      this.library = null
      this.selectedTitles = []

      if (ignoredCount > 0 && partitions.length === 0) {
        showToast(
          `No valid partition directories were found. All ${ignoredCount} subdirector${ignoredCount === 1 ? 'y was' : 'ies were'} ignored. Make sure you selected the <code>Content/</code> root directory.`,
          'danger',
        )
      } else if (ignoredCount > 0) {
        showToast(
          `${ignoredCount} subdirector${ignoredCount === 1 ? 'y was' : 'ies were'} ignored — not valid Xbox 360 partition directories.`,
          'warning',
        )
      }
    } catch {
      // user cancelled or permission denied
    } finally {
      this.picking = false
    }
  }

  private async pickTargetRoot() {
    if (!('showDirectoryPicker' in window)) return
    const picker = window as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
    try {
      const handle = await picker.showDirectoryPicker()
      for await (const _ of handle.values()) {
        showToast('Target directory must be empty. Select an empty folder.', 'danger')
        return
      }
      this.targetHandle = handle
    } catch {
      // user cancelled or permission denied
    }
  }

  private async onPartitionsConfirmed(e: CustomEvent<Partition[]>) {
    const selectedNames = new Set(e.detail.map(p => p.directoryName))
    const selectedTuples = this.partitionTuples.filter(([p]) => selectedNames.has(p.directoryName))
    this.scanning = true
    this.selectedTitles = []
    try {
      this.library = await scanPartitions(selectedTuples, retailTitleIds.titles)
      console.log('[app] PartitionScanResult:', this.library)
    } finally {
      this.scanning = false
    }
  }

  private onSelectionChanged(e: CustomEvent<TitleXContent[]>) {
    this.selectedTitles = e.detail
  }

  private openCopyModal() {
    if (!this.targetHandle || this.selectedTitles.length === 0) return
    this.configureCopyModal.open(this.selectedTitles, this.partitionTuples, this.targetHandle)
  }

  private onCopyTitlesStarted(e: CustomEvent) {
    const { titles, partitionTuples, targetHandle, allowedContentTypeNames } = e.detail
    this.copyTitlesModal.open(titles, partitionTuples, targetHandle, allowedContentTypeNames)
  }

  private renderLibraryTab() {
    const copyCount = this.selectedTitles.length
    const copyLabel = copyCount === 0 ? 'Copy Titles' : `Copy ${copyCount} Title${copyCount === 1 ? '' : 's'}`

    return html`
      ${this.unsupported
        ? html`<p>This browser does not support the File System Access API. Use Chrome or Edge.</p>`
        : html`
          <div class="picker-row">
            <div class="picker-group">
              <sl-button ?loading=${this.picking} @click=${this.pickContentRoot}>Select source</sl-button>
              ${this.sourceHandle ? html`<span class="dir-label">${this.sourceHandle.name}</span>` : nothing}
            </div>
            <div class="picker-group">
              <sl-button @click=${this.pickTargetRoot}>Select target</sl-button>
              ${this.targetHandle ? html`<span class="dir-label">${this.targetHandle.name}</span>` : nothing}
            </div>
            ${this.library !== null ? html`
              <sl-button
                variant="primary"
                ?disabled=${copyCount === 0 || this.targetHandle === null}
                @click=${this.openCopyModal}
              >${copyLabel}</sl-button>
            ` : nothing}
          </div>
        `
      }

      ${!this.library ? html`
        <div class="instructions" style="margin-top:1.25rem">
          <p>Select your <code>Content/</code> directory as the <strong>source</strong> — found on the root of your Xbox 360's hard drive or USB device.</p>
          <p>Select an empty directory as the <strong>target</strong> — titles you choose will be copied there, preserving the full partition structure.</p>
          <p>After scanning, toggle titles to add them to the copy queue, then click <strong>Copy Titles</strong>.</p>
        </div>
      ` : ''}

      ${this.partitions.length > 0 && !this.library ? html`
        <partition-picker
          .partitions=${this.partitions}
          @partitions-confirmed=${this.onPartitionsConfirmed}
          style="display:block;margin-top:1.25rem"
        ></partition-picker>
      ` : ''}

      ${this.scanning ? html`
        <div class="scanning">
          <sl-spinner></sl-spinner>
          Scanning…
        </div>
      ` : ''}

      ${this.library ? html`
        <title-list
          .library=${this.library}
          @selection-changed=${this.onSelectionChanged}
          style="display:block"
        ></title-list>
      ` : ''}
    `
  }

  render() {
    return html`
      <h1>Xbox 360 Content Utils</h1>
      <sl-tab-group>
        <sl-tab slot="nav" panel="library">Library</sl-tab>
        <sl-tab slot="nav" panel="merge">Merge</sl-tab>
        <sl-tab slot="nav" panel="cleanup">Cleanup</sl-tab>
        <sl-tab slot="nav" panel="inspect">Inspect File</sl-tab>

        <sl-tab-panel name="library">${this.renderLibraryTab()}</sl-tab-panel>
        <sl-tab-panel name="merge"><merge-tab></merge-tab></sl-tab-panel>
        <sl-tab-panel name="cleanup"><cleanup-tab></cleanup-tab></sl-tab-panel>
        <sl-tab-panel name="inspect"><header-inspector></header-inspector></sl-tab-panel>
      </sl-tab-group>

      <configure-copy-modal @copy-titles-started=${this.onCopyTitlesStarted}></configure-copy-modal>
      <copy-titles-modal></copy-titles-modal>
    `
  }
}
