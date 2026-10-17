import { describe, expect, it } from 'vitest';
import { contentTypeName, packageKind } from '../content-types.js';

describe('contentTypeName', () => {
  it('names every content type in spec §4.2 (CT1.1)', () => {
    expect(contentTypeName('00000001')).toBe('SavedGame');
    expect(contentTypeName('00007000')).toBe('GameOnDemand');
    expect(contentTypeName('000B0000')).toBe('Installer');
    expect(contentTypeName('000D0000')).toBe('ArcadeTitle');
    expect(contentTypeName('00600000')).toBe('ViralVideo');
    expect(contentTypeName('02000000')).toBe('CommunityGame');
  });

  it('names an unknown ID with the ID itself (CT1.2)', () => {
    expect(contentTypeName('12345678')).toBe('Unknown (12345678)');
  });
});

describe('packageKind', () => {
  it('groups the game content types as game (CT1.3)', () => {
    for (const id of ['00007000', '00004000', '000D0000', '00005000', '00080000', '02000000', '00001000']) {
      expect(packageKind(id)).toBe('game');
    }
  });

  it('groups title updates, DLC and saves (CT1.3)', () => {
    expect(packageKind('000B0000')).toBe('title-update');
    expect(packageKind('00000002')).toBe('dlc');
    expect(packageKind('00000001')).toBe('save');
  });

  it('groups everything else as other (CT1.3)', () => {
    for (const id of ['00009000', '00030000', '000E0000', '000C0000', '12345678']) {
      expect(packageKind(id)).toBe('other');
    }
  });
});
