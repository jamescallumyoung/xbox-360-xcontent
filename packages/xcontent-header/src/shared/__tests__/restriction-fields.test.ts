import { describe, expect, it } from 'vitest';
import { manifest } from '../../__tests__/fixtures/manifest.generated.js';
import { buildHeader } from '../../__tests__/helpers/header-builder.js';
import { FIXTURE_NAMES, loadFixture } from '../../__tests__/helpers/load-fixture.js';
import { parseLicences } from '../licences.js';
import { parseCreatorConsoleId, parseDeviceId, parseProfileId } from '../ownership-ids.js';
import { parseTransferFlags } from '../transfer-flags.js';

const live = () => buildHeader({ magic: 'LIVE' });

/** Writes licence entry `index`: an 8-byte licensee ID, then 4-byte bits and flags. */
const withLicence = (index: number, licenseeId: bigint, bits = 0, flags = 0) =>
  live()
    .setU64(0x22c + index * 0x10, licenseeId)
    .setU32(0x22c + index * 0x10 + 8, bits)
    .setU32(0x22c + index * 0x10 + 12, flags);

describe('parseLicences (R4.10-16)', () => {
  it('always returns 16 entries, in header order, including unused ones (R4.10)', () => {
    const licences = parseLicences(live().bytes());
    expect(licences).toHaveLength(16);
    expect(licences.map((licence) => licence.index)).toEqual([...Array(16).keys()]);
    expect(licences.every((licence) => licence.licenseeType.decoded === 'unused')).toBe(true);
  });

  it('reads entry n at 0x22C + n * 0x10 (R4.11)', () => {
    const licences = parseLicences(withLicence(15, 0xf000000123456789n).bytes());
    expect(licences[15]?.licenseeData).toBe('000123456789');
    expect(licences[14]?.licenseeData).toBe('000000000000');
  });

  it('splits the licensee ID into a 16-bit type and 48-bit data (R4.12, R4.14)', () => {
    const [licence] = parseLicences(withLicence(0, 0xf000_0123_4567_89abn).bytes());
    expect(licence?.licenseeType.raw).toBe(0xf000);
    expect(licence?.licenseeData).toBe('0123456789AB');
  });

  it.each([
    [0xffff, 'unrestricted'],
    [0x0009, 'xboxLiveAccount'],
    [0x0003, 'windowsLiveAccount'],
    [0xf000, 'console'],
    [0xe000, 'mediaFlags'],
    [0xd000, 'keyvaultPrivilege'],
    [0xc000, 'hypervisorFlags'],
    [0xb000, 'userPrivilege'],
    [0x0000, 'unused'],
  ])('decodes licensee type %i as %s (R4.13)', (type, name) => {
    const [licence] = parseLicences(withLicence(0, BigInt(type) << 48n).bytes());
    expect(licence?.licenseeType).toEqual({ raw: type, decoded: name });
  });

  it('decodes any other licensee type as unknown, keeping the raw value (R4.13)', () => {
    const [licence] = parseLicences(withLicence(0, 0x1234n << 48n).bytes());
    expect(licence?.licenseeType).toEqual({ raw: 0x1234, decoded: 'unknown' });
  });

  it('returns the bits and flags as numbers, without decoding them (R4.15-16)', () => {
    const [licence] = parseLicences(withLicence(0, 0xffffffffffffffffn, 0x00000001, 0xdeadbeef).bytes());
    expect(licence).toEqual({
      index: 0,
      licenseeType: { raw: 0xffff, decoded: 'unrestricted' },
      licenseeData: 'FFFFFFFFFFFF',
      bits: 1,
      flags: 0xdeadbeef,
    });
  });
});

