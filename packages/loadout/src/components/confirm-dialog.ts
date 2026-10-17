import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { base, buttons } from '../styles/shared.js';
import { icon } from '../styles/icons.js';

/**
 * Modal confirmation. `tone="danger"` adds a prominent warning panel (slot "warning")
 * and a red confirm button, for irreversible actions.
 *
 * @slot          - body text
 * @slot warning  - the prominent warning (danger tone)
 * @fires confirm
 * @fires cancel  - Cancel, Escape or a click on the backdrop
 */
@customElement('confirm-dialog')
export class ConfirmDialog extends LitElement {
  static override styles = [
    base,
    buttons,
    css`
      dialog {
        border: 1px solid var(--line);
        border-radius: 0.9rem;
        padding: 0;
        width: min(30rem, calc(100vw - 2rem));
        background: var(--panel);
        color: var(--fg-2);
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
      }
      dialog::backdrop {
        background: rgba(3, 7, 18, 0.72);
        backdrop-filter: blur(4px);
      }
      .body {
        padding: 1.4rem 1.5rem 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      h2 {
        margin: 0;
        color: var(--fg);
        font-size: 1.15rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }
      h2 svg {
        color: var(--accent-text);
      }
      :host([tone='danger']) h2 svg {
        color: var(--bad-text);
      }
      .text {
        font-size: 0.9rem;
        line-height: 1.55;
      }
      .warn {
        display: flex;
        gap: 0.7rem;
        padding: 0.85rem 1rem;
        border-radius: 0.6rem;
        background: var(--bad-soft);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: var(--bad-text);
        font-size: 0.875rem;
        line-height: 1.5;
      }
      .warn svg {
        flex: none;
        margin-top: 0.1rem;
      }
      .warn b {
        color: #fff;
      }
      footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0.9rem 1.5rem;
        background: var(--bg-deep);
        border-top: 1px solid var(--line);
      }
      .btn.danger {
        background: #b91c1c;
        border-color: var(--bad);
        color: #fff;
      }
      .btn.danger:hover {
        background: var(--bad);
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) accessor open = false;
  @property() accessor heading = '';
  @property({ attribute: 'confirm-label' }) accessor confirmLabel = 'Confirm';
  @property({ attribute: 'cancel-label' }) accessor cancelLabel = 'Cancel';
  @property({ reflect: true }) accessor tone: 'default' | 'danger' = 'default';
  @query('dialog') private accessor dialog!: HTMLDialogElement;

  override updated(): void {
    if (this.open && !this.dialog.open) this.dialog.showModal();
    if (!this.open && this.dialog.open) this.dialog.close();
  }

  private fire(name: 'confirm' | 'cancel'): void {
    this.dispatchEvent(new CustomEvent(name));
  }

  override render(): TemplateResult {
    return html`<dialog
      aria-labelledby="h"
      @cancel=${(e: Event) => {
        e.preventDefault();
        this.fire('cancel');
      }}
      @click=${(e: MouseEvent) => {
        if (e.target === this.dialog) this.fire('cancel');
      }}
    >
      <div class="body">
        <h2 id="h">${icon(this.tone === 'danger' ? 'alert' : 'info')}${this.heading}</h2>
        <div class="text"><slot></slot></div>
        ${
          this.tone === 'danger'
            ? html`<div class="warn" role="alert">
                ${icon('alert')}
                <div><slot name="warning"></slot></div>
              </div>`
            : nothing
        }
      </div>
      <footer>
        <button
          class="btn"
          @click=${() => {
            this.fire('cancel');
          }}
        >
          ${this.cancelLabel}
        </button>
        <button
          class="btn ${this.tone === 'danger' ? 'danger' : 'primary'}"
          @click=${() => {
            this.fire('confirm');
          }}
        >
          ${this.confirmLabel}
        </button>
      </footer>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'confirm-dialog': ConfirmDialog;
  }
}
