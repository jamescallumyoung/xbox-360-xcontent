import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base, spinner } from '../styles/shared.js';
import { icon, type IconName } from '../styles/icons.js';

/**
 * Inline banner for results and problems on a page.
 * @slot         - message
 * @slot actions - buttons on the right
 */
@customElement('notice-banner')
export class NoticeBanner extends LitElement {
  static override styles = [
    base,
    spinner,
    css`
      :host {
        display: block;
      }
      .b {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        flex-wrap: wrap;
        padding: 0.8rem 1rem;
        border-radius: 0.7rem;
        border: 1px solid;
        font-size: 0.875rem;
        line-height: 1.5;
      }
      .msg {
        flex: 1;
        min-width: 14rem;
        display: flex;
        gap: 0.7rem;
        align-items: flex-start;
      }
      .msg svg,
      .msg .spin {
        margin-top: 0.15rem;
      }
      .ok {
        background: var(--ok-soft);
        border-color: rgba(34, 197, 94, 0.4);
        color: var(--ok-text);
      }
      .warn {
        background: var(--warn-soft);
        border-color: rgba(234, 179, 8, 0.4);
        color: var(--warn-text);
      }
      .bad {
        background: var(--bad-soft);
        border-color: rgba(239, 68, 68, 0.45);
        color: var(--bad-text);
      }
      .info {
        background: var(--accent-soft);
        border-color: rgba(99, 102, 241, 0.45);
        color: var(--accent-text);
      }
      ::slotted(b),
      ::slotted(strong) {
        color: #fff;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
      }
    `,
  ];

  @property() accessor tone: 'ok' | 'warn' | 'bad' | 'info' = 'info';
  @property({ type: Boolean }) accessor busy = false;

  override render(): TemplateResult {
    const ic: IconName = this.tone === 'ok' ? 'check' : this.tone === 'info' ? 'info' : 'alert';
    return html`<div class="b ${this.tone}" role=${this.tone === 'bad' ? 'alert' : 'status'}>
      <div class="msg">
        ${this.busy ? html`<span class="spin"></span>` : icon(ic)}
        <div><slot></slot></div>
      </div>
      <div class="actions"><slot name="actions"></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-banner': NoticeBanner;
  }
}
