import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { base, buttons, spinner } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import type { FolderSelection, Role } from '../app/store.js';

/**
 * Picks one folder (vault or drive) with the browser's folder dialog, and shows
 * the store's check of it. Picking the folder already chosen for the other side
 * is refused here, with `isSameEntry` (features.md, section 1).
 *
 * @fires pick - detail: { handle: FileSystemDirectoryHandle }
 * @fires refuse - the folder picked is the other side's; the parent clears this side
 */
@customElement('folder-picker')
export class FolderPicker extends LitElement {
  static override styles = [
    base,
    buttons,
    spinner,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .card {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        padding: 1.25rem;
        border-radius: 0.85rem;
        background: var(--bg);
        border: 1px solid var(--line);
      }
      :host([state='valid']) .card {
        border-color: rgba(34, 197, 94, 0.45);
      }
      :host([state='invalid']) .card {
        border-color: rgba(239, 68, 68, 0.45);
      }
      .top {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .ic {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.7rem;
        display: grid;
        place-items: center;
        background: var(--accent-soft);
        color: var(--accent-text);
        flex: none;
      }
      h3 {
        margin: 0;
        color: var(--fg);
        font-size: 1.05rem;
      }
      .tag {
        font-size: 0.7rem;
        color: var(--muted);
        display: flex;
        align-items: center;
        gap: 0.3rem;
      }
      .tag svg {
        width: 0.8rem;
        height: 0.8rem;
      }
      .hint {
        margin: 0;
        color: var(--muted);
        font-size: 0.85rem;
        line-height: 1.55;
      }
      .sel {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.7rem 0.8rem;
        border-radius: 0.55rem;
        background: var(--bg-deep);
        border: 1px solid var(--line);
      }
      .path {
        font-family: var(--font-mono);
        font-size: 0.78rem;
        color: var(--fg);
        overflow-wrap: anywhere;
      }
      .path .k {
        font-family: var(--font-ui);
        color: var(--muted);
        font-size: 0.75rem;
        margin-right: 0.25rem;
      }
      .res {
        display: flex;
        gap: 0.45rem;
        align-items: flex-start;
        font-size: 0.8rem;
        line-height: 1.45;
      }
      .res svg,
      .res .spin {
        width: 1rem;
        height: 1rem;
        margin-top: 0.1rem;
        flex: none;
      }
      .res.valid {
        color: var(--ok-text);
      }
      .res.invalid {
        color: var(--bad-text);
      }
      .res.checking {
        color: var(--muted);
      }
      .actions {
        margin-top: auto;
      }
    `,
  ];

  @property() accessor heading = '';
  @property() accessor hint = '';
  @property() accessor kind: Role = 'vault';
  @property({ attribute: false }) accessor selection: FolderSelection | null = null;
  /** The folder chosen for the other side, if any. */
  @property({ attribute: false }) accessor other: FileSystemDirectoryHandle | null = null;
  @property({ reflect: true }) accessor state: 'empty' | 'checking' | 'valid' | 'invalid' = 'empty';
  /** A folder refused here, because it's the other side's. */
  @state() private accessor sameAsOther: string | null = null;

  override willUpdate(): void {
    this.state = this.sameAsOther === null ? (this.selection?.status ?? 'empty') : 'invalid';
  }

  private async choose(): Promise<void> {
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await window.showDirectoryPicker({
        id: `loadout-${this.kind}`,
        mode: this.kind === 'vault' ? 'read' : 'readwrite',
      });
    } catch {
      return; // Cancelled, or refused by the browser: nothing changes.
    }
    if (this.other !== null && (await handle.isSameEntry(this.other))) {
      this.sameAsOther = handle.name;
      this.dispatchEvent(new CustomEvent('refuse'));
      return;
    }
    this.sameAsOther = null;
    this.dispatchEvent(new CustomEvent('pick', { detail: { handle } }));
  }

  private renderSelection() {
    if (this.sameAsOther !== null) {
      const other = this.kind === 'vault' ? 'drive' : 'vault';
      return html`<div class="sel">
        <span class="path"><span class="k">Directory name</span> ${this.sameAsOther}</span>
        <span class="res invalid"
          >${icon('alert')}This is the folder you chose as the ${other}. Choose a different one.</span
        >
      </div>`;
    }
    const s = this.selection;
    if (s === null) return nothing;
    return html`<div class="sel">
      <span class="path"><span class="k">Directory name</span> ${s.name}</span>
      <span class="res ${s.status}"
        >${
          s.status === 'checking' ? html`<span class="spin"></span>` : icon(s.status === 'valid' ? 'check' : 'alert')
        }${s.message}</span
      >
    </div>`;
  }

  override render(): TemplateResult {
    const chosen = this.selection !== null || this.sameAsOther !== null;
    return html`<div class="card">
      <div class="top">
        <div class="ic">${icon(this.kind === 'vault' ? 'vault' : 'drive')}</div>
        <div>
          <h3>${this.heading}</h3>
          <span class="tag"
            >${this.kind === 'vault' ? html`${icon('lock')}Read only` : html`${icon('folder')}Read and write`}</span
          >
        </div>
      </div>
      <p class="hint">${this.hint}</p>
      ${this.renderSelection()}
      <div class="actions">
        <button
          class="btn ${this.state === 'valid' ? '' : 'primary'}"
          ?disabled=${this.selection?.status === 'checking'}
          @click=${() => void this.choose()}
        >
          ${icon('folder')}${chosen ? 'Choose a different folder' : 'Choose folder...'}
        </button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'folder-picker': FolderPicker;
  }
}
