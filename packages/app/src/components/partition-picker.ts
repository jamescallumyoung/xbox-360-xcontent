import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import '@shoelace-style/shoelace/dist/components/badge/badge.js'
import type { Partition } from 'xcontent-web'

@customElement('partition-picker')
export class PartitionPicker extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin-top: 1.25rem;
      padding: 1rem 1.25rem;
      background: var(--app-surface-bg);
      border: 1px solid var(--app-surface-border);
      border-radius: 8px;
      backdrop-filter: var(--app-blur);
      -webkit-backdrop-filter: var(--app-blur);
    }
    .partitions { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    .partition-row { display: flex; align-items: center; gap: 0.75rem; }
    code {
      font-size: 0.8em;
      color: var(--sl-color-neutral-700);
    }
  `

  @property({ attribute: false }) partitions: Partition[] = []
  @state() private selected = new Set<string>()

  connectedCallback() {
    super.connectedCallback()
    this.selected = new Set(this.partitions.map((p) => p.directoryName))
  }

  private toggle(dirName: string, checked: boolean) {
    const next = new Set(this.selected)
    checked ? next.add(dirName) : next.delete(dirName)
    this.selected = next
  }

  private confirm() {
    const chosen = this.partitions.filter((p) => this.selected.has(p.directoryName))
    this.dispatchEvent(new CustomEvent('partitions-confirmed', { detail: chosen, bubbles: true, composed: true }))
  }

  render() {
    return html`
      <div class="partitions">
        ${this.partitions.map((p) => html`
          <div class="partition-row">
            <sl-checkbox
              ?checked=${this.selected.has(p.directoryName)}
              @sl-change=${(e: CustomEvent) => this.toggle(p.directoryName, (e.target as HTMLInputElement).checked)}
            ></sl-checkbox>
            <sl-badge variant=${p.kind === 'public' ? 'primary' : 'neutral'}>
              ${p.kind === 'public' ? 'Public' : 'Profile'}
            </sl-badge>
            <code>${p.directoryName}</code>
          </div>
        `)}
      </div>
      <sl-button variant="primary" @click=${this.confirm}>
        Scan selected
      </sl-button>
    `
  }
}
