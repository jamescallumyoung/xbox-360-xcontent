import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/badge/badge.js'
import type { TitleXContent, ContentTypeName } from 'xcontent-web'

const GAME_FORMAT_LABELS: Partial<Record<ContentTypeName, string>> = {
  GameOnDemand: 'GOD',
  ArcadeGame: 'XBLA',
  XNA: 'XNA',
  Xbox360Title: 'Title',
  InstalledGame: 'Installed',
  XboxOriginalGame: 'OG Xbox',
  CommunityGame: 'Community',
}

const GAME_FORMAT_NAMES = new Set(Object.keys(GAME_FORMAT_LABELS) as ContentTypeName[])

@customElement('title-row')
export class TitleRow extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid rgba(139, 92, 246, 0.08);
    }
    :host(:last-child) { border-bottom: none; }
    :host(:hover) { background: rgba(139, 92, 246, 0.04); }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .meta { min-width: 0; flex: 1; }
    .name {
      font-size: 0.9rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--sl-color-neutral-900);
    }
    .title-id {
      font-size: 0.7rem;
      font-family: var(--sl-font-mono);
      color: var(--sl-color-neutral-500);
      margin-top: 2px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      justify-content: flex-end;
      flex-shrink: 0;
    }
  `

  @property({ attribute: false }) item!: TitleXContent

  render() {
    const t = this.item

    const gameFormats = [...t.contentTypes].filter(ct => GAME_FORMAT_NAMES.has(ct))

    return html`
      <div class="row">
        <div class="meta">
          <div class="name">${t.displayName}</div>
          <div class="title-id">${t.titleIdHex}</div>
        </div>
        <div class="badges">
          ${gameFormats.map(ct => html`
            <sl-badge variant="primary">${GAME_FORMAT_LABELS[ct]}</sl-badge>
          `)}
          ${t.hasTitleUpdate ? html`<sl-badge variant="neutral">TU</sl-badge>` : ''}
          ${t.hasDlc ? html`<sl-badge variant="neutral">DLC</sl-badge>` : ''}
          ${t.hasSaves ? html`<sl-badge variant="neutral">Saves</sl-badge>` : ''}
          ${t.hasOtherContent ? html`<sl-badge variant="neutral">Other</sl-badge>` : ''}
          ${t.hasCorruptContent ? html`<sl-badge variant="danger">Corrupt</sl-badge>` : ''}
          ${[...t.signingTypes].map(magic => html`
            <sl-badge variant=${magic === 'LIVE' ? 'success' : magic === 'CON' ? 'warning' : 'neutral'}>
              ${magic}
            </sl-badge>
          `)}
        </div>
      </div>
    `
  }
}
