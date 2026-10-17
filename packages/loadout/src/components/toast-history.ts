import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { base, buttons } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import type { Toast } from '../app/store.js';

/**
 * Every notification shown in this tab, newest first, in a modal.
 * @fires history-close - Close, Escape or a click on the backdrop
 */
@customElement('toast-history')
export class ToastHistory extends LitElement {
  static override styles = [
    base,
    buttons,
    css`
      dialog {
        border: 1px solid var(--line);
        border-radius: 0.9rem;
        padding: 0;
        width: min(34rem, calc(100vw - 2rem));
        max-height: calc(100dvh - 2rem);
        background: var(--panel);
        color: var(--fg-2);
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
      }
      dialog[open] {
        display: flex;
        flex-direction: column;
      }
      dialog::backdrop {
        background: rgba(3, 7, 18, 0.72);
        backdrop-filter: blur(4px);
      }
      h2 {
        margin: 0;
        padding: 1.2rem 1.4rem;
        color: var(--fg);
        font-size: 1.1rem;
        border-bottom: 1px solid var(--line);
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        min-height: 0;
      }
      li {
        display: grid;
        grid-template-columns: 1rem minmax(0, 1fr) auto;
        gap: 0.7rem;
        padding: 0.7rem 1.4rem;
        border-bottom: 1px solid var(--line-soft);
        font-size: 0.85rem;
        line-height: 1.45;
      }
      li svg {
        width: 1rem;
        height: 1rem;
        margin-top: 0.15rem;
        color: var(--ok);
      }
      li.info svg {
        color: var(--accent-text);
      }
      li.bad svg {
        color: var(--bad-text);
      }
      time {
        color: var(--faint);
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .none {
        padding: 1.4rem;
        color: var(--muted);
        font-size: 0.85rem;
      }
      footer {
        display: flex;
        justify-content: flex-end;
        padding: 0.9rem 1.4rem;
        background: var(--bg-deep);
        border-top: 1px solid var(--line);
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) accessor open = false;
  @property({ attribute: false }) accessor items: Toast[] = [];
  @query('dialog') private accessor dialog!: HTMLDialogElement;

  override updated(): void {
    if (this.open && !this.dialog.open) this.dialog.showModal();
    if (!this.open && this.dialog.open) this.dialog.close();
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('history-close'));
  }

  override render(): TemplateResult {
    const items = [...this.items].reverse();
    return html`<dialog
      aria-labelledby="th-h"
      @cancel=${(e: Event) => {
        e.preventDefault();
        this.close();
      }}
      @click=${(e: MouseEvent) => {
        if (e.target === this.dialog) this.close();
      }}
    >
      <h2 id="th-h">Notifications</h2>
      ${
        items.length === 0
          ? html`<div class="none">No notifications yet.</div>`
          : html`<ol>
              ${items.map(
                (t) =>
                  html`<li class=${t.tone}>
                    ${icon(t.tone === 'ok' ? 'check' : t.tone === 'bad' ? 'alert' : 'info')}<span>${t.text}</span
                    ><time datetime=${new Date(t.at).toISOString()}>${new Date(t.at).toLocaleTimeString()}</time>
                  </li>`,
              )}
            </ol>`
      }
      <footer>
        <button
          class="btn primary"
          @click=${() => {
            this.close();
          }}
        >
          Close
        </button>
      </footer>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-history': ToastHistory;
  }
}
