import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { PartitionScanResult, TitleXContent } from 'xcontent-web'
import './title-row.js'

@customElement('title-list')
export class TitleList extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin-top: 1.25rem;
      background: var(--app-surface-bg);
      border: 1px solid var(--app-surface-border);
      border-radius: 8px;
      backdrop-filter: var(--app-blur);
      -webkit-backdrop-filter: var(--app-blur);
      overflow: hidden;
    }
    .header {
      padding: 0.6rem 1.25rem;
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      border-bottom: 1px solid var(--app-surface-border);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .empty {
      padding: 1.5rem 1.25rem;
      font-size: 0.875rem;
      color: var(--sl-color-neutral-500);
    }
  `

  @property({ attribute: false }) library!: PartitionScanResult
  @state() private selectedIds = new Set<string>()

  willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('library')) {
      this.selectedIds = new Set()
      this.dispatchEvent(new CustomEvent<TitleXContent[]>('selection-changed', {
        detail: [],
        bubbles: true,
        composed: true,
      }))
    }
  }

  private handleTitleToggle(e: CustomEvent<string>) {
    e.stopPropagation()
    const next = new Set(this.selectedIds)
    if (next.has(e.detail)) next.delete(e.detail); else next.add(e.detail)
    this.selectedIds = next
    this.dispatchEvent(new CustomEvent<TitleXContent[]>('selection-changed', {
      detail: this.library.titles.filter(t => next.has(t.titleIdHex)),
      bubbles: true,
      composed: true,
    }))
  }

  render() {
    const { titles } = this.library
    return html`
      <div class="header">${titles.length} title${titles.length === 1 ? '' : 's'} found</div>
      ${titles.length === 0
        ? html`<div class="empty">No titles were found in the selected partitions.</div>`
        : html`
          <div @title-toggle=${this.handleTitleToggle}>
            ${titles.map(t => html`
              <title-row .item=${t} .selected=${this.selectedIds.has(t.titleIdHex)}></title-row>
            `)}
          </div>
        `
      }
    `
  }
}
