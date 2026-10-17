import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base, buttons } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { pageStyles } from './page-styles.js';
import { contentTypeName } from '../lib/content-types.js';
import { canAdd, canRemove, formatSize, gameType, packageBytes } from '../lib/titles.js';
import type { Package, PackageKind, PackageRow, Title } from '../lib/types.js';
import { store, StoreController } from '../app/store-controller.js';
import { thumbnailUrl } from '../components/thumbnail.js';
import '../components/title-cover.js';
import '../components/notice-banner.js';
import '../components/confirm-dialog.js';

const GROUPS: [PackageKind, string][] = [
  ['game', 'Game or app'],
  ['title-update', 'Title updates'],
  ['dlc', 'DLC'],
  ['other', 'Other content'],
];

const sum = (packages: readonly Package[]) => packages.reduce((s, p) => s + packageBytes(p), 0);

/** Manage Title: not in the sidebar; opened from a tile or a search result. */
@customElement('manage-page')
export class ManagePage extends LitElement {
  static override styles = [
    base,
    buttons,
    pageStyles,
    css`
      :host {
        position: relative;
        padding-top: 0;
      }
      .backdrop {
        position: absolute;
        inset: 0 0 auto 0;
        height: 24rem;
        overflow: hidden;
        z-index: 0;
        pointer-events: none;
      }
      .backdrop img {
        position: absolute;
        inset: -20%;
        width: 140%;
        height: 140%;
        object-fit: cover;
        filter: blur(48px) saturate(1.4);
        opacity: 0.45;
      }
      .backdrop::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(17, 24, 39, 0.25), var(--bg) 92%);
      }
      .top {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        padding-top: 1.5rem;
      }
      .back {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: var(--fg-2);
        font-weight: 600;
      }
      .back:hover {
        color: #fff;
      }
      .hero {
        display: grid;
        grid-template-columns: 12rem minmax(0, 1fr);
        gap: 2rem;
        align-items: end;
      }
      .hero title-cover {
        width: 12rem;
      }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 0.6rem;
      }
      h1 {
        margin: 0;
        color: var(--fg);
        font-size: 2.3rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
        text-wrap: balance;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.6rem;
        align-items: center;
        color: var(--fg-2);
        margin-top: 0.5rem;
      }
      .meta .dot {
        color: var(--faint);
      }
      .meta .mono {
        color: var(--accent-text);
        font-size: 0.85rem;
      }
      .banners {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        position: relative;
        z-index: 1;
      }
      .body {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 19rem;
        gap: 2rem;
        align-items: start;
      }
      .groups {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        min-width: 0;
      }
      .group h2 {
        margin: 0 0 0.6rem;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
      }
      .group h2 span {
        color: var(--faint);
        font-weight: 500;
        letter-spacing: 0;
        text-transform: none;
        font-size: 0.8rem;
      }
      .rows {
        overflow: hidden;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 5rem auto auto;
        gap: 1rem;
        align-items: center;
        padding: 0.8rem 1rem;
        border-bottom: 1px solid var(--line-soft);
      }
      .row:last-child {
        border-bottom: 0;
      }
      .row.q-add {
        background: linear-gradient(90deg, rgba(34, 197, 94, 0.08), transparent 60%);
      }
      .row.q-remove {
        background: linear-gradient(90deg, rgba(239, 68, 68, 0.09), transparent 60%);
      }
      .nm {
        color: var(--fg);
        font-weight: 500;
        display: flex;
        gap: 0.45rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .sub {
        color: var(--faint);
        font-size: 0.72rem;
        margin-top: 0.15rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub .mono {
        font-size: 0.95em;
      }
      .sz {
        text-align: right;
        color: var(--fg-2);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .where {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .act {
        display: flex;
        gap: 0.4rem;
        justify-content: flex-end;
        min-width: 7.5rem;
      }
      .act .btn {
        min-width: 6.5rem;
      }
      .btn.add {
        color: var(--ok-text);
        border-color: rgba(34, 197, 94, 0.45);
        background: var(--ok-soft);
      }
      .btn.rem {
        color: var(--bad-text);
        border-color: rgba(239, 68, 68, 0.45);
        background: var(--bad-soft);
      }
      aside {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      dl {
        margin: 0;
        overflow: hidden;
      }
      dl div {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.6rem 1rem;
        border-bottom: 1px solid var(--line);
        font-size: 0.85rem;
      }
      dl div:last-child {
        border-bottom: 0;
      }
      dt {
        color: var(--muted);
        font-weight: 600;
      }
      dd {
        margin: 0;
        color: var(--fg-2);
        text-align: right;
        overflow-wrap: anywhere;
        font-variant-numeric: tabular-nums;
      }
      .later {
        padding: 0.9rem 1rem;
        font-size: 0.8rem;
        color: var(--faint);
        line-height: 1.5;
      }
      .warn-name {
        color: var(--fg);
      }
      @media (max-width: 1000px) {
        .body {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 760px) {
        .hero {
          grid-template-columns: 7rem minmax(0, 1fr);
          gap: 1rem;
        }
        .hero title-cover {
          width: 7rem;
        }
        h1 {
          font-size: 1.5rem;
        }
        .row {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .where {
          justify-content: flex-start;
          grid-column: 1;
        }
        .sz {
          grid-row: 1;
          grid-column: 2;
        }
        .act {
          grid-column: 2;
          grid-row: 2;
        }
      }
    `,
  ];

