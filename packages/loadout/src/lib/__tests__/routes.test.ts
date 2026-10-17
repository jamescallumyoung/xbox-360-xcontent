import { describe, expect, it } from 'vitest';
import { parseRoute, routeUrl, type Route } from '../routes.js';

describe('routeUrl', () => {
  it('gives each page a hash URL (RT1.1)', () => {
    expect(routeUrl({ page: 'discover' })).toBe('#/discover');
    expect(routeUrl({ page: 'queue' })).toBe('#/queue');
    expect(routeUrl({ page: 'drive' })).toBe('#/drive');
    expect(routeUrl({ page: 'settings' })).toBe('#/settings');
    expect(routeUrl({ page: 'manage', titleId: '4D5307E6' })).toBe('#/title/4D5307E6');
  });

  it("puts the Library's filters and sort in its query (RT1.2)", () => {
    expect(routeUrl({ page: 'library', filters: {}, sort: 'name' })).toBe('#/library');
    expect(
      routeUrl({
        page: 'library',
        filters: { status: 'queued', gameType: 'Other', hasTitleUpdate: true, hasDlc: true, hasOtherContent: true },
        sort: 'added-desc',
      }),
    ).toBe('#/library?status=queued&type=other&tu=1&dlc=1&other=1&sort=added-desc');
  });
});

describe('parseRoute', () => {
  it('round-trips every route (RT1.3)', () => {
    const routes: Route[] = [
      { page: 'discover' },
      { page: 'queue' },
      { page: 'drive' },
      { page: 'settings' },
      { page: 'manage', titleId: '4D5307E6' },
      { page: 'library', filters: {}, sort: 'name' },
      { page: 'library', filters: { status: 'on-drive', gameType: 'GOD' }, sort: 'size-desc' },
      { page: 'library', filters: { status: 'not-on-drive', hasDlc: true }, sort: 'added-asc' },
    ];
    for (const route of routes) expect(parseRoute(routeUrl(route))).toEqual(route);
  });

  it('reads the hash of a whole URL, under any path (RT1.3)', () => {
    expect(parseRoute('https://example.com/loadout/#/library?sort=added-desc')).toEqual({
      page: 'library',
      filters: {},
      sort: 'added-desc',
    });
  });

  it('ignores unknown filter values, and a "has" flag other than 1 (RT1.4)', () => {
    expect(parseRoute('#/library?status=bogus&type=x&sort=nope&saves=1&tu=0&dlc=&other=1')).toEqual({
      page: 'library',
      filters: { hasOtherContent: true },
      sort: 'name',
    });
    expect(parseRoute('#/library?sort=toString')).toMatchObject({ sort: 'name' });
  });

  it('gives null for no route, or an unknown or malformed one (RT1.5)', () => {
    for (const url of ['', '#', '#/', '#/nowhere', '#/title/', '#/title/xyz', 'https://example.com/']) {
      expect(parseRoute(url)).toBeNull();
    }
  });
});
