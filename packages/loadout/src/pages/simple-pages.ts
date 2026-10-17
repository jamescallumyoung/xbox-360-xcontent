import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { base, buttons } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { pageStyles } from './page-styles.js';
import { applyFilters } from '../lib/titles.js';
import type { TitleFilters, TitleSort } from '../lib/types.js';
import { store, StoreController } from '../app/store-controller.js';
import '../components/drive-widget.js';
import '../components/discover-section.js';
import '../components/title-grid.js';
import '../components/library-filters.js';
import '../components/toast-history.js';

/** The drive widget, as Discover and the Drive page show it. */
function driveWidget(mode: 'mini' | 'full'): TemplateResult {
  const s = store;
  return html`<drive-widget
    mode=${mode}
    name=${s.drive?.name ?? ''}
    .summary=${s.driveSummary}
    queued-bytes=${s.queuedAddBytes}
    remove-bytes=${s.queuedRemoveBytes}
    .health=${s.driveHealth}
    ?scanning=${s.scanning}
    ?busy=${s.busy}
    @rescan=${() => void s.rescan()}
  ></drive-widget>`;
}

const QUEUED: TitleFilters = { status: 'queued' };
const ALL: TitleFilters = {};

/** Discover: the drive at a glance, the queue, and what's new in the vault. */
@customElement('discover-page')
export class DiscoverPage extends LitElement {
  static override styles = [
    base,
    buttons,
    pageStyles,
    css`
      .blocked {
        color: var(--warn-text);
        font-size: 0.8rem;
      }
    `,
  ];

  constructor() {
    super();
    new StoreController(this);
  }

  override render(): TemplateResult {
    const s = store;
    const n = s.queue.length;
    const progress = s.apply?.progress ?? null;
    const label = !s.busy
      ? html`${icon('play')}Apply ${n} change${n === 1 ? '' : 's'}`
      : progress === null
        ? 'Applying...'
        : `Applying... ${String(Math.round(progress.fraction * 100))}%`;
    return html` ${driveWidget('mini')}
      <discover-section heading="Your queue" see-all-url="#/queue" .titles=${s.library} .filters=${QUEUED} sort="name">
        ${
          n > 0 || s.busy
            ? html`<button
                slot="action"
                class="btn primary sm"
                ?disabled=${s.busy || s.applyBlocked !== null}
                @click=${() => void s.startApply()}
              >
                ${label}
              </button>`
            : nothing
        }
        ${s.applyBlocked === null || n === 0 ? nothing : html`<span slot="action" class="blocked">${s.applyBlocked}</span>`}
      </discover-section>
      <discover-section
        heading="Recently added to the vault"
        .titles=${s.library}
        .filters=${ALL}
        sort="added-desc"
        length="12"
      ></discover-section>`;
  }
}

/** Library: every vault title, with all filters and sorts. */
@customElement('library-page')
export class LibraryPage extends LitElement {
  static override styles = [base, buttons, pageStyles];

  constructor() {
    super();
    new StoreController(this);
  }

  override render(): TemplateResult {
    const s = store;
    const total = s.vaultTitles.length;
    const shown = applyFilters(s.library, s.libraryFilters).length;
    return html` <div class="page-title">
        <div>
          <h1>Library</h1>
          <div class="sub">
            ${shown === total ? `${String(total)} titles in the vault` : `${String(shown)} of ${String(total)} titles in the vault`}
          </div>
        </div>
      </div>
      <library-filters
        .filters=${s.libraryFilters}
        sort=${s.librarySort}
        @filters-change=${(e: CustomEvent<{ filters: TitleFilters; sort: TitleSort }>) => {
          s.setLibrary(e.detail.filters, e.detail.sort);
        }}
      ></library-filters>
      <title-grid .titles=${s.library} .filters=${s.libraryFilters} sort=${s.librarySort}></title-grid>`;
  }
}

