import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base, buttons, spinner } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import type { FolderSelection, Role } from '../app/store.js';
import './folder-picker.js';

/**
 * Near-full-page modal shown until a vault and drive are chosen. It can't be dismissed.
 * `mode="reconnect"` is shown after a reload: one click asks the browser for
 * permission again, for both folders.
 *
 * @fires select-folder - detail: { role, handle }
 * @fires clear-folder - detail: { role }
 * @fires continue
 * @fires reconnect - after permission was asked for both folders
 * @fires start-over
 */
@customElement('welcome-modal')
export class WelcomeModal extends LitElement {
  static override styles = [
    base,
    buttons,
    spinner,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: grid;
        place-items: center;
        overflow-y: auto;
        padding: calc(1.25rem + env(safe-area-inset-top, 0px)) 1rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
        background: rgba(3, 7, 18, 0.78);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .modal {
        width: min(62rem, 100%);
        min-height: min(40rem, 100%);
        display: flex;
        flex-direction: column;
        border: 1px solid var(--line);
        border-radius: 1.1rem;
        overflow: hidden;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.65);
        background:
          radial-gradient(ellipse 60% 50% at 0% 0%, rgba(99, 102, 241, 0.28), transparent 70%),
          radial-gradient(ellipse 50% 40% at 100% 0%, rgba(139, 92, 246, 0.18), transparent 70%), var(--panel);
      }
      .head {
        padding: 2.2rem 2.4rem 1.4rem;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.7rem;
      }
      .mark {
        width: 2.6rem;
        height: 2.6rem;
        border-radius: 0.75rem;
        background: linear-gradient(135deg, var(--accent), #7c3aed);
        display: grid;
        place-items: center;
        color: #fff;
      }
      .brand b {
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--fg);
        letter-spacing: -0.02em;
      }
      h1 {
        margin: 0;
        color: var(--fg);
        font-size: 1.9rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        text-wrap: balance;
      }
      .lead {
        margin: 0;
        color: var(--fg-2);
        max-width: 62ch;
        line-height: 1.6;
      }
      .pickers {
        padding: 0.6rem 2.4rem 1.6rem;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 1rem;
        align-items: stretch;
        flex: 1;
      }
      .arrow {
        align-self: center;
        color: var(--faint);
        display: grid;
        place-items: center;
      }
      .arrow svg {
        width: 1.6rem;
        height: 1.6rem;
      }
      footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 1.1rem 2.4rem;
        background: var(--bg-deep);
        border-top: 1px solid var(--line);
      }
      .note {
        color: var(--muted);
        font-size: 0.82rem;
        display: flex;
        gap: 0.45rem;
        align-items: center;
      }
      .note svg {
        width: 1rem;
        height: 1rem;
      }
      .btn.lg {
        padding: 0.7rem 1.4rem;
        font-size: 0.95rem;
      }
      .paths {
        display: grid;
        gap: 0.75rem;
        padding: 0 2.4rem 1.6rem;
        flex: 1;
        align-content: start;
      }
      .p {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 0.9rem 1rem;
        border-radius: 0.75rem;
        background: var(--bg);
        border: 1px solid var(--line);
      }
      .p.invalid {
        border-color: rgba(239, 68, 68, 0.45);
      }
      .p .ic {
        width: 2.3rem;
        height: 2.3rem;
        border-radius: 0.6rem;
        display: grid;
        place-items: center;
        background: var(--accent-soft);
        color: var(--accent-text);
        flex: none;
      }
      .p .l {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: var(--faint);
      }
      .p .v {
        font-family: var(--font-mono);
        font-size: 0.82rem;
        color: var(--fg);
        overflow-wrap: anywhere;
      }
      .p .m {
        font-size: 0.8rem;
        color: var(--bad-text);
        margin-top: 0.2rem;
      }
      .link {
        color: var(--muted);
        font-weight: 600;
        font-size: 0.85rem;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .link:hover {
        color: var(--fg);
      }
      @media (max-width: 760px) {
        .head {
          padding: 1.5rem 1.25rem 1rem;
        }
        h1 {
          font-size: 1.45rem;
        }
        .pickers {
          grid-template-columns: 1fr;
          padding: 0.4rem 1.25rem 1.25rem;
        }
        .arrow {
          transform: rotate(90deg);
        }
        .paths {
          padding: 0 1.25rem 1.25rem;
        }
        footer {
          padding: 1rem 1.25rem;
        }
        footer .btn {
          width: 100%;
        }
      }
    `,
  ];

  @property() accessor mode: 'welcome' | 'reconnect' = 'welcome';
  @property({ attribute: false }) accessor vault: FolderSelection | null = null;
  @property({ attribute: false }) accessor drive: FolderSelection | null = null;
  @property({ type: Boolean, attribute: 'can-continue' }) accessor canContinue = false;
  @property({ type: Boolean }) accessor scanning = false;
  @property({ type: Number, attribute: 'queued-changes' }) accessor queuedChanges = 0;

  private fire(name: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /** Asks for permission on both folders, in the click that triggers it. */
  private async reconnect(): Promise<void> {
    // Both requests start in this click: a prompt needs the click's user activation.
    const ask = (selection: FolderSelection | null, mode: 'read' | 'readwrite') =>
      selection?.handle.requestPermission({ mode }).catch(() => undefined);
    // A missing folder or a refusal is reported by the store's check.
    await Promise.all([ask(this.vault, 'read'), ask(this.drive, 'readwrite')]);
    this.fire('reconnect');
  }

  private brand() {
    return html`<div class="brand">
      <div class="mark" aria-hidden="true">${icon('logo')}</div>
      <b>Loadout</b>
    </div>`;
  }

  private savedFolder(label: string, role: Role, selection: FolderSelection | null) {
    const invalid = selection?.status === 'invalid';
    return html`<div class="p ${invalid ? 'invalid' : ''}">
      <div class="ic">${icon(role === 'vault' ? 'vault' : 'drive')}</div>
      <div>
        <div class="l">${label}</div>
        <div class="v">Directory name: ${selection?.name}</div>
        ${invalid ? html`<div class="m">${selection.message}</div>` : nothing}
      </div>
    </div>`;
  }

  private renderReconnect() {
    const n = this.queuedChanges;
    const checking = this.scanning || this.vault?.status === 'checking' || this.drive?.status === 'checking';
    return html`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="wh">
      <div class="head">
        ${this.brand()}
        <h1 id="wh">Welcome back</h1>
        <p class="lead">
          Your browser needs permission again to use these folders.
          ${n > 0 ? html`Your queue of <b>${n} change${n === 1 ? '' : 's'}</b> is saved.` : html`Nothing is queued.`}
        </p>
      </div>
      <div class="paths">
        ${this.savedFolder('Vault', 'vault', this.vault)} ${this.savedFolder('Drive', 'drive', this.drive)}
      </div>
      <footer>
        <button
          class="link"
          @click=${() => {
            this.fire('start-over');
          }}
        >
          Start over with different folders
        </button>
        <button class="btn primary lg" ?disabled=${checking} @click=${() => void this.reconnect()}>
          ${checking ? html`<span class="spin"></span>Checking...` : 'Reconnect'}
        </button>
      </footer>
    </div>`;
  }

  override render(): TemplateResult {
    if (this.mode === 'reconnect') return this.renderReconnect();
    const refuse = (role: Role) => (e: Event) => {
      e.stopPropagation();
      this.fire('clear-folder', { role });
    };
    const pick = (role: Role) => (e: CustomEvent<{ handle: FileSystemDirectoryHandle }>) => {
      e.stopPropagation();
      this.fire('select-folder', { role, handle: e.detail.handle });
    };
    return html`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="wh">
      <div class="head">
        ${this.brand()}
        <h1 id="wh">Load titles onto your console's drive</h1>
        <p class="lead">
          Loadout copies titles from your backup vault to the drive you plug into your Xbox 360. Choose both folders to
          begin. You'll pick titles next, and nothing is copied until you apply the queue.
        </p>
      </div>
      <div class="pickers">
        <folder-picker
          kind="vault"
          heading="Vault"
          hint="Your backups. Choose the folder that holds the partitions, usually called Content. Loadout only ever reads from it."
          .selection=${this.vault}
          .other=${this.drive?.handle ?? null}
          @pick=${pick('vault')}
          @refuse=${refuse('vault')}
        ></folder-picker>
        <div class="arrow" aria-hidden="true">${icon('chev')}</div>
        <folder-picker
          kind="drive"
          heading="Drive"
          hint="The drive for your console. Choose its Content folder, or an empty folder to start a new one."
          .selection=${this.drive}
          .other=${this.vault?.handle ?? null}
          @pick=${pick('drive')}
          @refuse=${refuse('drive')}
        ></folder-picker>
      </div>
      <footer>
        <span class="note">${icon('lock')}Loadout never writes to the vault.</span>
        <button
          class="btn primary lg"
          ?disabled=${!this.canContinue || this.scanning}
          @click=${() => {
            this.fire('continue');
          }}
        >
          ${this.scanning ? html`<span class="spin"></span>Scanning...` : html`Continue${icon('chev')}`}
        </button>
      </footer>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'welcome-modal': WelcomeModal;
  }
}