  constructor() {
    super();
    new StoreController(this);
  }

  private renderAction(row: PackageRow, p: Package) {
    const s = store;
    const op = s.queuedOp(p.location);
    const busy = s.busy;
    const { location } = p;
    if (op === 'add') {
      return html`<button
        class="btn sm"
        ?disabled=${busy}
        @click=${() => {
          s.toggleAdd(location);
        }}
      >
        ${icon('undo')}Undo add
      </button>`;
    }
    if (op === 'remove') {
      return html`<button
        class="btn sm"
        ?disabled=${busy}
        @click=${() => {
          s.requestRemove(location);
        }}
      >
        ${icon('undo')}Undo remove
      </button>`;
    }
    if (canRemove(row)) {
      return html`<button
        class="btn sm rem"
        ?disabled=${busy}
        @click=${() => {
          s.requestRemove(location);
        }}
      >
        ${icon('minus')}Remove
      </button>`;
    }
    if (canAdd(row)) {
      return html`<button
        class="btn sm add"
        ?disabled=${busy}
        @click=${() => {
          s.toggleAdd(location);
        }}
      >
        ${icon('plus')}Add
      </button>`;
    }
    return nothing;
  }

  private renderRow(row: PackageRow) {
    const p = row.vault ?? row.drive;
    if (p === undefined) return nothing;
    const op = store.queuedOp(p.location);
    const { contentType, packageName } = p.location;
    return html`<div class="row ${op === undefined ? '' : `q-${op}`}">
      <div style="min-width:0">
        <div class="nm">
          ${p.name}
          ${row.vault?.corrupt === true ? html`<span class="pill bad">${icon('alert')}Corrupt in vault</span>` : nothing}
          ${op === undefined ? nothing : html`<span class="pill q">Queued: ${op}</span>`}
        </div>
        <div class="sub">
          ${contentTypeName(contentType)} &middot;
          <span class="mono">${contentType}/${packageName}${p.format === 'svod' ? ' + .data/' : ''}</span>
        </div>
      </div>
      <div class="sz">${formatSize(packageBytes(p))}</div>
      <div class="where">
        ${row.vault === undefined ? html`<span class="pill warn">Not in vault</span>` : html`<span class="pill">In vault</span>`}
        ${
          row.drive === undefined
            ? html`<span class="pill dim">Not on drive</span>`
            : row.drive.corrupt
              ? html`<span class="pill bad">Broken on drive</span>`
              : html`<span class="pill ok">On drive</span>`
        }
      </div>
      <div class="act">${this.renderAction(row, p)}</div>
    </div>`;
  }

  private renderBanners(titleId: string, rows: PackageRow[]) {
    const s = store;
    const out: TemplateResult[] = [];
    const corrupt = rows.filter((r) => r.vault?.corrupt === true || r.drive?.corrupt === true);
    if (corrupt.length > 0) {
      const n = corrupt.length;
      out.push(
        html`<notice-banner tone="bad"
          ><b>${n} package${n === 1 ? '' : 's'}</b> ${n === 1 ? 'is' : 'are'} damaged or incomplete:
          ${corrupt.map((r) => (r.vault ?? r.drive)?.name).join(', ')}. A package that is broken on the drive can be
          removed, then copied again from the vault.</notice-banner
        >`,
      );
    }
    const changes = s.queue.filter((c) => c.location.titleId === titleId).length;
    if (changes > 0) {
      out.push(
        html`<notice-banner tone="info"
          >${changes} change${changes === 1 ? '' : 's'} queued for this title.
          <button
            slot="actions"
            class="btn sm"
            @click=${() => {
              s.navigate('queue');
            }}
          >
            View queue
          </button></notice-banner
        >`,
      );
    }
    return out.length > 0 ? html`<div class="banners">${out}</div>` : nothing;
  }

