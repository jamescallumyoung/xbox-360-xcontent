import { describe, expect, it } from 'vitest';
import { manifest } from '../../__tests__/fixtures/manifest.generated.js';
import { buildHeader } from '../../__tests__/helpers/header-builder.js';
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js';
import { sha1Hex } from '../../__tests__/helpers/sha1.js';
import { parseThumbnail, parseThumbnailSizes, parseTitleThumbnail } from '../thumbnails.js';

const PNG_START = [0x89, 0x50, 0x4e, 0x47];

describe('parseThumbnailSizes (the /extended contract, 3)', () => {
  it('returns both declared sizes, from 0x1712 and 0x1716', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU32(0x1712, 0x1a76).setU32(0x1716, 0xf9b).bytes();
    expect(parseThumbnailSizes(bytes)).toMatchObject({ thumbnail: 0x1a76, titleThumbnail: 0xf9b });
  });

  it('returns the space available to each thumbnail: 0x4000 in metadata version 1, 0x3D00 in version 2', () => {
    expect(parseThumbnailSizes(buildHeader({ magic: 'LIVE', metadataVersion: 0 }).bytes()).availableSpace).toBe(0x4000);
    expect(parseThumbnailSizes(buildHeader({ magic: 'LIVE', metadataVersion: 2 }).bytes()).availableSpace).toBe(0x3d00);
  });

  it('returns sizes larger than the space as they are, so callers can check the precondition', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU32(0x1712, 0xffffffff).bytes();
    expect(parseThumbnailSizes(bytes).thumbnail).toBe(0xffffffff);
  });
});

describe('parseThumbnail and parseTitleThumbnail (R1.36-39)', () => {
  it('return exactly the declared number of bytes, from 0x171A and 0x571A (R1.36)', () => {
    const bytes = buildHeader({ magic: 'LIVE' })
      .setU32(0x1712, 6)
      .setBytes(0x171a, [...PNG_START, 1, 2, 3])
      .setU32(0x1716, 5)
      .setBytes(0x571a, [...PNG_START, 9, 9])
      .bytes();
    expect([...(parseThumbnail(bytes) ?? [])]).toEqual([...PNG_START, 1, 2]);
    expect([...(parseTitleThumbnail(bytes) ?? [])]).toEqual([...PNG_START, 9]);
  });

  it('return null when the declared size is 0 (R1.37)', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setBytes(0x171a, PNG_START).bytes();
    expect(parseThumbnail(bytes)).toBeNull();
    expect(parseTitleThumbnail(bytes)).toBeNull();
  });

  it('return copies, which do not change when the input does (R1.38)', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU32(0x1712, 4).setBytes(0x171a, PNG_START).bytes();
    const thumbnail = parseThumbnail(bytes);
    bytes[0x171a] = 0;
    expect(thumbnail?.[0]).toBe(0x89);
  });

  it('return the bytes without checking that they are a PNG (R1.39)', () => {
    const bytes = buildHeader({ magic: 'LIVE' }).setU32(0x1712, 3).setBytes(0x171a, [1, 2, 3]).bytes();
    expect([...(parseThumbnail(bytes) ?? [])]).toEqual([1, 2, 3]);
  });

  it('return a declared size that fills the whole space', () => {
    const bytes = buildHeader({ magic: 'LIVE', metadataVersion: 2 }).setU32(0x1712, 0x3d00).bytes();
    expect(parseThumbnail(bytes)?.length).toBe(0x3d00);
  });
});

describe('thumbnails, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const bytes = loadFixture(name);
    const expected = manifest[name];
    const sizes = parseThumbnailSizes(bytes);
    expect(sizes.thumbnail).toBe(expected.thumbnail?.size ?? 0);
    expect(sizes.titleThumbnail).toBe(expected.titleThumbnail?.size ?? 0);
    expect(sizes.availableSpace).toBe(expected.metadataVersion === 2 ? 0x3d00 : 0x4000);

    const thumbnail = parseThumbnail(bytes);
    const titleThumbnail = parseTitleThumbnail(bytes);
    expect(thumbnail && { size: thumbnail.length, sha1: sha1Hex(thumbnail) }).toEqual(expected.thumbnail);
    expect(titleThumbnail && { size: titleThumbnail.length, sha1: sha1Hex(titleThumbnail) }).toEqual(
      expected.titleThumbnail,
    );
  });

  it("returns null for the avatar item's empty thumbnail", () => {
    expect(parseThumbnail(loadFixture('pirs-stfs-avatar-item-no-thumbnail'))).toBeNull();
  });
});
