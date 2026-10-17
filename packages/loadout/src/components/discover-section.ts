import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { applyFilters, libraryUrl } from '../lib/titles.js';
import type { LibraryTitle, TitleFilters, TitleSort } from '../lib/types.js';
import './title-grid.js';

/**
 * A heading, a "See all" link, and a single-row Title Grid with pre-configured
 * filters and sort. No filter controls are shown.
 *
 * @slot action - optional control shown beside "See all" (e.g. the queue's Apply button).
 *
 * @fires see-all - before navigating. detail: { url }. Cancelable: the app shell
 *   cancels it and navigates itself.
 */
@customElement('discover-section')
export class DiscoverSection extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      h2 {
        margin: 0;
        color: var(--fg);
        font-size: 1.25rem;
        font-weight: 700;
        text-wrap: balance;
        flex: 1 0 auto;
        max-width: 100%;
      }
      .right {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      a {
        display: inline-flex;
        align-items: center;
        gap: 0.15rem;
        color: var(--muted);
        font-weight: 600;
        font-size: 0.85rem;
        text-decoration: none;
        white-space: nowrap;
        border-radius: 6px;
      }
      a:hover {
        color: var(--fg);
      }
      a svg {
        width: 1rem;
        height: 1rem;
      }
    `,
  ];

  @property() accessor heading = '';
  @property({ attribute: false }) accessor titles: LibraryTitle[] = [];
  @property({ attribute: false }) accessor filters: TitleFilters = {};
  @property() accessor sort: TitleSort = 'name';
  @property({ type: Number }) accessor length = 20;
  /** Overrides the "See all" target (default: the Library with these filters). */
  @property({ attribute: 'see-all-url' }) accessor seeAllOverride: string | undefined = undefined;

  get seeAllUrl(): string {
    return this.seeAllOverride ?? libraryUrl(this.filters, this.sort);
  }

  private onSeeAll(e: Event): void {
    const ev = new CustomEvent('see-all', {
      detail: { url: this.seeAllUrl },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (!this.dispatchEvent(ev)) e.preventDefault();
  }

  override render(): TemplateResult {
    const hasAny = applyFilters(this.titles, this.filters).length > 0;
    return html` <header>
        <h2>${this.heading}</h2>
        <div class="right">
          <slot name="action"></slot>
          ${
            hasAny
              ? html`<a
                  href=${this.seeAllUrl}
                  @click=${(e: Event) => {
                    this.onSeeAll(e);
                  }}
                  >See all${icon('chev')}</a
                >`
              : nothing
          }
        </div>
      </header>
      <title-grid
        single-row
        .titles=${this.titles}
        .filters=${this.filters}
        .sort=${this.sort}
        .length=${this.length}
      ></title-grid>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'discover-section': DiscoverSection;
  }
}
