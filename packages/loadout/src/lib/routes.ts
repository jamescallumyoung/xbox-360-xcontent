// Hash URLs for the app's pages (docs/lib-design.md, RT1). A hash works under any
// path, such as /loadout/, and on any static server, so a reload keeps it.

import { TITLE_SORTS, type TitleFilters, type TitleSort } from './types.js';

export type Route =
  | { page: 'discover' | 'queue' | 'drive' | 'settings' }
  | { page: 'library'; filters: TitleFilters; sort: TitleSort }
  | { page: 'manage'; titleId: string };

const SIMPLE = ['discover', 'queue', 'drive', 'settings'] as const;
const TITLE_ID = /^[0-9A-F]{8}$/;

/** A route's URL: `#/<page>`, `#/library?<filters>`, or `#/title/<TitleID>` (RT1.1, RT1.2). */
export function routeUrl(route: Route): string {
  if (route.page === 'manage') return `#/title/${route.titleId}`;
  if (route.page !== 'library') return `#/${route.page}`;
  const { filters: f, sort } = route;
  const q = new URLSearchParams();
  if (f.status !== undefined && f.status !== 'all') q.set('status', f.status);
  if (f.gameType !== undefined) q.set('type', f.gameType === 'GOD' ? 'god' : 'other');
  if (f.hasTitleUpdate === true) q.set('tu', '1');
  if (f.hasDlc === true) q.set('dlc', '1');
  if (f.hasOtherContent === true) q.set('other', '1');
  if (sort !== 'name') q.set('sort', sort);
  const query = q.toString();
  return query === '' ? '#/library' : `#/library?${query}`;
}

/** Reads a route from a URL's hash, or `null` when there's none, or it's unknown (RT1.3-RT1.5). */
export function parseRoute(url: string): Route | null {
  const hash = url.slice(url.indexOf('#') + 1);
  if (!url.includes('#') || !hash.startsWith('/')) return null;
  const [path = '', query = ''] = hash.slice(1).split('?');
  const simple = SIMPLE.find((page) => page === path);
  if (simple !== undefined) return { page: simple };
  if (path.startsWith('title/')) {
    const titleId = path.slice('title/'.length);
    return TITLE_ID.test(titleId) ? { page: 'manage', titleId } : null;
  }
  if (path !== 'library') return null;
  const q = new URLSearchParams(query);
  const filters: TitleFilters = {};
  const status = q.get('status');
  if (status === 'on-drive' || status === 'not-on-drive' || status === 'queued') filters.status = status;
  const type = q.get('type');
  if (type === 'god') filters.gameType = 'GOD';
  if (type === 'other') filters.gameType = 'Other';
  if (q.get('tu') === '1') filters.hasTitleUpdate = true;
  if (q.get('dlc') === '1') filters.hasDlc = true;
  if (q.get('other') === '1') filters.hasOtherContent = true;
  const sort = TITLE_SORTS.find((s) => s === q.get('sort')) ?? 'name';
  return { page: 'library', filters, sort };
}
