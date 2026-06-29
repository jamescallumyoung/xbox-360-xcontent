import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { PartitionScanResult, TitleXContent } from 'xcontent-web'
import './title-row.js'

type FilterVal = 'required' | 'excluded'

const FLAGS = [
  { key: 'gameIsPresent',    label: 'Game'    },
  { key: 'hasTitleUpdate',   label: 'TU'      },
  { key: 'hasDlc',           label: 'DLC'     },
  { key: 'hasSaves',         label: 'Saves'   },
  { key: 'hasOtherContent',  label: 'Other'   },
  { key: 'hasCorruptContent',label: 'Corrupt' },
  { key: 'hasInternalError', label: 'Error'   },
] as const satisfies { key: keyof TitleXContent; label: string }[]

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
      border-bottom: 1px solid var(--app-surface-border);
    }

    .header-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .count {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .filters {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
    }

    .filter-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.1875rem 0.5rem;
      border-radius: 999px;
      font-size: 0.6875rem;
      font-weight: 500;
      letter-spacing: 0.03em;
      cursor: pointer;
      user-select: none;
      border: 1px solid transparent;
      transition: background 0.1s, color 0.1s;
      background: var(--sl-color-neutral-100);
      color: var(--sl-color-neutral-500);
      border-color: var(--sl-color-neutral-200);
    }

    .filter-chip:hover {
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-700);
    }

    .filter-chip.required {
      background: var(--sl-color-primary-100);
      color: var(--sl-color-primary-700);
      border-color: var(--sl-color-primary-300);
    }

    .filter-chip.excluded {
      background: var(--sl-color-danger-100);
      color: var(--sl-color-danger-700);
      border-color: var(--sl-color-danger-300);
    }

    .empty {
      padding: 1.5rem 1.25rem;
      font-size: 0.875rem;
      color: var(--sl-color-neutral-500);
    }
  `

  @property({ attribute: false }) library!: PartitionScanResult
  @state() private selectedIds = new Set<string>()
  @state() private filters = new Map<string, FilterVal>()

  willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('library')) {
      this.selectedIds = new Set()
      this.filters = new Map()
      this.dispatchEvent(new CustomEvent<TitleXContent[]>('selection-changed', {
        detail: [],
        bubbles: true,
        composed: true,
      }))
    }
  }

  private get visibleTitles(): TitleXContent[] {
    return this.library.titles.filter(t =>
      FLAGS.every(({ key }) => {
        const state = this.filters.get(key)
        if (!state) return true
        return state === 'required' ? t[key] : !t[key]
      })
    )
  }

  private cycleFilter(key: string) {
    const current = this.filters.get(key)
    const next = new Map(this.filters)
    if (!current) next.set(key, 'required')
    else if (current === 'required') next.set(key, 'excluded')
    else next.delete(key)
    this.filters = next
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
    const visible = this.visibleTitles
    const filtered = visible.length !== titles.length

    const countLabel = filtered
      ? `${visible.length} of ${titles.length} title${titles.length === 1 ? '' : 's'}`
      : `${titles.length} title${titles.length === 1 ? '' : 's'} found`

    return html`
      <div class="header">
        <div class="header-row">
          <span class="count">${countLabel}</span>
          <div class="filters">
            ${FLAGS.map(({ key, label }) => {
              const state = this.filters.get(key)
              const prefix = state === 'required' ? '✓ ' : state === 'excluded' ? '✕ ' : ''
              return html`
                <span
                  class="filter-chip ${state ?? ''}"
                  @click=${() => this.cycleFilter(key)}
                >${prefix}${label}</span>
              `
            })}
          </div>
        </div>
      </div>

      ${visible.length === 0
        ? html`<div class="empty">${filtered ? 'No titles match the current filters.' : 'No titles were found in the selected partitions.'}</div>`
        : html`
          <div @title-toggle=${this.handleTitleToggle}>
            ${visible.map(t => html`
              <title-row .item=${t} .selected=${this.selectedIds.has(t.titleIdHex)}></title-row>
            `)}
          </div>
        `
      }
    `
  }
}