describe('parseTransferFlags (R4.17-18)', () => {
  it('returns the raw byte at 0x1711 (R4.17)', () => {
    expect(parseTransferFlags(live().setU8(0x1711, 0xc0).bytes()).raw).toBe(0xc0);
  });

  it('decodes each known bit (R4.18)', () => {
    expect(parseTransferFlags(live().setU8(0x1711, 0xfc).bytes()).decoded).toEqual({
      canMoveToProfile: true,
      canMoveToDevice: true,
      moveOnly: true,
      kinectEnabled: true,
      networkStorageDisabled: true,
      deepLinksSupported: true,
    });
    expect(Object.values(parseTransferFlags(live().bytes()).decoded).some(Boolean)).toBe(false);
  });

  it.each([
    [0x80, 'canMoveToProfile'],
    [0x40, 'canMoveToDevice'],
    [0x20, 'moveOnly'],
    [0x10, 'kinectEnabled'],
    [0x08, 'networkStorageDisabled'],
    [0x04, 'deepLinksSupported'],
  ])('bit %i sets only %s', (bit, name) => {
    const { decoded } = parseTransferFlags(live().setU8(0x1711, bit).bytes());
    expect(Object.entries(decoded).filter(([, set]) => set)).toEqual([[name, true]]);
  });

  it('keeps the unknown bits 0x02 and 0x01 visible only in raw (R4.17)', () => {
    const flags = parseTransferFlags(live().setU8(0x1711, 0x03).bytes());
    expect(flags.raw).toBe(0x03);
    expect(Object.values(flags.decoded).some(Boolean)).toBe(false);
  });
});

describe('ownership IDs (R4.19-21)', () => {
  it('returns the creator console ID at 0x36C as 10 hex digits (R4.19)', () => {
    expect(parseCreatorConsoleId(live().setBytes(0x36c, [0x01, 0x23, 0x45, 0x67, 0x89]).bytes())).toBe('0123456789');
  });

  it('returns the profile ID at 0x371 as 16 hex digits, and zeros for no owning profile (R4.20)', () => {
    expect(parseProfileId(live().setU64(0x371, 0xe812cecf9ea2af5fn).bytes())).toBe('E812CECF9EA2AF5F');
    expect(parseProfileId(live().bytes())).toBe('0000000000000000');
  });

  it('returns the device ID at 0x3FD as 40 hex digits (R4.21)', () => {
    const bytes = live()
      .setBytes(
        0x3fd,
        Array.from({ length: 20 }, (_, i) => i),
      )
      .bytes();
    expect(parseDeviceId(bytes)).toBe('000102030405060708090A0B0C0D0E0F10111213');
  });
});

describe('restriction fields, against the real fixtures', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const bytes = loadFixture(name);
    const expected = manifest[name];
    expect(
      parseLicences(bytes).map(({ licenseeType, licenseeData, bits, flags }) => ({
        licenseeType: licenseeType.raw,
        licenseeData,
        bits,
        flags,
      })),
    ).toEqual(expected.licences);
    expect(parseTransferFlags(bytes).raw).toBe(expected.transferFlags);
    expect(parseCreatorConsoleId(bytes)).toBe(expected.creatorConsoleId);
    expect(parseProfileId(bytes)).toBe(expected.profileId);
    expect(parseDeviceId(bytes)).toBe(expected.deviceId);
  });

  it("decodes the anonymised DLC's XUID and console licences", () => {
    const licences = parseLicences(loadFixture('live-stfs-dlc-non-ascii'));
    expect(licences[0]?.licenseeType.decoded).toBe('xboxLiveAccount');
    expect(licences[0]?.licenseeData).toBe('000000000001');
    expect(licences[1]?.licenseeType.decoded).toBe('console');
    expect(licences[1]?.licenseeData).toBe('000123456789');
  });

  it("returns the anonymised placeholders for a save's IDs", () => {
    const save = loadFixture('con-971a-mv2-xna-save');
    expect(parseCreatorConsoleId(save)).toBe('0123456789');
    expect(parseDeviceId(save)).toBe(Buffer.from('FIXTURE0DEVICE0ID000', 'latin1').toString('hex').toUpperCase());
    expect(parseProfileId(loadFixture('con-971a-mv0-download-in-progress'))).toBe('0009000000000001');
  });
});