/** Drive: the full drive widget, and the vault titles on the drive. */
@customElement('drive-page')
export class DrivePage extends LitElement {
  static override styles = [base, buttons, pageStyles];

  constructor() {
    super();
    new StoreController(this);
  }

  override render(): TemplateResult {
    const s = store;
    const onDrive = s.library.filter((x) => x.status === 'on-drive' || x.status === 'partial');
    return html` <div class="page-title">
        <div>
          <h1>Drive</h1>
          <div class="sub">What your console will see when you plug the drive in.</div>
        </div>
      </div>
      ${driveWidget('full')}
      <section>
        <div class="section-head">
          <h2>Vault titles on the drive</h2>
          <span class="note">Titles that are only on the drive aren't listed here.</span>
        </div>
        <title-grid .titles=${onDrive} sort="name"></title-grid>
      </section>`;
  }
}

const STATE_LABEL = { connected: 'Connected', disconnected: 'Disconnected', error: 'Error' } as const;

/** Settings: re-select the vault and drive. */
@customElement('settings-page')
export class SettingsPage extends LitElement {
  static override styles = [
    base,
    buttons,
    pageStyles,
    css`
      .card {
        padding: 1.4rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 46rem;
      }
      .card h2 {
        margin: 0;
        color: var(--fg);
        font-size: 1.1rem;
      }
      .card p {
        margin: 0;
        color: var(--muted);
        font-size: 0.875rem;
        line-height: 1.55;
        max-width: 62ch;
      }
      .paths {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 0.5rem 1rem;
        font-size: 0.85rem;
        align-items: center;
        margin: 0;
      }
      .paths dt {
        color: var(--muted);
        font-weight: 600;
      }
      .paths dd {
        margin: 0;
        color: var(--fg);
        overflow-wrap: anywhere;
      }
      .paths .mono {
        font-size: 0.8rem;
      }
      .st {
        font-size: 0.75rem;
        font-weight: 600;
      }
      .st.connected {
        color: var(--ok-text);
      }
      .st.disconnected {
        color: var(--warn-text);
      }
      .st.error {
        color: var(--bad-text);
      }
    `,
  ];

  @state() private accessor showHistory = false;

  constructor() {
    super();
    new StoreController(this);
  }

  override render(): TemplateResult {
    const s = store;
    return html` <div class="page-title">
        <div><h1>Settings</h1></div>
      </div>
      <section class="panel card">
        <h2>Vault and drive</h2>
        <dl class="paths">
          <dt>Vault</dt>
          <dd>Directory name: <span class="mono">${s.vault?.name}</span></dd>
          <dd class="st ${s.vaultHealth.state}">${STATE_LABEL[s.vaultHealth.state]}</dd>
          <dt>Drive</dt>
          <dd>Directory name: <span class="mono">${s.drive?.name}</span></dd>
          <dd class="st ${s.driveHealth.state}">${STATE_LABEL[s.driveHealth.state]}</dd>
        </dl>
        <p>
          Choose different folders. This clears your queue and takes you back to the welcome screen. Nothing on the
          vault or the drive is changed.
        </p>
        <div>
          <button
            class="btn danger"
            ?disabled=${s.busy}
            @click=${() => {
              s.requestReset();
            }}
          >
            ${icon('refresh')}Re-select vault and drive
          </button>
        </div>
      </section>
      <section class="panel card">
        <h2>Notifications</h2>
        <p>Every notification shown in this tab, such as how many changes a stopped apply made.</p>
        <div>
          <button
            class="btn"
            @click=${() => {
              this.showHistory = true;
            }}
          >
            ${icon('info')}Show notifications (${s.toastLog.length})
          </button>
        </div>
      </section>
      <toast-history
        ?open=${this.showHistory}
        .items=${s.toastLog}
        @history-close=${() => {
          this.showHistory = false;
        }}
      ></toast-history>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'discover-page': DiscoverPage;
    'library-page': LibraryPage;
    'drive-page': DrivePage;
    'settings-page': SettingsPage;
  }
}