  private renderWarning() {
    const s = store;
    const pending = s.pendingRemoval;
    const pkg = pending === null ? undefined : s.packageFor({ op: 'remove', location: pending.location });
    const why =
      pending?.risk === 'mismatch'
        ? html`<b>The vault's copy doesn't match the drive's</b>, or one of them is damaged. Once removed, the drive's
            version is gone for good. If it's the good copy, keep it. (Loadout compares the packages' headers; it
            doesn't compare their data.)`
        : html`<b>This content isn't in your vault.</b> Once it's removed from the drive, Loadout can't copy it back.
            This can't be undone.`;
    return html`<confirm-dialog
      ?open=${pending !== null}
      tone="danger"
      heading="Remove content that can't be restored?"
      confirm-label="Queue removal anyway"
      cancel-label="Keep it"
      @confirm=${() => {
        s.confirmPendingRemoval();
      }}
      @cancel=${() => {
        s.cancelPendingRemoval();
      }}
    >
      <b class="warn-name">${pkg?.name}</b> will be deleted from the drive when you apply the queue.
      <span slot="warning">${why}</span>
    </confirm-dialog>`;
  }

  private renderAside(title: Title, vault: Title | undefined, drive: Title | undefined) {
    const vaultPackages = vault?.packages ?? [];
    const drivePackages = drive?.packages ?? [];
    const date = new Date(title.addedAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return html`<aside>
      <dl class="panel">
        <div>
          <dt>Title ID</dt>
          <dd class="mono">${title.titleId}</dd>
        </div>
        <div>
          <dt>Publisher</dt>
          <dd>${title.publisher ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>${gameType(title) === 'GOD' ? 'Games on Demand' : 'Other'}</dd>
        </div>
        <div>
          <dt>In vault</dt>
          <dd>
            ${vaultPackages.length} package${vaultPackages.length === 1 ? '' : 's'} &middot;
            ${formatSize(sum(vaultPackages))}
          </dd>
        </div>
        <div>
          <dt>On drive</dt>
          <dd>
            ${drivePackages.length} package${drivePackages.length === 1 ? '' : 's'} &middot;
            ${formatSize(sum(drivePackages))}
          </dd>
        </div>
        <div>
          <dt>Added to vault</dt>
          <dd>${vault === undefined ? 'Not in vault' : date}</dd>
        </div>
      </dl>
      <div class="panel later">
        Saves aren't shown: save management comes in a later version. Release dates will return once there's a data
        source for them.
      </div>
    </aside>`;
  }

  override render(): TemplateResult {
    const s = store;
    const id = s.titleId;
    const vault = id === null ? undefined : s.vaultTitle(id);
    const drive = id === null ? undefined : s.driveTitle(id);
    const title = vault ?? drive;
    if (id === null || title === undefined) {
      return html`<div class="empty-state">
        <b>Title not found</b>
        <button
          class="btn"
          @click=${() => {
            s.back();
          }}
        >
          Go back
        </button>
      </div>`;
    }
    const rows = s.rows(id);
    const status =
      vault === undefined ? 'drive-only' : (s.library.find((x) => x.title.titleId === id)?.status ?? 'not-on-drive');
    const statusPill = {
      'on-drive': html`<span class="pill ok">${icon('check')}On drive</span>`,
      partial: html`<span class="pill warn">Partly on drive</span>`,
      queued: html`<span class="pill q">${icon('clock')}Changes queued</span>`,
      'not-on-drive': html`<span class="pill">Not on drive</span>`,
      'drive-only': html`<span class="pill warn">Only on drive</span>`,
    }[status];
    const thumb = thumbnailUrl(title.thumbnail);
    return html` <div class="backdrop">${thumb === undefined ? nothing : html`<img src=${thumb} alt="" />`}</div>
      <div class="top">
        <button
          class="back"
          @click=${() => {
            s.back();
          }}
        >
          ${icon('back')}Back
        </button>
        <div class="hero">
          <title-cover
            .name=${title.name}
            .publisher=${title.publisher}
            .titleId=${id}
            .thumbnail=${title.thumbnail}
          ></title-cover>
          <div style="min-width:0">
            <div class="pills">
              ${statusPill}<span class="pill">${gameType(title) === 'GOD' ? 'Games on Demand' : 'Other'}</span>
            </div>
            <h1>${title.name}</h1>
            <div class="meta">
              <span>${title.publisher ?? 'Unknown publisher'}</span><span class="dot">&bull;</span
              ><span>Title ID <span class="mono">${id}</span></span>
            </div>
          </div>
        </div>
      </div>
      ${this.renderBanners(id, rows)}
      <div class="body">
        <div class="groups">
          ${GROUPS.map(([kind, label]) => {
            const group = rows.filter((r) => (r.vault ?? r.drive)?.kind === kind);
            if (group.length === 0) return nothing;
            return html`<section class="group">
              <h2>${label}<span>${group.length}</span></h2>
              <div class="panel rows">${group.map((r) => html`${this.renderRow(r)}`)}</div>
            </section>`;
          })}
        </div>
        ${this.renderAside(title, vault, drive)}
      </div>
      ${this.renderWarning()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'manage-page': ManagePage;
  }
}
