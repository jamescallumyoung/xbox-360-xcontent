import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { base } from '../styles/shared.js';
import { icon } from '../styles/icons.js';

import type { Toast } from '../app/store.js';

/** Bottom-right stack of short notifications. The owner adds and expires items. */
@customElement('toast-stack')
export class ToastStack extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        position: fixed;
        right: 1.25rem;
        bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
        z-index: 70;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-end;
        pointer-events: none;
      }
      .t {
        display: flex;
        gap: 0.6rem;
        align-items: flex-start;
        max-width: 24rem;
        pointer-events: auto;
        background: var(--panel-2);
        border: 1px solid var(--line);
        border-left: 3px solid var(--ok);
        color: var(--fg);
        padding: 0.7rem 1rem;
        border-radius: 0.55rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        font-size: 0.85rem;
        line-height: 1.45;
        animation: tin 0.2s ease-out;
      }
      .t svg {
        width: 1rem;
        height: 1rem;
        flex: none;
        margin-top: 0.1rem;
        color: var(--ok);
      }
      .t.info {
        border-left-color: var(--accent);
      }
      .t.info svg {
        color: var(--accent-text);
      }
      .t.bad {
        border-left-color: var(--bad);
      }
      .t.bad svg {
        color: var(--bad-text);
      }
      @keyframes tin {
        from {
          transform: translateY(8px);
          opacity: 0.3;
        }
      }
      @media (max-width: 760px) {
        :host {
          left: 1rem;
          right: 1rem;
          bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
          align-items: stretch;
        }
        .t {
          max-width: none;
        }
      }
    `,
  ];

  @property({ attribute: false }) accessor items: Toast[] = [];

  override render(): TemplateResult {
    return html`<div aria-live="polite" style="display:contents">
      ${repeat(
        this.items,
        (t: Toast) => t.id,
        (t: Toast) =>
          html` <div class="t ${t.tone}">
            ${icon(t.tone === 'ok' ? 'check' : t.tone === 'bad' ? 'alert' : 'info')}<span>${t.text}</span>
          </div>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-stack': ToastStack;
  }
}
