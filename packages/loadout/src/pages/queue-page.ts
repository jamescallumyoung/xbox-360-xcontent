import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base, buttons, spinner } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { pageStyles } from './page-styles.js';
import { contentTypeName } from '../lib/content-types.js';
import { changeKey, formatSize, packageBytes } from '../lib/titles.js';
import type { Change } from '../lib/types.js';
import { store, StoreController } from '../app/store-controller.js';
import { thumbnailUrl } from '../components/thumbnail.js';
import '../components/notice-banner.js';

const MINUS = html`&minus;`;

/** Queue: a git-like grouped list of changes, applied removals first. */
@customElement('queue-page')
export class QueuePage extends LitElement {
  static override styles = [
    base,
    buttons,
    spinner,
    pageStyles,
    css`
      :host {
        padding-bottom: 8rem;
      }
      .cards {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .card {
        overflow: hidden;
      }
      .card-head {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--line);
        background: var(--bg-deep);
      }
      .card-head img {
        width: 2.4rem;
        height: 2.4rem;
        border-radius: 0.4rem;
        flex: none;
      }
      .card-head .t {
        min-width: 0;
        flex: 1;
      }
      .card-head .n {
        color: var(--fg);
        font-weight: 700;
        text-align: left;
      }
      .card-head .n:hover {
        text-decoration: underline;
      }
      .card-head .m {
        color: var(--faint);
        font-size: 0.75rem;
      }
      .card-head .tot {
        font-size: 0.8rem;
        color: var(--muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .plus {
        color: var(--ok-text);
      }
      .minus {
        color: var(--bad-text);
      }
      .row {
        display: grid;
        grid-template-columns: 1.5rem minmax(0, 1fr) auto auto;
        gap: 0.9rem;
        align-items: center;
        padding: 0.65rem 1rem;
        border-bottom: 1px solid var(--line-soft);
        font-size: 0.875rem;
      }
      .row:last-child {
        border-bottom: 0;
      }
      .sign {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 1.05rem;
        text-align: center;
      }
      .row.add {
        background: rgba(34, 197, 94, 0.06);
      }
      .row.add .sign {
        color: var(--ok);
      }
      .row.remove {
        background: rgba(239, 68, 68, 0.07);
      }
      .row.remove .sign {
        color: var(--bad);
      }
      .row .nm {
        color: var(--fg);
      }
      .row .k {
        color: var(--faint);
        font-size: 0.72rem;
        margin-top: 0.1rem;
      }
      .row .k .mono {
        font-size: 0.95em;
      }
      .row .sz {
        font-variant-numeric: tabular-nums;
        color: var(--fg-2);
        white-space: nowrap;
        text-align: right;
      }
      .row.remove .sz {
        color: var(--bad-text);
      }
      .state {
        width: 7rem;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        color: var(--muted);
      }
      .state svg {
        width: 1rem;
        height: 1rem;
      }
      .state.done {
        color: var(--ok-text);
      }
      .state.fail {
        color: var(--bad-text);
      }
      .state.current {
        flex-direction: column;
        align-items: stretch;
      }
      .state.current .pct {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        justify-content: flex-end;
      }
      .state.current .spin {
        width: 0.8rem;
        height: 0.8rem;
      }
      .bar {
        height: 0.3rem;
        width: 100%;
        border-radius: 999px;
        background: var(--bg-deep);
        overflow: hidden;
        margin-top: 0.35rem;
      }
      .bar i {
        display: block;
        height: 100%;
        background: var(--accent);
        transition: width 0.1s linear;
      }
      .summary {
        position: fixed;
        z-index: 25;
        left: calc(16rem + 2rem);
        right: 2rem;
        bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
        display: flex;
        align-items: center;
        gap: 1rem 1.5rem;
        flex-wrap: wrap;
        padding: 0.9rem 1.2rem;
        border-radius: 0.9rem;
        background: rgba(31, 41, 55, 0.94);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--line);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
      }
      .summary .figs {
        display: flex;
        gap: 1.25rem;
        flex-wrap: wrap;
        align-items: baseline;
        flex: 1;
        min-width: 0;
      }
      .fig {
        font-weight: 800;
        font-size: 1.15rem;
        font-variant-numeric: tabular-nums;
      }
      .fig small {
        font-size: 0.78rem;
        font-weight: 500;
        color: var(--muted);
        margin-left: 0.3rem;
      }
      .count {
        color: var(--muted);
        font-size: 0.82rem;
      }
      .overall {
        flex: 1;
        min-width: 12rem;
      }
      .overall .l {
        font-size: 0.82rem;
        color: var(--fg-2);
        margin-bottom: 0.35rem;
        font-variant-numeric: tabular-nums;
      }
      .overall .bar {
        height: 0.45rem;
      }
      .btn.lg {
        padding: 0.65rem 1.3rem;
      }
      .blocked {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.8rem;
        color: var(--warn-text);
      }
      .blocked svg {
        width: 1rem;
        height: 1rem;
      }
      @media (max-width: 760px) {
        :host {
          padding-bottom: 12rem;
        }
        .summary {
          left: 1rem;
          right: 1rem;
          bottom: calc(4.6rem + env(safe-area-inset-bottom, 0px));
        }
        .summary .btn {
          width: 100%;
        }
        .row {
          gap: 0.6rem;
          padding: 0.65rem 0.75rem;
        }
        .ul {
          display: none;
        }
        .state {
          width: auto;
          min-width: 2.2rem;
        }
      }
    `,
  ];

