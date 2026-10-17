// Builders for the domain objects the pure src/lib/ modules work on.

import type { Package, Title } from '../../types.js';

export const PUBLIC = '0000000000000000';

/** A package of title `4D5307E6`, content type `00007000`, with any field overridden. */
export function pkg(
  overrides: Partial<Package> & { titleId?: string; contentType?: string; packageName?: string } = {},
): Package {
  const { titleId = '4D5307E6', contentType = '00007000', packageName = 'PKG', ...rest } = overrides;
  return {
    location: { partition: PUBLIC, titleId, contentType, packageName },
    kind: 'game',
    name: packageName,
    contentId: 'AA'.repeat(20),
    format: 'stfs',
    headerFileBytes: 1000,
    dataFilesBytes: 0,
    lastModified: 0,
    corrupt: false,
    ...rest,
  };
}

/** A title holding `packages`, which take their Title ID from it. */
export function title(titleId: string, overrides: Partial<Title> = {}, packages: Package[] = []): Title {
  return {
    titleId,
    name: `Title ${titleId}`,
    publisher: null,
    thumbnail: null,
    addedAt: 0,
    packages: packages.map((p) => ({ ...p, location: { ...p.location, titleId } })),
    ...overrides,
  };
}
