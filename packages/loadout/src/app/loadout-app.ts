import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../styles/shared.js';
import type { NavItem } from '../components/nav-item.js';
import type { Page, Role } from './store.js';
import { store, StoreController } from './store-controller.js';
import '../components/side-nav.js';
import '../components/tab-bar.js';
import '../components/app-header.js';
import '../components/welcome-modal.js';
import '../components/confirm-dialog.js';
import '../components/toast-stack.js';
import '../components/apply-summary.js';
import '../pages/simple-pages.js';
import '../pages/queue-page.js';
import '../pages/manage-page.js';

/** App shell: navigation, header, the current page, and app-wide overlays. */
@customElement('loadout-app')
export class LoadoutApp extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-height: 100%;
      }
      main {
        margin-left: 16rem;
        min-height: 100%;
      }
      tab-bar {
        display: none;
      }
      @media (max-width: 760px) {
        side-nav {
          display: none;
        }
        tab-bar {
          display: grid;
        }
        main {
          margin-left: 0;
          padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
        }
      }
    `,
  ];

  constructor() {
    super();
    new StoreController(this);
  }

  /** Checks the folders again whenever the tab comes back into view (features.md, section 7b). */
  private readonly onVisible = (): void => {
    if (document.visibilityState === 'visible') void store.checkFolders();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.onVisible);
  }

  override disconnectedCallback(): void {
    document.removeEventListener('visibilitychange', this.onVisible);
    super.disconnectedCallback();
  }

  private get nav(): NavItem[] {
    return [
      { id: 'discover', label: 'Discover', icon: 'discover' },
      { id: 'library', label: 'Library', icon: 'library' },
      { id: 'queue', label: 'Queue', icon: 'queue', badge: store.queuedTitleCount },
      { id: 'drive', label: 'Drive', icon: 'drive' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ];
  }

  private readonly onSeeAll = (e: CustomEvent<{ url: string }>): void => {
    e.preventDefault();
    store.seeAll(e.detail.url);
  };

  private renderPage(page: Page): TemplateResult {
    switch (page) {
      case 'discover':
        return html`<discover-page></discover-page>`;
      case 'library':
        return html`<library-page></library-page>`;
      case 'queue':
        return html`<queue-page></queue-page>`;
      case 'drive':
        return html`<drive-page></drive-page>`;
      case 'settings':
        return html`<settings-page></settings-page>`;
      case 'manage':
        return html`<manage-page></manage-page>`;
    }
  }

  private renderWelcome() {
    const s = store;
    return html`<welcome-modal
      mode=${s.phase === 'reconnect' ? 'reconnect' : 'welcome'}
      .vault=${s.vault}
      .drive=${s.drive}
      ?can-continue=${s.canContinue}
      ?scanning=${s.scanning}
      queued-changes=${s.queue.length}
      @select-folder=${(e: CustomEvent<{ role: Role; handle: FileSystemDirectoryHandle }>) =>
        void s.pick(e.detail.role, e.detail.handle)}
      @clear-folder=${(e: CustomEvent<{ role: Role }>) => {
        s.clearSelection(e.detail.role);
      }}
      @continue=${() => void s.continue()}
      @reconnect=${() => void s.reconnect()}
      @start-over=${() => void s.reset()}
    ></welcome-modal>`;
  }

  override render(): TemplateResult {
    const s = store;
    // Nothing until the session is loaded, so the welcome screen doesn't flash.
    if (s.phase === 'starting') return html``;
    const ready = s.phase === 'ready';
    const current = s.page === 'manage' ? '' : s.page;
    const navigate = (e: CustomEvent<{ id: Page }>) => {
      s.navigate(e.detail.id);
      scrollTo(0, 0);
    };
    const n = s.queue.length;
    return html`
      <side-nav
        .items=${this.nav}
        current=${current}
        .vault=${ready ? s.vaultHealth : null}
        .drive=${ready ? s.driveHealth : null}
        ?applying=${s.busy}
        @navigate=${navigate}
        @deselect=${() => {
          s.requestReset();
        }}
      ></side-nav>
      <main
        @tile-open=${(e: CustomEvent<{ titleId: string }>) => {
          s.openTitle(e.detail.titleId);
          scrollTo(0, 0);
        }}
        @see-all=${this.onSeeAll}
      >
        <app-header
          .query=${s.query}
          .titles=${s.vaultTitles}
          status=${s.status}
          error-count=${s.errorCount}
          .progress=${s.apply?.progress ?? null}
          queued-count=${s.queue.length}
          @search=${(e: CustomEvent<{ query: string }>) => {
            s.setQuery(e.detail.query);
          }}
          @open-title=${(e: CustomEvent<{ titleId: string }>) => {
            s.openTitle(e.detail.titleId);
            scrollTo(0, 0);
          }}
        ></app-header>
        ${ready ? this.renderPage(s.page) : nothing}
      </main>
      <tab-bar .items=${this.nav} current=${current} @navigate=${navigate}></tab-bar>
      ${ready ? nothing : this.renderWelcome()}
      <confirm-dialog
        ?open=${s.confirmingReset}
        tone="danger"
        heading="Re-select vault and drive?"
        confirm-label="Clear queue and re-select"
        @confirm=${() => void s.reset()}
        @cancel=${() => {
          s.cancelReset();
        }}
      >
        You'll go back to the welcome screen to choose both folders again.
        <span slot="warning"
          >${
            n > 0
              ? html`<b>This also clears your queue of ${n} change${n === 1 ? '' : 's'}.</b> `
              : html`<b>This also clears your queue.</b> `
          }Nothing
          on the vault or the drive is changed.</span
        >
      </confirm-dialog>
      <apply-summary
        .report=${s.report}
        .save=${s.reportSave}
        @close=${() => {
          s.closeReport();
        }}
        @download=${() => {
          s.downloadReport();
        }}
        @save-to-drive=${() => void s.saveReportToDrive(window.showSaveFilePicker.bind(window))}
      ></apply-summary>
      <toast-stack .items=${s.toasts}></toast-stack>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'loadout-app': LoadoutApp;
  }
}
