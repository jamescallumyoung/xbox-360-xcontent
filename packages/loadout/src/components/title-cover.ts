import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { base } from '../styles/shared.js';
import { coverPalette } from '../lib/titles.js';
import { thumbnailUrl } from './thumbnail.js';

/**
 * Cover art for a title, 2:3.
 * 1. `coverUrl` (real cover art, future) when given and it loads.
 * 2. Otherwise generated art with the 64x64 header `thumbnail` as a crisp icon (Q19, option A).
 * 3. Otherwise generated art alone.
 * The green band is decoration only (real covers have it printed in), so it carries no text.
 */
@customElement('title-cover')
export class TitleCover extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      .cover {
        position: relative;
        aspect-ratio: 2 / 3;
        width: 100%;
        max-width: 100%;
        border-radius: var(--cover-radius, 0.6rem);
        overflow: hidden;
        isolation: isolate;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        background: var(--c1, var(--panel));
      }
      img.art-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .art::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
          radial-gradient(circle at 25% 85%, var(--c2) 0%, transparent 55%),
          radial-gradient(circle at 90% 20%, var(--c3) 0%, transparent 50%),
          linear-gradient(165deg, var(--c1), var(--c4));
      }
      .art::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        opacity: 0.18;
        background: repeating-linear-gradient(var(--angle), rgba(255, 255, 255, 0.35) 0 1px, transparent 1px 9px);
      }
      .band {
        height: 11%;
        background: linear-gradient(180deg, #67c23a, var(--band) 60%, #2e7d13);
        box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.3);
      }
      .icon {
        position: absolute;
        left: 50%;
        top: 22%;
        transform: translateX(-50%);
        width: 46%;
        aspect-ratio: 1;
        border-radius: 10%;
        box-shadow:
          0 6px 18px rgba(0, 0, 0, 0.55),
          0 0 0 1px rgba(255, 255, 255, 0.18);
      }
      .name {
        position: absolute;
        left: 8%;
        right: 8%;
        bottom: 14%;
        font-family: var(--font-cover);
        color: #fff;
        font-weight: 700;
        text-transform: uppercase;
        line-height: 0.92;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        overflow-wrap: break-word;
        font-size: var(--ts);
      }
      .pub {
        position: absolute;
        left: 8%;
        right: 8%;
        bottom: 5%;
        font-size: max(0.5rem, 5.5cqi);
        color: rgba(255, 255, 255, 0.7);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];

  @property() accessor name = '';
  @property({ attribute: false }) accessor publisher: string | null = null;
  @property({ attribute: 'title-id' }) accessor titleId = '';
  @property({ attribute: 'cover-url' }) accessor coverUrl: string | undefined = undefined;
  /** The 64x64 header thumbnail's PNG bytes. */
  @property({ attribute: false }) accessor thumbnail: Uint8Array | null = null;
  @state() private accessor failed = false;

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('coverUrl')) this.failed = false;
  }

  /** Title size in container units: by length, and small enough for the longest word to fit. */
  private nameSize(withIcon: boolean): string {
    const longestWord = Math.max(...this.name.split(/\s+/).map((w) => w.length), 1);
    const len = this.name.length;
    const byLength = len > 30 ? 9 : len > 18 ? 11.5 : len > 10 ? 14 : withIcon ? 14 : 18;
    // Condensed caps run ~0.55em wide; 0.7 leaves room for a wider fallback font.
    return `${Math.min(byLength, 82 / (0.7 * longestWord)).toFixed(2)}cqi`;
  }

  override render(): TemplateResult {
    if (this.coverUrl !== undefined && !this.failed) {
      return html`<div class="cover" role="img" aria-label=${this.name}>
        <img
          class="art-img"
          src=${this.coverUrl}
          alt=""
          @error=${() => {
            this.failed = true;
          }}
        />
      </div>`;
    }
    const p = coverPalette(this.titleId || this.name);
    const thumb = thumbnailUrl(this.thumbnail);
    const icon = thumb !== undefined;
    return html`<div
      class="cover art"
      role="img"
      aria-label=${this.name}
      style=${styleMap({ '--c1': p.c1, '--c2': p.c2, '--c3': p.c3, '--c4': p.c4, '--angle': p.angle, '--ts': this.nameSize(icon) })}
    >
      <div class="band"></div>
      ${icon ? html`<img class="icon" src=${thumb} alt="" />` : nothing}
      <div class="name">${this.name}</div>
      <div class="pub">${this.publisher ?? ''}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'title-cover': TitleCover;
  }
}
