import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/alert/alert.js'
import '@shoelace-style/shoelace/dist/components/icon/icon.js'
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js'
import { discoverPartitions, scanPartitions, type Partition, type PartitionScanResult } from 'xcontent-web'
import './partition-picker.js'
import './title-list.js'

function showToast(message: string, variant: 'primary' | 'warning' | 'danger' = 'warning') {
  const alert = Object.assign(document.createElement('sl-alert'), {
    variant,
    closable: true,
    duration: 10000,
  })
  alert.innerHTML = message
  document.body.appendChild(alert)
  // @ts-ignore — .toast() is present on sl-alert at runtime
  return alert.toast()
}

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = css`
    :host { display: block; padding: 2rem; max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 1.5rem; letter-spacing: 0.01em; }
    .instructions {
      margin-top: 1.25rem;
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
  `

  @state() private partitionTuples: [Partition, FileSystemDirectoryHandle][] = []
  @state() private library: PartitionScanResult | null = null
  @state() private scanning = false
  @state() private picking = false
  @state() private unsupported = !('showDirectoryPicker' in window)

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
      this.partitionTuples = partitions
      this.library = null

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

  private async onPartitionsConfirmed(e: CustomEvent<Partition[]>) {
    const selectedNames = new Set(e.detail.map(p => p.directoryName))
    const selectedTuples = this.partitionTuples.filter(([p]) => selectedNames.has(p.directoryName))
    this.scanning = true
    try {
      this.library = await scanPartitions(selectedTuples)
      console.log('[app] PartitionScanResult:', this.library)
    } finally {
      this.scanning = false
    }
  }

  render() {
    return html`
      <h1>Xbox 360 Content Utils</h1>

      ${this.unsupported
        ? html`<p>This browser does not support the File System Access API. Use Chrome or Edge.</p>`
        : html`<sl-button ?loading=${this.picking} @click=${this.pickContentRoot}>Select content root</sl-button>`
      }

      ${!this.library ? html`
        <div class="instructions">
          <p>Select your <code>Content/</code> directory — found on the root of your Xbox 360's hard drive or USB device.</p>
          <p>The app will scan the directory for partition folders (the <code>0000000000000000</code> public partition and any profile partitions) and let you choose which ones to include before scanning.</p>
          <p>Any subdirectories that are not recognised as valid Xbox 360 partition directories will be automatically ignored and you will be notified.</p>
        </div>
      ` : ''}

      ${this.partitions.length > 0 && !this.library ? html`
        <partition-picker
          .partitions=${this.partitions}
          @partitions-confirmed=${this.onPartitionsConfirmed}
        ></partition-picker>
      ` : ''}

      ${this.scanning ? html`
        <div class="scanning">
          <sl-spinner></sl-spinner>
          Scanning…
        </div>
      ` : ''}

      ${this.library ? html`
        <title-list .library=${this.library}></title-list>
      ` : ''}
    `
  }
}
