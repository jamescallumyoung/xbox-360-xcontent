import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import type { NavItem } from './nav-item.js';

/**
 * Mobile bottom tab bar with the same pages as the sidebar.
 * @fires navigate - detail: { id }
 */
@customElement('tab-bar')
export class TabBar extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 40;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        background: rgba(31, 41, 55, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-top: 1px solid var(--line);
        padding: 0.35rem 0.25rem calc(0.35rem + env(safe-area-inset-bottom, 0px));
      }
      button {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;
        font-size: 0.65rem;
        font-weight: 600;
        color: var(--muted);
        padding: 0.3rem 0;
      }
      button[aria-current='page'] {
        color: var(--accent-text);
      }
      .b {
        position: absolute;
        top: -0.05rem;
        left: calc(50% + 0.3rem);
        min-width: 1.1rem;
        height: 1.1rem;
        padding: 0 0.3rem;
        border-radius: 999px;
        background: var(--accent);
        color: #fff;
        font-size: 0.65rem;
        display: grid;
        place-items: center;
      }
    `,
  ];

  @property({ attribute: false }) accessor items: NavItem[] = [];
  @property() accessor current = '';

  override render(): TemplateResult[] {
    return this.items.map(
      (i) =>
        html`<button
          aria-current=${i.id === this.current ? 'page' : 'false'}
          @click=${() => this.dispatchEvent(new CustomEvent('navigate', { detail: { id: i.id } }))}
        >
          ${icon(i.icon)}${i.label}${i.badge ? html`<span class="b">${i.badge}</span>` : nothing}
        </button>`,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tab-bar': TabBar;
  }
}
