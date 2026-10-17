// May a removal be queued without a warning? (docs/lib-design.md, R1)

import type { Package, RemovalRisk } from './types.js';

/**
 * Compares the drive's copy of a package with the vault's copy at the same
 * location, if there is one.
 *
 * - `not-in-vault`: no vault copy, so a removal can't be undone (R1.1).
 * - `mismatch`: either copy is corrupt or has no content ID, or their content IDs
 *   differ (R1.2, R1.3).
 * - `none`: the content IDs match, so the vault can restore it (R1.4).
 *
 * This is a weaker stand-in for the planned fast-hash compare (X4, R1.5). The
 * content ID is a SHA-1 of the header (spec §6.3): equal IDs show the headers
 * match, which for an STFS package should mean the same contents, but for an SVOD
 * package says nothing about its data files beyond the first hash table (spec §7.5).
 */
export function removalRisk(vaultPackage: Package | undefined, drivePackage: Package): RemovalRisk {
  if (vaultPackage === undefined) return 'not-in-vault';
  const { contentId } = vaultPackage;
  if (vaultPackage.corrupt || drivePackage.corrupt || contentId === null) return 'mismatch';
  return contentId === drivePackage.contentId ? 'none' : 'mismatch';
}
