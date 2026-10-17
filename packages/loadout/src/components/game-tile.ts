import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base, buttons } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { formatSize, gameType, titleBytes, titleFlags } from '../lib/titles.js';
import type { DriveStatus, LibraryTitle } from '../lib/types.js';
import './title-cover.js';

export interface TileEventDetail {
  titleId: string;
  status: DriveStatus;
}

/**
 * One title in a grid or row: cover, type capsule, drive-status badge, corrupt marker,
 * hover overlay with details and a Manage action, and a caption.
 * Clicking anywhere on the tile, or Manage, opens the title.
 *
 * @fires tile-open - detail: TileEventDetail
 */
@customElement('game-tile')
export class GameTile extends LitElement {
  static override styles = [
    base,
    buttons,
    css`
      :host {
        display: block;
        position: relative;
        min-width: 0;
      }
      .hit {
        display: block;
        width: 100%;
        text-align: left;
        border-radius: 0.6rem;
      }
      .frame {
        position: relative;
        border-radius: 0.6rem;
        transition:
          box-shadow 0.2s,
          transform 0.2s;
      }
      :host(:hover) .frame,
      :host(:focus-within) .frame {
        box-shadow:
          0 10px 28px rgba(0, 0, 0, 0.5),
          0 0 0 2px var(--accent);
        transform: scale(1.04);
      }
      .type {
        position: absolute;
        top: 14%;
        left: 6%;
        z-index: 2;
        background: rgba(17, 24, 39, 0.82);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #e5e7eb;
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 0.05rem 0.45rem;
        border-radius: 999px;
      }
      .status {
        position: absolute;
        top: 14%;
        right: 6%;
        z-index: 2;
        width: 1.45rem;
        height: 1.45rem;
        border-radius: 999px;
        display: grid;
        place-items: center;
        color: #fff;
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
      }
      .status svg {
        width: 0.85rem;
        height: 0.85rem;
      }
      .status.on-drive {
        background: var(--ok);
      }
      .status.queued {
        background: var(--accent);
      }
      .status.partial {
        background: var(--warn);
        color: #1f2937;
      }
      .corrupt {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2;
        border-radius: 0 0 0.6rem 0.6rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.3rem 0.55rem;
        background: linear-gradient(0deg, rgba(127, 29, 29, 0.95), rgba(185, 28, 28, 0.85));
        color: #fee2e2;
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .corrupt svg {
        width: 0.8rem;
        height: 0.8rem;
      }
      .overlay {
        position: absolute;
        inset: 0;
        z-index: 3;
        border-radius: 0.6rem;
        padding: 0.7rem;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 0.25rem;
        background: linear-gradient(180deg, rgba(17, 24, 39, 0.35), rgba(17, 24, 39, 0.97) 70%);
        opacity: 0;
        transition: opacity 0.18s;
        cursor: pointer;
      }
      :host(:hover) .overlay,
      :host(:focus-within) .overlay {
        opacity: 1;
      }
      @media (hover: none) {
        .overlay {
          display: none;
        }
      }
      .o-meta {
        color: var(--muted);
        font-size: 0.72rem;
      }
      .o-title {
        color: #fff;
        font-weight: 700;
        font-size: 0.92rem;
        line-height: 1.2;
      }
      .o-parts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin: 0.2rem 0 0.35rem;
      }
      .o-parts span {
        font-size: 0.62rem;
        padding: 0 0.35rem;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--fg-2);
      }
      .o-parts span.bad {
        background: var(--bad-soft);
        color: var(--bad-text);
      }
      .overlay .btn {
        width: 100%;
      }
      .caption {
        margin-top: 0.5rem;
        font-size: 0.8rem;
        color: var(--fg-2);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];

  @property({ attribute: false }) accessor item!: LibraryTitle;

  private open(e?: Event): void {
    e?.stopPropagation();
    this.dispatchEvent(
      new CustomEvent<TileEventDetail>('tile-open', {
        detail: { titleId: this.item.title.titleId, status: this.item.status },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private statusBadge() {
    switch (this.item.status) {
      case 'on-drive':
        return html`<span class="status on-drive" title="On drive">${icon('check')}</span>`;
      case 'partial':
        return html`<span class="status partial" title="Partly on drive">${icon('half')}</span>`;
      case 'queued':
        return html`<span class="status queued" title="Changes queued">${icon('clock')}</span>`;
      default:
        return nothing;
    }
  }

  override render(): TemplateResult {
    const { title: t, corrupt } = this.item;
    const f = titleFlags(t);
    const tus = t.packages.filter((p) => p.kind === 'title-update').length;
    const dlc = t.packages.filter((p) => p.kind === 'dlc').length;
    const total = titleBytes(t);
    return html` <div class="frame">
        <button
          class="hit"
          aria-label=${t.name}
          @click=${() => {
            this.open();
          }}
        >
          <title-cover
            .name=${t.name}
            .publisher=${t.publisher}
            .titleId=${t.titleId}
            .thumbnail=${t.thumbnail}
          ></title-cover>
        </button>
        <span class="type">${gameType(t)}</span>
        ${this.statusBadge()} ${corrupt ? html`<span class="corrupt">${icon('alert')}Corrupt</span>` : nothing}
        <div
          class="overlay"
          @click=${() => {
            this.open();
          }}
        >
          <div class="o-meta">${t.publisher ?? ''}</div>
          <div class="o-title">${t.name}</div>
          <div class="o-parts">
            <span>${formatSize(total)}</span>
            ${!f.playable ? html`<span>No game</span>` : nothing}
            ${tus > 0 ? html`<span>${tus} TU${tus === 1 ? '' : 's'}</span>` : nothing}
            ${dlc > 0 ? html`<span>${dlc} DLC</span>` : nothing}
            ${f.hasOtherContent ? html`<span>Other</span>` : nothing}
            ${corrupt ? html`<span class="bad">Corrupt</span>` : nothing}
          </div>
          <button
            class="btn sm primary"
            @click=${(e: Event) => {
              this.open(e);
            }}
          >
            Manage
          </button>
        </div>
      </div>
      <div class="caption">${t.name}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'game-tile': GameTile;
  }
}
