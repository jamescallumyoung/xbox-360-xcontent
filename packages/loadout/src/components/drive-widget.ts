import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base, buttons, spinner } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { formatSize } from '../lib/titles.js';
import type { DriveSummary, FolderHealth } from '../lib/types.js';

export type DriveWidgetMode = 'mini' | 'full';

const PUBLIC = '0000000000000000';

// Box-drawing characters for the file tree, kept out of the source as code points.
const DASH = String.fromCodePoint(0x2500);
const LAST = `${String.fromCodePoint(0x2514)}${DASH} `;
const MID = `${String.fromCodePoint(0x251c)}${DASH} `;

/**
 * The external drive at a glance: a hero title count, its directory name, connection
 * health, a rescan action, and a usage bar (titles vs queued).
 * The browser can't read the drive's volume name, mount path, file system or capacity,
 * so none of those are shown: the heading is simply "Drive".
 * `full` mode adds the file tree of the public partition.
 *
 * @fires rescan - the Rescan button was clicked
 */
@customElement('drive-widget')
export class DriveWidget extends LitElement {
  static override styles = [
    base,
    buttons,
    spinner,
    css`
      :host {
        display: block;
      }
      .card {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 0.9rem;
        background:
          radial-gradient(ellipse 40% 90% at 0% 0%, rgba(99, 102, 241, 0.28), transparent 70%),
          linear-gradient(110deg, rgba(79, 70, 229, 0.2), rgba(31, 41, 55, 0.9) 48%), var(--panel);
        padding: 1.5rem 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 1.4rem;
      }
      :host([mode='mini']) .card {
        padding: 1.25rem 1.5rem;
        gap: 1.15rem;
      }

      /* identity row: hero, then name and path */
      .identity {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0 1.6rem;
        align-items: center;
      }
      .hero {
        padding-right: 1.6rem;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
      }
      .info {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
      }
      .big {
        font-size: 3.4rem;
        font-weight: 800;
        line-height: 0.95;
        letter-spacing: -0.04em;
        background: linear-gradient(160deg, #fff 10%, #c7d2fe 55%, var(--accent-2));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        font-variant-numeric: tabular-nums;
      }
      :host([mode='mini']) .big {
        font-size: 2.8rem;
      }
      .cap-label {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--accent-text);
      }
      .sub-count {
        font-size: 0.78rem;
        color: var(--muted);
        margin-top: 0.3rem;
      }
      .sub-count b {
        color: var(--fg-2);
        font-weight: 600;
      }
      .count {
        display: flex;
        flex-direction: column;
      }
      .count .cap-label {
        margin-top: 0.35rem;
      }

      .name-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      h2 {
        margin: 0;
        color: var(--fg);
        font-size: 1.3rem;
        font-weight: 700;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }
      .health {
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 999px;
        display: grid;
        place-items: center;
        border: 1px solid;
        flex: none;
      }
      .health svg {
        width: 0.95rem;
        height: 0.95rem;
      }
      .health.connected {
        background: var(--ok-soft);
        color: var(--ok);
        border-color: rgba(34, 197, 94, 0.4);
      }
      .health.disconnected {
        background: var(--warn-soft);
        color: var(--warn-text);
        border-color: rgba(234, 179, 8, 0.4);
      }
      .health.error {
        background: var(--bad-soft);
        color: var(--bad-text);
        border-color: rgba(239, 68, 68, 0.45);
      }
      .health.scanning {
        background: var(--accent-soft);
        color: var(--accent-text);
        border-color: rgba(99, 102, 241, 0.5);
      }
      .health .spin {
        width: 0.8rem;
        height: 0.8rem;
      }
      .dir-row {
        font-size: 0.82rem;
        color: var(--muted);
        overflow-wrap: anywhere;
      }
      .dir-row .mono {
        color: var(--fg-2);
        font-size: 0.78rem;
      }
      .problem {
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        padding: 0.6rem 0.8rem;
        border-radius: 0.55rem;
        font-size: 0.82rem;
        line-height: 1.45;
      }
      .problem svg {
        width: 1rem;
        height: 1rem;
        flex: none;
        margin-top: 0.1rem;
      }
      .problem.disconnected {
        background: var(--warn-soft);
        color: var(--warn-text);
        border: 1px solid rgba(234, 179, 8, 0.35);
      }
      .problem.error {
        background: var(--bad-soft);
        color: var(--bad-text);
        border: 1px solid rgba(239, 68, 68, 0.4);
      }

      /* usage */
      .cap {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }
      .bar {
        height: 0.7rem;
        border-radius: 999px;
        background: var(--bg-deep);
        border: 1px solid var(--line);
        overflow: hidden;
        display: flex;
      }
      .bar i {
        display: block;
        height: 100%;
      }
      .g {
        background: var(--ok);
      }
      .q {
        background: repeating-linear-gradient(45deg, var(--accent), var(--accent) 6px, #818cf8 6px, #818cf8 12px);
      }
      .legend-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1.1rem;
        font-size: 0.8rem;
        color: var(--muted);
      }
      .legend-row span {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }
      .legend-row i {
        width: 0.6rem;
        height: 0.6rem;
        border-radius: 2px;
        display: inline-block;
      }
      .legend-row b {
        color: var(--fg-2);
        font-weight: 600;
      }
      .legend-row .free {
        margin-left: auto;
      }

      /* file tree */
      .tree {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--muted);
        line-height: 1.65;
        background: rgba(11, 17, 28, 0.75);
        border: 1px solid var(--line);
        border-radius: 0.55rem;
        padding: 0.85rem 1rem;
        overflow: auto;
        max-height: 20rem;
        white-space: pre;
        margin: 0;
      }
      .tree .dir {
        color: var(--accent-text);
      }
      .tree .tid {
        color: var(--fg-2);
      }
      .tree .nm {
        color: var(--faint);
      }

      @media (max-width: 640px) {
        .card {
          padding: 1.15rem;
        }
        .identity {
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        .hero {
          border-right: 0;
          padding-right: 0;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .legend-row .free {
          margin-left: 0;
          width: 100%;
        }
      }
    `,
  ];

