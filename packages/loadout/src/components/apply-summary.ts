import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { base, buttons } from '../styles/shared.js';
import { icon } from '../styles/icons.js';
import { formatSize } from '../lib/titles.js';
import { reportFileName, reportJson, type ApplyReport } from '../lib/report.js';
import type { ReportSaveState } from '../app/store.js';

/**
 * Shown when an apply finishes: the end of the workflow, so it interrupts on purpose.
 * Summarises the changes and offers the report as JSON, downloaded or saved to the drive.
 *
 * @fires close
 * @fires download
 * @fires save-to-drive - open the browser's save dialog, starting on the drive
 */
@customElement('apply-summary')
export class ApplySummary extends LitElement {
  static override styles = [
    base,
    buttons,
    css`
      dialog {
        border: 1px solid var(--line);
        border-radius: 1rem;
        padding: 0;
        width: min(38rem, calc(100vw - 2rem));
        max-height: calc(100dvh - 2rem);
        background: var(--panel);
        color: var(--fg-2);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.65);
      }
      dialog[open] {
        display: flex;
        flex-direction: column;
      }
      dialog::backdrop {
        background: rgba(3, 7, 18, 0.75);
        backdrop-filter: blur(5px);
      }
      .head {
        padding: 1.6rem 1.6rem 1.2rem;
        display: flex;
        gap: 1rem;
        align-items: center;
        background: radial-gradient(ellipse 70% 120% at 0% 0%, rgba(34, 197, 94, 0.22), transparent 70%);
      }
      .head.stopped {
        background: radial-gradient(ellipse 70% 120% at 0% 0%, rgba(234, 179, 8, 0.22), transparent 70%);
      }
      .head.stopped .tick {
        background: linear-gradient(135deg, #eab308, #a16207);
        box-shadow: 0 0 0 6px rgba(234, 179, 8, 0.15);
      }
      .lead .warn {
        color: var(--warn-text);
        font-weight: 600;
      }
      .tick {
        width: 3.2rem;
        height: 3.2rem;
        border-radius: 999px;
        flex: none;
        display: grid;
        place-items: center;
        color: #fff;
        background: linear-gradient(135deg, #22c55e, #15803d);
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.15);
      }
      .tick svg {
        width: 1.7rem;
        height: 1.7rem;
        stroke-width: 2.6;
      }
      h2 {
        margin: 0;
        color: var(--fg);
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .lead {
        margin: 0.25rem 0 0;
        color: var(--muted);
        font-size: 0.875rem;
        line-height: 1.5;
      }
      .scroll {
        overflow-y: auto;
        min-height: 0;
        padding: 0 1.6rem 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.6rem;
      }
      .stat {
        padding: 0.7rem 0.85rem;
        border-radius: 0.6rem;
        background: var(--bg);
        border: 1px solid var(--line);
      }
      .stat .v {
        font-size: 1.2rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--fg);
      }
      .stat .v.plus {
        color: var(--ok-text);
      }
      .stat .v.minus {
        color: var(--bad-text);
      }
      .stat .k {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: var(--faint);
      }
      .list {
        flex: none;
        border: 1px solid var(--line);
        border-radius: 0.6rem;
        max-height: 15rem;
        overflow-y: auto;
      }
      .t {
        padding: 0.55rem 0.85rem;
        border-bottom: 1px solid var(--line-soft);
      }
      .t:last-child {
        border-bottom: 0;
      }
      .t .n {
        color: var(--fg);
        font-weight: 600;
        font-size: 0.85rem;
      }
      .t .n .mono {
        color: var(--faint);
        font-weight: 400;
        margin-left: 0.4rem;
      }
      .c {
        display: grid;
        grid-template-columns: 1rem minmax(0, 1fr) auto;
        gap: 0.5rem;
        font-size: 0.8rem;
        padding-top: 0.2rem;
      }
      .c .s {
        font-family: var(--font-mono);
        font-weight: 700;
        text-align: center;
      }
      .c.add .s {
        color: var(--ok);
      }
      .c.remove .s {
        color: var(--bad);
      }
      .c .nm {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .c .sz {
        font-variant-numeric: tabular-nums;
        color: var(--muted);
      }
      .report {
        flex: none;
        padding: 1rem;
        border-radius: 0.7rem;
        background: var(--bg-deep);
        border: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
      }
      .report h3 {
        margin: 0;
        color: var(--fg);
        font-size: 0.95rem;
      }
      .report p {
        margin: 0;
        font-size: 0.8rem;
        color: var(--muted);
        line-height: 1.5;
      }
      .report .fname {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--accent-text);
        overflow-wrap: anywhere;
      }
      .btns {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .msg {
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        font-size: 0.8rem;
        line-height: 1.5;
        padding: 0.55rem 0.7rem;
        border-radius: 0.5rem;
      }
      .msg svg {
        width: 1rem;
        height: 1rem;
        flex: none;
        margin-top: 0.1rem;
      }
      .msg.ok {
        background: var(--ok-soft);
        color: var(--ok-text);
      }
      .msg.bad {
        background: var(--bad-soft);
        color: var(--bad-text);
      }
      .msg.info {
        background: var(--accent-soft);
        color: var(--accent-text);
      }
      .msg .mono {
        color: #fff;
        overflow-wrap: anywhere;
      }
      pre {
        margin: 0;
        max-height: 12rem;
        overflow: auto;
        font-family: var(--font-mono);
        font-size: 0.7rem;
        line-height: 1.5;
        color: var(--fg-2);
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 0.5rem;
        padding: 0.7rem 0.8rem;
      }
      .link {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 3px;
        align-self: flex-start;
      }
      .link:hover {
        color: var(--fg);
      }
      footer {
        padding: 1rem 1.6rem;
        border-top: 1px solid var(--line);
        background: var(--bg-deep);
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        flex-wrap: wrap;
      }
      footer .note {
        font-size: 0.8rem;
        color: var(--muted);
      }
      @media (max-width: 520px) {
        .head,
        .scroll,
        footer {
          padding-left: 1.1rem;
          padding-right: 1.1rem;
        }
        .stat {
          padding: 0.6rem 0.65rem;
        }
        .stat .v {
          font-size: 1rem;
        }
        .btns .btn,
        footer .btn {
          flex: 1;
        }
      }
    `,
  ];

