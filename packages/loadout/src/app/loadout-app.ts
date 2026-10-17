import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** The app shell. Stage 1 placeholder: it proves the toolchain handles standard decorators. */
@customElement('loadout-app')
export class LoadoutApp extends LitElement {
  @property() accessor heading = 'Loadout';

  override render() {
    return html`<h1>${this.heading}</h1>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'loadout-app': LoadoutApp;
  }
}
