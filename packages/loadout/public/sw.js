// Loadout's service worker exists only so the page can tell a hard refresh from a
// normal reload (docs/features.md, §1). It caches nothing and handles no fetches:
// browsers bypass service workers on a hard refresh, so afterwards the page has an
// active registration but no controller.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
