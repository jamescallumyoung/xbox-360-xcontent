// Opens the tab's session at start-up: detects a hard refresh, registers the
// service worker that makes that detection work, and watches for the keyboard
// shortcut (docs/features.md, §1). Browser glue, checked by hand. Call it once.

import { FLAG_KEY, isHardRefresh, openSession, readFlag, type Session } from '../lib/session.js';
import { idbStore } from './idb.js';

export async function startSession(): Promise<Session> {
  const tab = sessionStorage;
  addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === 'KeyR') {
      tab.setItem(FLAG_KEY, String(Date.now()));
    }
  });

  // Read before any await, so a worker claiming the page meanwhile can't change it.
  const workers = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
  const controlled = workers?.controller != null;
  // The registration covering this page. Before Loadout's own worker is installed
  // that may be the old app's, at the site root: either works for the check, since
  // both control their pages on a normal load and neither on a hard refresh.
  const registration = await workers?.getRegistration('./').catch(() => undefined);
  const fresh = isHardRefresh({
    registered: registration?.active != null,
    controlled,
    flaggedAt: readFlag(tab),
    now: Date.now(),
  });
  // Relative, so its scope is Loadout's own folder (such as /loadout/ on Pages).
  workers?.register('./sw.js').catch((error: unknown) => {
    console.warn('Loadout could not register its service worker.', error);
  });
  return openSession(tab, idbStore(), { fresh });
}