  constructor() {
    super();
    new StoreController(this);
  }

  /** A change's package: kept by the apply while one is shown, as a removed one leaves the scan. */
  private packageOf(change: Change) {
    return store.apply?.packages.get(changeKey(change)) ?? store.packageFor(change);
  }

  private bytes(change: Change): number {
    const p = this.packageOf(change);
    return p === undefined ? 0 : packageBytes(p);
  }

  /** A row's state: undo while queued, or its progress during an apply. */
  private rowState(c: Change) {
    const a = store.apply;
    if (a === null) {
      return html`<button
        class="btn sm ghost"
        aria-label="Undo this change"
        @click=${() => {
          store.undo(c);
        }}
      >
        ${icon('undo')}<span class="ul">Undo</span>
      </button>`;
    }
    const key = changeKey(c);
    const index = a.order.findIndex((o) => changeKey(o) === key);
    const current = a.progress?.index ?? 0;
    if (a.failed !== undefined && changeKey(a.failed.change) === key) {
      return html`<span class="state fail">${icon('alert')}Failed</span>`;
    }
    if (index < current || (index === current && a.progress?.changeFraction === 1)) {
      return html`<span class="state done">${icon('check')}${c.op === 'add' ? 'Copied' : 'Removed'}</span>`;
    }
    if (index === current && a.failed === undefined) {
      const pct = Math.round((a.progress?.changeFraction ?? 0) * 100);
      return html`<span class="state current">
        <span class="pct"><span class="spin"></span>${pct}%</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
      </span>`;
    }
    return html`<span class="state">${a.failed === undefined ? 'Waiting' : 'Not applied'}</span>`;
  }

  private renderCards() {
    const s = store;
    const list = s.apply === null ? s.queue : s.apply.order;
    const ids = [...new Set(list.map((c) => c.location.titleId))];
    return html`<div class="cards">
      ${ids.map((id) => {
        const thumb = thumbnailUrl(s.vaultTitle(id)?.thumbnail ?? s.driveTitle(id)?.thumbnail ?? null);
        const changes = list
          .filter((c) => c.location.titleId === id)
          .sort((a, b) => (a.op === b.op ? 0 : a.op === 'remove' ? -1 : 1));
        const total = (op: Change['op']) =>
          changes.filter((c) => c.op === op).reduce((sum, c) => sum + this.bytes(c), 0);
        const plus = total('add');
        const minus = total('remove');
        return html`<article class="panel card">
          <div class="card-head">
            ${thumb === undefined ? nothing : html`<img src=${thumb} alt="" />`}
            <div class="t">
              <button
                class="n"
                @click=${() => {
                  s.openTitle(id);
                }}
              >
                ${s.titleName(id)}
              </button>
              <div class="m mono">${id}</div>
            </div>
            <span class="tot"
              >${plus > 0 ? html`<span class="plus">+${formatSize(plus)}</span>` : nothing}
              ${minus > 0 ? html`<span class="minus"> ${MINUS}${formatSize(minus)}</span>` : nothing}</span
            >
          </div>
          ${changes.map((c) => {
            const p = this.packageOf(c);
            const { contentType, packageName } = c.location;
            return html`<div class="row ${c.op}">
              <span class="sign" aria-label=${c.op === 'add' ? 'Add' : 'Remove'}>${c.op === 'add' ? '+' : MINUS}</span>
              <div style="min-width:0">
                <div class="nm">${p?.name ?? packageName}</div>
                <div class="k">${contentTypeName(contentType)} &middot; <span class="mono">${contentType}</span></div>
              </div>
              <span class="sz">${c.op === 'remove' ? MINUS : '+'}${formatSize(this.bytes(c))}</span>
              ${this.rowState(c)}
            </div>`;
          })}
        </article>`;
      })}
    </div>`;
  }