  /** The chosen folder's own name: all the browser reveals. */
  @property() accessor name = '';
  @property({ attribute: false }) accessor summary: DriveSummary = { playable: 0, other: 0, bytes: 0, entries: [] };
  /** Size of queued adds. */
  @property({ type: Number, attribute: 'queued-bytes' }) accessor queuedBytes = 0;
  /** Size of queued removals. */
  @property({ type: Number, attribute: 'remove-bytes' }) accessor removeBytes = 0;
  @property({ reflect: true }) accessor mode: DriveWidgetMode = 'full';
  /** True while a rescan is running. */
  @property({ type: Boolean }) accessor scanning = false;
  /** True while an apply runs: no rescan meanwhile. */
  @property({ type: Boolean }) accessor busy = false;
  /** Whether the drive can be used right now. */
  @property({ attribute: false }) accessor health: FolderHealth = { state: 'connected' };

  private renderCount() {
    const { playable, other } = this.summary;
    return html`<div class="count">
      <div class="big">${playable}</div>
      <div class="cap-label">Playable titles</div>
      <div class="sub-count">+ <b>${other}</b> other title${other === 1 ? '' : 's'}</div>
    </div>`;
  }

  /** Proportion bar: titles on the drive vs queued adds. The browser can't read capacity. */
  private renderUsage() {
    const used = this.summary.bytes;
    const queued = this.queuedBytes;
    const total = used + queued;
    const pct = (v: number) => `${total > 0 ? ((v / total) * 100).toFixed(2) : '0'}%`;
    return html`<div class="cap">
      <div class="bar" role="img" aria-label="${formatSize(used)} of titles, ${formatSize(queued)} queued">
        <i class="g" style="width:${pct(used)}"></i><i class="q" style="width:${pct(queued)}"></i>
      </div>
      <div class="legend-row num">
        <span><i class="g"></i>Titles <b>${formatSize(used)}</b></span>
        <span><i class="q"></i>Queued <b>+${formatSize(queued)}</b></span>
        ${
          this.removeBytes > 0
            ? html`<span class="free">To remove <b>&minus;${formatSize(this.removeBytes)}</b></span>`
            : nothing
        }
      </div>
    </div>`;
  }

  /**
   * The public partition's titles, under the chosen folder's name. It's a <pre>,
   * so the characters that draw it are in interpolations, where Prettier leaves
   * them alone.
   */
  private renderTree() {
    const entries = this.summary.entries;
    const newline = '\n';
    const lines: TemplateResult[] = [html`<span class="dir">${this.name}/</span>${newline}`];
    if (entries.length > 0) lines.push(html`${LAST}<span class="dir">${PUBLIC}/</span>${newline}`);
    entries.forEach((e, i) => {
      const branch = `   ${i === entries.length - 1 ? LAST : MID}`;
      lines.push(
        html`${branch}<span class="tid">${e.titleId}</span>${'   '}<span class="nm">${e.name}</span>${newline}`,
      );
    });
    return html`<pre class="tree" aria-label="Files on the drive">${lines}</pre>`;
  }

  private renderHealth() {
    const h = this.health;
    if (this.scanning) return html`<span class="health scanning" title="Rescanning"><span class="spin"></span></span>`;
    if (h.state === 'connected') {
      return html`<span class="health connected" title="Connected" aria-label="Connected">${icon('check')}</span>`;
    }
    const label = h.state === 'error' ? 'Error' : 'Disconnected';
    return html`<span class="health ${h.state}" title=${label} aria-label=${label}
      >${icon(h.state === 'error' ? 'alert' : 'x')}</span
    >`;
  }

  override render(): TemplateResult {
    const h = this.health;
    return html`<section class="card" aria-label="External drive">
      <div class="identity">
        <div class="hero">${this.renderCount()}</div>
        <div class="info">
          <div class="name-row">
            <h2>Drive</h2>
            <div class="actions">
              ${this.renderHealth()}
              <button
                class="btn sm"
                ?disabled=${this.scanning || this.busy || h.state !== 'connected'}
                @click=${() => this.dispatchEvent(new CustomEvent('rescan'))}
              >
                ${icon('refresh')}${this.scanning ? 'Rescanning...' : 'Rescan drive'}
              </button>
            </div>
          </div>
          <div class="dir-row">Directory name: <span class="mono">${this.name}</span></div>
        </div>
      </div>
      ${
        h.state === 'connected'
          ? nothing
          : html`<div class="problem ${h.state}" role="alert">${icon('alert')}<span>${h.message}</span></div>`
      }
      ${this.renderUsage()} ${this.mode === 'full' ? this.renderTree() : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'drive-widget': DriveWidget;
  }
}
