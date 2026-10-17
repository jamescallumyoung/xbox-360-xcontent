// The app's one store, and the controller that re-renders a Lit element when it
// changes.

import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { LoadoutStore } from './store.js';

export const store = new LoadoutStore();

/** Re-renders `host` whenever the store emits `change`. */
export class StoreController implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private readonly onChange = (): void => {
    this.host.requestUpdate();
  };

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    store.addEventListener('change', this.onChange);
  }

  hostDisconnected(): void {
    store.removeEventListener('change', this.onChange);
  }
}
