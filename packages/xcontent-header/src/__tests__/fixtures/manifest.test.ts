import { describe, expect, it } from 'vitest';
import { FIXTURE_NAMES, fixtureFilesOnDisk, loadFixture } from '../helpers/load-fixture.js';
import { manifest } from './manifest.generated.js';

describe('fixture manifest', () => {
  it('has an entry for every fixture file, and a file for every entry', () => {
    expect(Object.keys(manifest).sort()).toEqual(fixtureFilesOnDisk());
  });

  it('lists the same fixtures as the loader', () => {
    expect([...FIXTURE_NAMES].sort()).toEqual(fixtureFilesOnDisk());
  });

  it("records each fixture's length correctly", () => {
    for (const name of FIXTURE_NAMES) {
      expect(loadFixture(name).length, name).toBe(manifest[name].fileLength);
    }
  });
});
