import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { base, spinner } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { searchTitles } from '../lib/titles.js';
import type { AppStatus, ApplyProgress, Title } from '../lib/types.js';
import { thumbnailUrl } from './thumbnail.js';

/**
 * Sticky top bar: search with an inline results dropdown, plus one status indicator.
 * The indicator shows the store's one status: error > vault disconnected >
 * drive disconnected > copying > ready to copy > OK.
 *
 * @fires search     - on every keystroke. detail: { query }
 * @fires open-title - a search result was chosen. detail: { titleId }
 */
@customElement('app-header')
export class AppHeader extends LitElement {
  static override styles = [
    base,
    spinner,
    css`
      :host {
        display: block;
        position: sticky;
        top: env(safe-area-inset-top, 0px);
        z-index: 20;
        background: rgba(17, 24, 39, 0.82);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--line-soft);
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.85rem 2rem;
      }
      .search {
        position: relative;
        flex: 1;
        min-width: 0;
      }
      label {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0.5rem 1rem;
        color: var(--muted);
      }
      label:focus-within {
        border-color: var(--accent);
      }
      input {
        flex: 1;
        min-width: 0;
        background: none;
        border: 0;
        outline: none;
        color: var(--fg);
        font: inherit;
      }
      input::placeholder {
        color: var(--faint);
      }
      input::-webkit-search-cancel-button {
        filter: invert(0.7);
      }
      .results {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 0.4rem);
        z-index: 30;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 0.8rem;
        overflow: hidden;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
        max-height: min(28rem, 70vh);
        overflow-y: auto;
      }
      .result {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        width: 100%;
        padding: 0.55rem 0.8rem;
        text-align: left;
        border-bottom: 1px solid var(--line-soft);
      }
      .result:last-child {
        border-bottom: 0;
      }
      .result[aria-selected='true'],
      .result:hover {
        background: var(--panel-2);
      }
      .result img,
      .result .ph {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.35rem;
        flex: none;
        background: var(--panel-2);
      }
      .result .t {
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .result .n {
        color: var(--fg);
        font-weight: 600;
        font-size: 0.875rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .result .m {
        color: var(--muted);
        font-size: 0.75rem;
      }
      .result .m .mono {
        color: var(--faint);
      }
      .none {
        padding: 0.9rem 1rem;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        white-space: nowrap;
        padding: 0.45rem 0.85rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 600;
        border: 1px solid;
      }
      .status svg {
        width: 1rem;
        height: 1rem;
      }
      .error {
        background: var(--bad-soft);
        color: var(--bad-text);
        border-color: rgba(239, 68, 68, 0.45);
      }
      .no-vault,
      .no-drive {
        background: var(--warn-soft);
        color: var(--warn-text);
        border-color: rgba(234, 179, 8, 0.4);
      }
      .copying,
      .ready {
        background: var(--accent-soft);
        color: var(--accent-text);
        border-color: rgba(99, 102, 241, 0.5);
      }
      .ready .n {
        min-width: 1.2rem;
        height: 1.2rem;
        padding: 0 0.3rem;
        border-radius: 999px;
        background: var(--accent);
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 0.7rem;
      }
      .ok {
        background: var(--ok-soft);
        color: var(--ok-text);
        border-color: rgba(34, 197, 94, 0.4);
      }
      .pulse {
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 999px;
        background: currentColor;
        animation: pulse 1.6s ease-in-out infinite;
      }
      @keyframes pulse {
        50% {
          opacity: 0.3;
        }
      }
      @media (max-width: 760px) {
        .bar {
          padding: 0.7rem 1rem;
          gap: 0.6rem;
        }
        .status .long {
          display: none;
        }
      }
    `,
  ];

  @property() accessor query = '';
  /** Titles to search: vault titles only. */
  @property({ attribute: false }) accessor titles: Title[] = [];
  @property() accessor status: AppStatus = 'ok';
  @property({ type: Number, attribute: 'error-count' }) accessor errorCount = 0;
  /** The apply's progress, while copying. */
  @property({ attribute: false }) accessor progress: ApplyProgress | null = null;
  /** Queued changes. */
  @property({ type: Number, attribute: 'queued-count' }) accessor queuedCount = 0;
  @state() private accessor open = false;
  @state() private accessor active = 0;

