import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../styles/shared.js';
import { SORT_LABELS } from '../lib/titles.js';
import { TITLE_SORTS, type GameType, type StatusFilter, type TitleFilters, type TitleSort } from '../lib/types.js';

/**
 * Controls for every Title Grid filter and sort.
 * @fires filters-change - detail: { filters, sort }
 */
@customElement('library-filters')
export class LibraryFilters extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1.25rem;
        align-items: center;
      }
      .grp {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .lbl {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--faint);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .chip {
        padding: 0.35rem 0.8rem;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--fg-2);
        font-size: 0.8rem;
        font-weight: 500;
      }
      .chip:hover {
        border-color: var(--muted);
      }
      .chip[aria-pressed='true'] {
        background: var(--accent-soft);
        color: var(--accent-text);
        border-color: var(--accent);
      }
      .sep {
        width: 1px;
        height: 1.4rem;
        background: var(--line);
      }
      .sort {
        margin-left: auto;
      }
      select {
        background: var(--panel);
        border: 1px solid var(--line);
        color: var(--fg-2);
        border-radius: 0.45rem;
        padding: 0.4rem 0.6rem;
        font: inherit;
        font-size: 0.8rem;
      }
      .clear {
        font-size: 0.8rem;
        color: var(--muted);
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .clear:hover {
        color: var(--fg);
      }
      @media (max-width: 760px) {
        .sep {
          display: none;
        }
        .sort {
          margin-left: 0;
        }
      }
    `,
  ];

  @property({ attribute: false }) accessor filters: TitleFilters = {};
  @property() accessor sort: TitleSort = 'name';

  private emit(filters: TitleFilters, sort = this.sort): void {
    this.dispatchEvent(new CustomEvent('filters-change', { detail: { filters, sort } }));
  }

  private chip(label: string, on: boolean, next: TitleFilters) {
    return html`<button
      class="chip"
      aria-pressed=${on}
      @click=${() => {
        this.emit(next);
      }}
    >
      ${label}
    </button>`;
  }

  override render(): TemplateResult {
    const f = this.filters;
    const status = f.status ?? 'all';
    const st = (v: StatusFilter, l: string) => this.chip(l, status === v, { ...f, status: v });
    const ty = (v: GameType | undefined, l: string) => {
      const next: TitleFilters = { ...f };
      if (v === undefined) delete next.gameType;
      else next.gameType = v;
      return this.chip(l, f.gameType === v, next);
    };
    const flag = (k: 'hasTitleUpdate' | 'hasDlc' | 'hasOtherContent', l: string) => {
      const { [k]: on, ...rest } = f;
      return this.chip(l, on === true, on === true ? rest : { ...rest, [k]: true });
    };
    const active =
      status !== 'all' ||
      f.gameType !== undefined ||
      f.hasTitleUpdate === true ||
      f.hasDlc === true ||
      f.hasOtherContent === true;
    return html`<div class="wrap" role="toolbar" aria-label="Filter and sort titles">
      <div class="grp">
        <span class="lbl">Status</span>
        <div class="chips">
          ${st('all', 'All')}${st('on-drive', 'On drive')}${st('not-on-drive', 'Not on drive')}${st('queued', 'Queued')}
        </div>
      </div>
      <span class="sep"></span>
      <div class="grp">
        <span class="lbl">Type</span>
        <div class="chips">${ty(undefined, 'Any')}${ty('GOD', 'Games on Demand')}${ty('Other', 'Other')}</div>
      </div>
      <span class="sep"></span>
      <div class="grp">
        <span class="lbl">Has</span>
        <div class="chips">
          ${flag('hasTitleUpdate', 'Title updates')}${flag('hasDlc', 'DLC')}${flag('hasOtherContent', 'Other content')}
        </div>
      </div>
      ${
        active
          ? html`<button
              class="clear"
              @click=${() => {
                this.emit({});
              }}
            >
              Clear filters
            </button>`
          : nothing
      }
      <div class="grp sort">
        <label class="lbl" for="sort">Sort</label>
        <select
          id="sort"
          .value=${this.sort}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            this.emit(f, TITLE_SORTS.find((s) => s === value) ?? 'name');
          }}
        >
          ${TITLE_SORTS.map((v) => html`<option value=${v}>${SORT_LABELS[v]}</option>`)}
        </select>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'library-filters': LibraryFilters;
  }
}