  @property({ attribute: false }) accessor report: ApplyReport | null = null;
  @property({ attribute: false }) accessor save: ReportSaveState = { state: 'idle' };
  /** Changes still queued: those a stopped apply didn't reach. */
  @property({ type: Number }) accessor remaining = 0;
  @state() private accessor showJson = false;
  @query('dialog') private accessor dialog!: HTMLDialogElement;

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('report')) this.showJson = false;
  }

  override updated(): void {
    if (this.report && !this.dialog.open) this.dialog.showModal();
    if (!this.report && this.dialog.open) this.dialog.close();
  }

  private fire(name: string): void {
    this.dispatchEvent(new CustomEvent(name));
  }

  private renderSaveStatus() {
    const s = this.save;
    switch (s.state) {
      case 'downloaded':
        return html`<div class="msg info" role="status">
          ${icon('info')}<span>Downloaded <span class="mono">${s.fileName}</span> to your downloads folder.</span>
        </div>`;
      case 'saved':
        return html`<div class="msg ok" role="status">
          ${icon('check')}<span
            >Saved <span class="mono">${s.fileName}</span>. Loadout didn't keep permission for that location.</span
          >
        </div>`;
      case 'refused':
        return html`<div class="msg bad" role="alert">
          ${icon('alert')}<span
            >Loadout can't save inside the drive's partition folder: it must only hold partitions. Choose the top level
            of the drive instead.</span
          >
        </div>`;
      default:
        return nothing;
    }
  }

  /** The header's text; for a stopped apply, the warning that only some changes were applied. */
  private lead(r: ApplyReport, took: string) {
    const n = r.summary.changes;
    const drive = html`the drive (directory name: ${r.drive.folderName})`;
    const eject = 'Eject the drive safely before you plug it into your console.';
    if (!r.stopped) return html`${n} change${n === 1 ? '' : 's'} to ${drive} in ${took}. ${eject}`;
    if (n === 0) return html`<span class="warn">You stopped the queue before any change was applied.</span>`;
    return html`<span class="warn"
        >You stopped the queue, but some changes were applied: ${n} change${n === 1 ? '' : 's'} to ${drive} in
        ${took}.</span
      >
      ${eject}`;
  }

  override render(): TemplateResult {
    const r = this.report;
    if (r === null) return html`<dialog></dialog>`;
    const titles = [...new Set(r.changes.map((c) => c.titleId))];
    const secs = r.durationSeconds;
    const took = secs >= 60 ? `${String(Math.floor(secs / 60))} min ${String(secs % 60)} s` : `${String(secs)} s`;
    return html`<dialog
      aria-labelledby="as-h"
      @cancel=${(e: Event) => {
        e.preventDefault();
        this.fire('close');
      }}
    >
      <div class="head ${r.stopped ? 'stopped' : ''}">
        <div class="tick" aria-hidden="true">${icon(r.stopped ? 'stop' : 'check')}</div>
        <div>
          <h2 id="as-h">${r.stopped ? 'Apply stopped' : 'All changes applied'}</h2>
          <p class="lead">${this.lead(r, took)}</p>
        </div>
      </div>
      <div class="scroll">
        <div class="stats">
          <div class="stat">
            <div class="v plus">${r.summary.added.count > 0 ? '+' : ''}${formatSize(r.summary.added.bytes)}</div>
            <div class="k">${r.summary.added.count} copied</div>
          </div>
          <div class="stat">
            <div class="v minus">
              ${r.summary.removed.count > 0 ? html`&minus;` : nothing}${formatSize(r.summary.removed.bytes)}
            </div>
            <div class="k">${r.summary.removed.count} removed</div>
          </div>
          <div class="stat">
            <div class="v">${r.summary.titles}</div>
            <div class="k">Title${r.summary.titles === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div class="list" aria-label="Changes made">
          ${titles.map((id) => {
            const cs = r.changes.filter((c) => c.titleId === id);
            return html`<div class="t">
              <div class="n">${cs[0]?.titleName ?? id}<span class="mono">${id}</span></div>
              ${cs.map(
                (c) =>
                  html`<div class="c ${c.op}">
                    <span class="s">${c.op === 'add' ? '+' : html`&minus;`}</span>
                    <span class="nm">${c.package.name}</span><span class="sz">${formatSize(c.package.bytes)}</span>
                  </div>`,
              )}
            </div>`;
          })}
        </div>
        <section class="report">
          <h3>Keep a record</h3>
          <p>A JSON file listing every change: titles, packages, content types, file paths and sizes.</p>
          <span class="fname">${reportFileName(r)}</span>
          <div class="btns">
            <button
              class="btn"
              @click=${() => {
                this.fire('download');
              }}
            >
              ${icon('logo')}Download JSON
            </button>
            <button
              class="btn"
              @click=${() => {
                this.fire('save-to-drive');
              }}
            >
              ${icon('drive')}Save to drive...
            </button>
          </div>
          <p>Saving to the drive asks for permission once, each time. Loadout doesn't keep it.</p>
          ${this.renderSaveStatus()}
          <button
            class="link"
            @click=${() => {
              this.showJson = !this.showJson;
            }}
          >
            ${this.showJson ? 'Hide' : 'Preview'} the JSON
          </button>
          ${this.showJson ? html`<pre>${reportJson(r)}</pre>` : nothing}
        </section>
      </div>
      <footer>
        <span class="note"
          >${
            this.remaining === 0
              ? 'The queue is now empty.'
              : `${String(this.remaining)} change${this.remaining === 1 ? ' is' : 's are'} still in the queue.`
          }</span
        >
        <button
          class="btn primary"
          @click=${() => {
            this.fire('close');
          }}
        >
          Done
        </button>
      </footer>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'apply-summary': ApplySummary;
  }
}