  private get results(): Title[] {
    return searchTitles(this.titles, this.query);
  }

  private onInput(e: InputEvent): void {
    this.query = (e.target as HTMLInputElement).value;
    this.open = true;
    this.active = 0;
    this.dispatchEvent(new CustomEvent('search', { detail: { query: this.query } }));
  }

  private choose(t: Title): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('open-title', { detail: { titleId: t.titleId } }));
  }

  private onKey(e: KeyboardEvent): void {
    const list = this.results;
    if (e.key === 'Escape') {
      this.open = false;
      return;
    }
    if (list.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.open = true;
      this.active = (this.active + 1) % list.length;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active = (this.active - 1 + list.length) % list.length;
    }
    const chosen = list[this.active];
    if (e.key === 'Enter' && chosen !== undefined) {
      e.preventDefault();
      this.choose(chosen);
    }
  }

  private renderResults() {
    if (!this.open || this.query.trim() === '') return nothing;
    const list = this.results;
    return html`<div class="results" role="listbox" id="search-results" aria-label="Search results">
      ${
        list.length > 0
          ? list.map((t, i) => {
              const thumb = thumbnailUrl(t.thumbnail);
              return html` <button
                class="result"
                role="option"
                aria-selected=${i === this.active}
                @mousedown=${(e: Event) => {
                  e.preventDefault();
                }}
                @click=${() => {
                  this.choose(t);
                }}
              >
                ${thumb === undefined ? html`<span class="ph"></span>` : html`<img src=${thumb} alt="" />`}
                <span class="t"
                  ><span class="n">${t.name}</span
                  ><span class="m"
                    >${t.publisher ?? 'Unknown publisher'} &middot; <span class="mono">${t.titleId}</span></span
                  ></span
                >
              </button>`;
            })
          : html`<div class="none">No titles in the vault match &ldquo;${this.query.trim()}&rdquo;.</div>`
      }
    </div>`;
  }

  private renderStatus() {
    switch (this.status) {
      case 'error': {
        const n = this.errorCount;
        return html`<span class="status error">${icon('alert')}${n} error${n === 1 ? '' : 's'}</span>`;
      }
      case 'no-vault':
        return html`<span class="status no-vault"
          ><span class="pulse"></span><span>Vault<span class="long"> disconnected</span></span></span
        >`;
      case 'no-drive':
        return html`<span class="status no-drive"
          ><span class="pulse"></span><span>Drive<span class="long"> disconnected</span></span></span
        >`;
      case 'copying': {
        const p = this.progress;
        const done = p === null ? 0 : Math.round(p.fraction * 100);
        const of = p === null ? nothing : html`<span class="long"> ${p.index + 1} of ${p.total}</span>`;
        return html`<span class="status copying"
          ><span class="spin"></span><span class="num">Copying${of} &middot; ${done}%</span></span
        >`;
      }
      case 'ready':
        return html`<span class="status ready"
          ><span class="n num">${this.queuedCount}</span><span>Queued<span class="long"> changes</span></span></span
        >`;
      case 'ok':
        return html`<span class="status ok">${icon('check')}Up to date</span>`;
    }
  }

  override render(): TemplateResult {
    return html`<div class="bar">
      <div class="search">
        <label>
          ${icon('search')}
          <input
            type="search"
            placeholder="Search the vault by name or title ID"
            autocomplete="off"
            aria-label="Search titles"
            aria-controls="search-results"
            aria-expanded=${this.open && this.query.trim() !== ''}
            .value=${this.query}
            @input=${(e: InputEvent) => {
              this.onInput(e);
            }}
            @keydown=${(e: KeyboardEvent) => {
              this.onKey(e);
            }}
            @focus=${() => {
              this.open = true;
            }}
            @blur=${() => {
              this.open = false;
            }}
          />
        </label>
        ${this.renderResults()}
      </div>
      <div role="status" aria-live="polite">${this.renderStatus()}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-header': AppHeader;
  }
}
