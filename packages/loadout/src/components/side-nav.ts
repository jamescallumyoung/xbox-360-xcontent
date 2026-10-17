import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../styles/shared.js';
import { icon, type IconName } from '../styles/icons.js';
import type { NavItem } from './nav-item.js';
import type { FolderHealth } from '../lib/types.js';

const STATE_LABEL = { connected: 'Connected', disconnected: 'Disconnected', error: 'Error' } as const;

/**
 * Desktop sidebar: logo, page links, and whether the vault and drive are usable right now.
 * (The browser never reveals a folder's full path, so the status is what's useful here.)
 * Hovering a status row reveals an x that asks to de-select that folder.
 *
 * @fires navigate - detail: { id }
 * @fires deselect - detail: { which: 'vault' | 'drive' }
 */
@customElement('side-nav')
export class SideNav extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        position: fixed;
        inset: 0 auto 0 0;
        width: 16rem;
        z-index: 30;
        display: flex;
        flex-direction: column;
        background: var(--panel);
        border-right: 1px solid var(--line);
        padding: calc(1.25rem + env(safe-area-inset-top, 0px)) 0.75rem calc(1rem + env(safe-area-inset-bottom, 0px));
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0 0.5rem 1.5rem;
      }
      .mark {
        width: 2.1rem;
        height: 2.1rem;
        border-radius: 0.6rem;
        background: linear-gradient(135deg, var(--accent), #7c3aed);
        display: grid;
        place-items: center;
        color: #fff;
      }
      .brand b {
        font-size: 1.35rem;
        font-weight: 800;
        color: var(--fg);
        letter-spacing: -0.02em;
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem 0.75rem;
        border-radius: 0.5rem;
        color: var(--fg-2);
        font-weight: 500;
        width: 100%;
        text-align: left;
        transition: background 0.15s;
      }
      .item:hover {
        background: var(--panel-2);
        color: var(--fg);
      }
      .item[aria-current='page'] {
        background: linear-gradient(90deg, var(--accent-strong), #6d28d9);
        color: #fff;
      }
      .count {
        margin-left: auto;
        border-radius: 999px;
        padding: 0 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--accent-soft);
        color: var(--accent-text);
        font-variant-numeric: tabular-nums;
      }
      .item[aria-current='page'] .count {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
      .foot {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .src {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 0.6rem;
        padding: 0.6rem 0.7rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        background: var(--bg);
      }
      .src.disconnected {
        border-color: rgba(234, 179, 8, 0.4);
      }
      .src.error {
        border-color: rgba(239, 68, 68, 0.45);
      }
      .top {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding-right: 1.6rem;
      }
      .top > svg {
        width: 1.05rem;
        height: 1.05rem;
        color: var(--muted);
      }
      .nm {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .name {
        color: var(--fg);
        font-weight: 600;
        font-size: 0.85rem;
      }
      .ro {
        font-size: 0.66rem;
        color: var(--faint);
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .state {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.72rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 999px;
        background: currentColor;
      }
      .connected .state {
        color: var(--ok-text);
      }
      .disconnected .state {
        color: var(--warn-text);
      }
      .disconnected .dot {
        animation: pulse 1.6s ease-in-out infinite;
      }
      .error .state {
        color: var(--bad-text);
      }
      .msg {
        font-size: 0.72rem;
        line-height: 1.4;
        color: var(--muted);
      }
      .error .msg {
        color: var(--bad-text);
      }
      @keyframes pulse {
        50% {
          opacity: 0.3;
        }
      }
      .x {
        position: absolute;
        top: 0.35rem;
        right: 0.35rem;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 0.4rem;
        display: grid;
        place-items: center;
        color: var(--muted);
        opacity: 0;
        transition:
          opacity 0.15s,
          background 0.15s;
      }
      .x svg {
        width: 0.95rem;
        height: 0.95rem;
      }
      .src:hover .x,
      .x:focus-visible {
        opacity: 1;
      }
      .x:hover {
        background: var(--bad-soft);
        color: var(--bad-text);
      }
      @media (hover: none) {
        .x {
          opacity: 1;
        }
      }
    `,
  ];

  @property({ attribute: false }) accessor items: NavItem[] = [];
  @property() accessor current = '';
  /** `null` hides the row (nothing selected yet). */
  @property({ attribute: false }) accessor vault: FolderHealth | null = null;
  @property({ attribute: false }) accessor drive: FolderHealth | null = null;
  /** While applying, the vault and drive can't be de-selected. */
  @property({ type: Boolean }) accessor applying = false;

  private fire(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private src(which: 'vault' | 'drive', label: string, ic: IconName, h: FolderHealth | null) {
    if (h === null) return nothing;
    const stateLabel = STATE_LABEL[h.state];
    return html`<div class="src ${h.state}" role="status" aria-label="${label}: ${stateLabel}">
      <div class="top">
        ${icon(ic)}<span class="nm"
          ><span class="name">${label}</span
          >${which === 'vault' ? html`<span class="ro">Read only</span>` : nothing}</span
        >
        <span class="state"><span class="dot"></span>${stateLabel}</span>
      </div>
      ${h.state === 'connected' ? nothing : html`<span class="msg">${h.message}</span>`}
      <button
        class="x"
        ?disabled=${this.applying}
        aria-label="De-select this ${which}"
        title="De-select this ${which}"
        @click=${() => {
          this.fire('deselect', { which });
        }}
      >
        ${icon('x')}
      </button>
    </div>`;
  }

  override render(): TemplateResult {
    return html` <div class="brand">
        <div class="mark" aria-hidden="true">${icon('logo')}</div>
        <b>Loadout</b>
      </div>
      <nav aria-label="Pages">
        ${this.items.map(
          (i) =>
            html` <button
              class="item"
              aria-current=${i.id === this.current ? 'page' : 'false'}
              @click=${() => {
                this.fire('navigate', { id: i.id });
              }}
            >
              ${icon(i.icon)}${i.label}${i.badge ? html`<span class="count">${i.badge}</span>` : nothing}
            </button>`,
        )}
      </nav>
      <div class="foot">
        ${this.src('vault', 'Vault', 'vault', this.vault)} ${this.src('drive', 'Drive', 'drive', this.drive)}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'side-nav': SideNav;
  }
}
