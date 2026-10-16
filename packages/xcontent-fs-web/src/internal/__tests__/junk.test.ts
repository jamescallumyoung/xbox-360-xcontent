// Tests for the junk rules and the regex escape they rely on.
// Function design doc, J1 `clean`: statements J1.10 and J1.13-J1.16, and the
// "Tests required" table, here as checks on names (stage 7 repeats the table
// as real deletions).

import { describe, expect, it } from 'vitest';
import { appleDouble, fakeAppleDouble, truncatedAppleDouble } from '../../__tests__/helpers/junk.js';
import { createTestDrive } from '../../__tests__/helpers/test-drive.js';
import { classifyBesideHeader, dataFileIndex, hasAppleDoubleMagic, isDataFileName } from '../junk.js';
import { escapeRegExp } from '../regex.js';

/** Every character FATX allows in a name (spec §5). */
const FATX_CHARACTERS = Array.from(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !#$%&'()-.@[]^_`{}~",
);

describe('escapeRegExp', () => {
  it.each(FATX_CHARACTERS)('J1.13: %j matches only itself once escaped', (character) => {
    const pattern = new RegExp(`^${escapeRegExp(character)}$`);
    expect(pattern.test(character)).toBe(true);
    const other = character === 'x' ? 'y' : 'x';
    expect(pattern.test(other)).toBe(false);
    expect(pattern.test(character + character)).toBe(false);
  });

  it('J1.13: a name made of every FATX character matches only itself', () => {
    const name = FATX_CHARACTERS.join('');
    const pattern = new RegExp(`^${escapeRegExp(name)}$`);
    expect(pattern.test(name)).toBe(true);
    expect(pattern.test(name.slice(1))).toBe(false);
  });
});

describe('isDataFileName and dataFileIndex', () => {
  it.each(['Data0000', 'Data0001', 'Data0123', 'Data9999'])('J1.10: %j is a data file', (name) => {
    expect(isDataFileName(name)).toBe(true);
  });

  it("J1.10: gives the data file's number", () => {
    expect(dataFileIndex('Data0000')).toBe(0);
    expect(dataFileIndex('Data0123')).toBe(123);
    expect(dataFileIndex('COPYING')).toBeUndefined();
  });

  it.each([
    'data0000',
    'DATA0000',
    'Data000',
    'Data00000',
    'Data0000.crswap',
    '._Data0000',
    'COPYING',
    ' Data0000',
    'Data\u0660\u0660\u0660\u0660',
  ])('J1.10: %j is not a data file (exact name, case-sensitive, ASCII digits)', (name) => {
    expect(isDataFileName(name)).toBe(false);
  });
});

describe('classifyBesideHeader', () => {
  const noSiblings = new Set<string>();

  it.each(['ABC.crswap', 'ABC.1.crswap', 'ABC.12.crswap'])("J1.13: %j is the package's swap file", (entry) => {
    expect(classifyBesideHeader('ABC', entry, noSiblings)).toBe('crswap');
  });

  it.each(['._ABC', '._ABC.data', '._ABC.crswap', '._ABC.1.crswap'])(
    "J1.14: %j is the package's AppleDouble file (if its magic is valid)",
    (entry) => {
      expect(classifyBesideHeader('ABC', entry, noSiblings)).toBe('apple-double');
    },
  );

  it('J1.16: ._ABC.crswap is an AppleDouble file, so it goes through the magic check', () => {
    expect(classifyBesideHeader('ABC', '._ABC.crswap', noSiblings)).toBe('apple-double');
  });

  it.each(['ABC.1.crswap', '._ABC.1.crswap'])(
    "J1.15: %j is kept when an entry named ABC.1 exists: it may be that package's",
    (entry) => {
      expect(classifyBesideHeader('ABC', entry, new Set(['ABC', 'ABC.1']))).toBeUndefined();
    },
  );

  it('J1.15: the NAME.N rule needs the exact name ABC.1', () => {
    expect(classifyBesideHeader('ABC', 'ABC.1.crswap', new Set(['abc.1', 'ABC.12']))).toBe('crswap');
  });

  it.each([
    'ABC',
    'ABC.data',
    'ABCD.crswap',
    '._ABCD',
    'XABC.crswap',
    '._XABC',
    'AB.crswap',
    'abc.crswap',
    '._abc',
    'ABC.crswap.crswap',
    'ABC.x.crswap',
    'ABC.1.2.crswap',
    '._ABC.data.crswap',
    '.ABC.crswap',
  ])('J1.13, J1.14: %j is not junk of package ABC', (entry) => {
    expect(classifyBesideHeader('ABC', entry, noSiblings)).toBeUndefined();
  });

  it.each([
    ['a.b', 'aXb.crswap'],
    ['a+', 'aaa.crswap'],
    ['(x)', 'x.crswap'],
    ['a.b(c)[d]^$', 'a.b(c)d^$.crswap'],
  ])('J1.13: regex characters in %j are escaped, so %j is kept', (name, neighbour) => {
    expect(classifyBesideHeader(name, neighbour, noSiblings)).toBeUndefined();
    expect(classifyBesideHeader(name, `${name}.crswap`, noSiblings)).toBe('crswap');
    expect(classifyBesideHeader(name, `._${name}`, noSiblings)).toBe('apple-double');
  });
});

describe('hasAppleDoubleMagic', () => {
  async function fileWith(bytes: Uint8Array): Promise<FileSystemFileHandle> {
    const drive = createTestDrive({ tree: { '._ABC': bytes } });
    return drive.root.getFileHandle('._ABC');
  }

  it('J1.14: true for a file starting with 00 05 16 07', async () => {
    expect(await hasAppleDoubleMagic(await fileWith(appleDouble()))).toBe(true);
    expect(await hasAppleDoubleMagic(await fileWith(appleDouble(4)))).toBe(true);
  });

  it('J1.14: false for other bytes, a file shorter than 4 bytes, or an empty one', async () => {
    expect(await hasAppleDoubleMagic(await fileWith(fakeAppleDouble()))).toBe(false);
    expect(await hasAppleDoubleMagic(await fileWith(truncatedAppleDouble()))).toBe(false);
    expect(await hasAppleDoubleMagic(await fileWith(new Uint8Array()))).toBe(false);
  });

  it('lets a read error through, for the caller to turn into a reason', async () => {
    const drive = createTestDrive({ tree: { '._ABC': appleDouble() } });
    const file = await drive.root.getFileHandle('._ABC');
    drive.fail({ operation: 'read' });
    await expect(hasAppleDoubleMagic(file)).rejects.toMatchObject({ name: 'NotReadableError' });
  });
});
