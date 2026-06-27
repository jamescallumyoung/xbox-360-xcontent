import { LitElement, html, css, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import '@shoelace-style/shoelace/dist/components/button/button.js'
import type { XContentHeader } from 'xcontent-web'
import { parseHeader } from 'xcontent-web'
import { showToast } from '../utils/toast.js'

// Must cover both thumbnails: secondary thumbnail (v1) ends at 0x571A + 0x4000 = 0x971A (~38.7 KB)
const READ_SIZE = 0xA000

function thumbnailToDataUrl(bytes: Uint8Array): string {
  const type = bytes[0] === 0x89 ? 'image/png' : 'image/jpeg'
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:${type};base64,${btoa(binary)}`
}

@customElement('header-inspector')
export class HeaderInspector extends LitElement {
  static styles = css`
    :host { display: block; }

    .instructions {
      padding: 1rem 1.25rem;
      background: var(--app-surface-bg);
      border: 1px solid var(--app-surface-border);
      border-radius: 8px;
      backdrop-filter: var(--app-blur);
      -webkit-backdrop-filter: var(--app-blur);
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--sl-color-neutral-700);
      margin-bottom: 1.25rem;
    }
    .instructions p { margin: 0 0 0.5rem; }
    .instructions p:last-child { margin: 0; }

    code {
      background: rgba(139, 92, 246, 0.12);
      border: 1px solid rgba(139, 92, 246, 0.2);
      padding: 1px 5px;
      border-radius: 3px;
      color: var(--sl-color-primary-400);
      font-size: 0.8em;
    }

    table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 0.875rem;
      background: var(--app-surface-bg);
      border: 1px solid var(--app-surface-border);
      border-radius: 8px;
      overflow: hidden;
      backdrop-filter: var(--app-blur);
      -webkit-backdrop-filter: var(--app-blur);
    }

    th, td {
      padding: 0.6rem 1.25rem;
      text-align: left;
      border-bottom: 1px solid rgba(139, 92, 246, 0.08);
      vertical-align: top;
    }

    tr:last-child th, tr:last-child td { border-bottom: none; }
    tr:hover td, tr:hover th { background: rgba(139, 92, 246, 0.04); }

    th {
      width: 10rem;
      color: var(--sl-color-neutral-500);
      font-weight: 500;
      white-space: nowrap;
    }

    td {
      color: var(--sl-color-neutral-900);
      overflow-wrap: break-word;
    }

    .mono {
      font-family: var(--sl-font-mono);
    }

    .null { color: var(--sl-color-neutral-400); font-style: italic; }

    .name-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .name-list li + li { margin-top: 0.25rem; }

    .thumbnail { max-width: 128px; max-height: 128px; border-radius: 4px; display: block; }
  `

  @state() private header: XContentHeader | null = null

  private async pickFile() {
    const picker = window as Window & { showOpenFilePicker?(): Promise<FileSystemFileHandle[]> }
    if (!picker.showOpenFilePicker) {
      showToast('File picker not supported in this browser. Use Chrome or Edge.', 'danger')
      return
    }
    try {
      const [fileHandle] = await picker.showOpenFilePicker()
      const file = await fileHandle.getFile()
      const buffer = await file.slice(0, READ_SIZE).arrayBuffer()
      const result = parseHeader(new Uint8Array(buffer))
      if (result.success) {
        this.header = result.header
      } else {
        this.header = null
        showToast('Not a valid XContent file — no recognised magic bytes or required fields are missing.', 'danger')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      this.header = null
      showToast('Failed to read the selected file.', 'danger')
    }
  }

  private renderThumbnail(bytes: Uint8Array | null) {
    if (bytes === null) return html`<span class="null">None</span>`
    const url = thumbnailToDataUrl(bytes)
    return html`<img class="thumbnail" src=${url} alt="thumbnail" />`
  }

  private renderNameList(names: string[]) {
    if (names.length === 0) return html`<span class="null">None</span>`
    if (names.length === 1) return html`${names[0]}`
    return html`<ul class="name-list">${names.map(n => html`<li>${n}</li>`)}</ul>`
  }

  private renderHeader(h: XContentHeader) {
    const contentTypeHex = `0x${h.contentType.toString(16).toUpperCase().padStart(8, '0')}`
    const transferFlagsHex = `0x${h.transferFlags.toString(16).toUpperCase().padStart(2, '0')}`
    return html`
      <table>
        <tbody>
          <tr><th>Magic</th><td>${h.magic}</td></tr>
          <tr><th>Content Type</th><td>${h.contentTypeName} <span class="mono">(${contentTypeHex})</span></td></tr>
          <tr><th>Title ID</th><td><span class="mono">${h.titleIdHex}</span></td></tr>
          <tr><th>Metadata Version</th><td>${h.metadataVersion}</td></tr>
          <tr><th>Title Name</th><td>${h.titleName || html`<span class="null">—</span>`}</td></tr>
          <tr><th>Publisher</th><td>${h.publisherName || html`<span class="null">—</span>`}</td></tr>
          <tr><th>Display Names</th><td>${this.renderNameList(h.displayNames)}</td></tr>
          <tr><th>Descriptions</th><td>${this.renderNameList(h.displayDescriptions)}</td></tr>
          <tr><th>Transfer Flags</th><td><span class="mono">${transferFlagsHex}</span></td></tr>
          ${h.consoleId !== null ? html`<tr><th>Console ID</th><td><span class="mono">${h.consoleId}</span></td></tr>` : nothing}
          ${h.consoleType !== null ? html`<tr><th>Console Type</th><td>${h.consoleType}</td></tr>` : nothing}
          <tr><th>Thumbnail</th><td>${this.renderThumbnail(h.thumbnail)}</td></tr>
          <tr><th>Secondary Thumbnail</th><td>${this.renderThumbnail(h.secondaryThumbnail)}</td></tr>
        </tbody>
      </table>
    `
  }

  render() {
    return html`
      <div class="instructions">
        <p>Select any XContent file from your Xbox 360's <code>Content/</code> directory to inspect its header metadata.</p>
        <p>XContent files have no extension — they are the header files found inside title and content-type subdirectories, such as <code>Content/0000000000000000/4D530808/00007000/SomeGame</code>.</p>
      </div>

      <sl-button @click=${this.pickFile}>Select file</sl-button>

      ${this.header ? html`<div style="margin-top:1.25rem">${this.renderHeader(this.header)}</div>` : nothing}
    `
  }
}
