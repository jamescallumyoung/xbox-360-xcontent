import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { base } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { applyFilters, describeEmpty, sortTitles } from '../lib/titles.js';
import type { LibraryTitle, TitleFilters, TitleSort } from '../lib/types.js';
import './game-tile.js';

/**
 * Grid of Game Tiles. Filters and sort are inputs only: this component has no
 * controls for them; the wrapping page or component owns those.
 *
 * Its tiles' `tile-open` events bubble and compose through it.
 */
@customElement('title-grid')
export class TitleGrid extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .grid {
        display: grid;
        gap: 1.5rem 1rem;
        grid-template-columns: repeat(auto-fill, minmax(var(--tile-width, 9.5rem), 1fr));
      }
      .row {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: var(--tile-width, 9.5rem);
        gap: 1rem;
        overflow-x: auto;
        scroll-snap-type: x proximity;
        scrollbar-width: thin;
        /* room for the hover lift and focus ring */
        padding: 0.6rem 0.4rem 1rem;
        margin: -0.6rem -0.4rem -1rem;
      }
      .row > * {
        scroll-snap-align: start;
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
        text-align: center;
        padding: 2.25rem 1.5rem;
        border: 1px dashed var(--line);
        border-radius: 0.75rem;
        color: var(--muted);
        background: color-mix(in srgb, var(--panel) 50%, transparent);
      }
      .empty svg {
        width: 1.75rem;
        height: 1.75rem;
        color: var(--faint);
        margin-bottom: 0.25rem;
      }
      .empty b {
        color: var(--fg);
        font-weight: 600;
      }
      :host([single-row]) .empty {
        padding: 1.5rem;
      }
      @media (max-width: 760px) {
        .grid {
          grid-template-columns: repeat(auto-fill, minmax(var(--tile-width-sm, 7rem), 1fr));
          gap: 1.1rem 0.75rem;
        }
        .row {
          grid-auto-columns: var(--tile-width-sm, 7.5rem);
          gap: 0.75rem;
        }
      }
    `,
  ];

  /** Every title the grid may show, with drive status. */
  @property({ attribute: false }) accessor titles: LibraryTitle[] = [];
  @property({ attribute: false }) accessor filters: TitleFilters = {};
  @property() accessor sort: TitleSort = 'name';
  /** Show at most this many titles. Unset or 0 shows all. */
  @property({ type: Number }) accessor length = 0;
  /** One horizontally scrolling row instead of a wrapping grid. */
  @property({ type: Boolean, reflect: true, attribute: 'single-row' }) accessor singleRow = false;

  /** The titles currently shown, after filter, sort and length. */
  get visibleTitles(): LibraryTitle[] {
    const list = sortTitles(applyFilters(this.titles, this.filters), this.sort);
    return this.length > 0 ? list.slice(0, this.length) : list;
  }

  override render(): TemplateResult {
    const list = this.visibleTitles;
    if (list.length === 0) {
      return html`<div class="empty" role="status">
        ${icon('empty')}<b>No titles found</b><span>${describeEmpty(this.filters)}</span>
      </div>`;
    }
    return html`<div class=${this.singleRow ? 'row' : 'grid'} role="list">
      ${repeat(
        list,
        (x: LibraryTitle) => x.title.titleId,
        (x: LibraryTitle) => html`<game-tile role="listitem" .item=${x}></game-tile>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'title-grid': TitleGrid;
  }
}
