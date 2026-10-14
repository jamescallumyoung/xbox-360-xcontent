import { readdirSync, readFileSync } from 'node:fs'

// Test-only access to the real-header fixtures in src/__tests__/fixtures/.
// Fixture files have no extension; every other file in that folder (the
// manifest and its generator) has one.

const FIXTURES = new URL('../fixtures/', import.meta.url)

export const FIXTURE_NAMES = [
  'con-971a-mv0-download-in-progress',
  'con-971a-mv2-xna-save',
  'con-ad0e-svod-disc-install',
  'live-stfs-dlc-halo-wars',
  'live-stfs-dlc-non-ascii',
  'live-stfs-mv0-title-update',
  'live-svod-god-dead-island-riptide',
  'live-svod-god-empty-signature',
  'live-svod-god-south-park-mojibake',
  'pirs-stfs-avatar-item-no-thumbnail',
  'pirs-stfs-dlc-non-ascii',
] as const

export type FixtureName = (typeof FIXTURE_NAMES)[number]

/** Reads a fixture's bytes. */
export function loadFixture(name: FixtureName): Uint8Array {
  return new Uint8Array(readFileSync(new URL(name, FIXTURES)))
}

/** Lists the fixture files actually in the folder. */
export function fixtureFilesOnDisk(): string[] {
  return readdirSync(FIXTURES).filter(file => !file.includes('.')).sort()
}