  private renderSummary() {
    const s = store;
    const a = s.apply;
    if (a !== null && a.failed === undefined) {
      const p = a.progress;
      const done = p === null ? 0 : Math.round(p.fraction * 100);
      const where = a.stopping
        ? 'Stopping after this change...'
        : `Applying ${String(Math.min((p?.index ?? 0) + 1, a.order.length))} of ${String(a.order.length)}`;
      return html`<div class="summary" role="region" aria-label="Apply progress">
        <div class="overall">
          <div class="l">${where} &middot; ${done}%</div>
          <div class="bar"><i style="width:${done}%"></i></div>
        </div>
        <button
          class="btn lg"
          ?disabled=${a.stopping}
          @click=${() => {
            s.stopApply();
          }}
        >
          ${icon('stop')}Stop
        </button>
      </div>`;
    }
    if (a !== null) return nothing;
    const n = s.queue.length;
    const titles = s.queuedTitleCount;
    return html`<div class="summary" role="region" aria-label="Queue summary">
      <div class="figs">
        <span class="fig plus">+${formatSize(s.queuedAddBytes)}<small>to copy</small></span>
        ${
          s.queuedRemoveBytes > 0
            ? html`<span class="fig minus">${MINUS}${formatSize(s.queuedRemoveBytes)}<small>to remove</small></span>`
            : nothing
        }
        <span class="count"
          >${n} change${n === 1 ? '' : 's'} across ${titles} title${titles === 1 ? '' : 's'} &middot; removals run
          first</span
        >
      </div>
      ${
        s.applyBlocked === null
          ? nothing
          : html`<span class="blocked" role="status">${icon('alert')}${s.applyBlocked}</span>`
      }
      <button class="btn primary lg" ?disabled=${s.applyBlocked !== null} @click=${() => void s.startApply()}>
        ${icon('play')}Apply ${n} change${n === 1 ? '' : 's'}
      </button>
    </div>`;
  }

  override render(): TemplateResult {
    const s = store;
    const a = s.apply;
    const empty = s.queue.length === 0 && a === null;
    return html` <div class="page-title">
        <div>
          <h1>Queue</h1>
          <div class="sub">Changes waiting to be applied to the drive. Removals run first, then copies.</div>
        </div>
      </div>
      ${
        a?.failed === undefined
          ? nothing
          : html`<notice-banner tone="bad"
              ><b>Stopped.</b> ${a.failed.message} Nothing after it was applied. Changes that finished have left the
              queue; the rest are still here. Dismiss to retry or change the queue.
              <button
                slot="actions"
                class="btn sm"
                @click=${() => {
                  s.dismissError();
                }}
              >
                Dismiss
              </button></notice-banner
            >`
      }
      ${
        empty
          ? html`<div class="panel empty-state">
              ${icon('queue')}<b>Nothing queued</b>
              <span>Open a title and choose Add or Remove on any of its packages.</span>
              <button
                class="btn primary"
                @click=${() => {
                  s.navigate('library');
                }}
              >
                Browse the library
              </button>
            </div>`
          : html`${this.renderCards()}${this.renderSummary()}`
      }`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'queue-page': QueuePage;
  }
}
