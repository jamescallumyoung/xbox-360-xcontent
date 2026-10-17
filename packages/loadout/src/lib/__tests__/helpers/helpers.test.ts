// The test helpers themselves: the header builder must give headers that
// parseHeader reads back, and folder() must lay out its tree.

import { describe, expect, it } from 'vitest';
import { parseHeader } from 'xcontent-header';
import { folder, pulled } from './drive.js';
import { header } from './header.js';

describe('header', () => {
  it('builds a header parseHeader reads back', () => {
    const thumbnail = Uint8Array.of(1, 2, 3);
    const [ok, parsed] = parseHeader(
      header({
        magic: 'CON ',
        contentType: 0xb0000,
        titleId: 'FFFE07D1',
        format: 1,
        dataFilesSize: 5000,
        displayName: 'Name',
        titleName: 'Title',
        publisher: 'Pub',
        contentId: '01'.repeat(20),
        thumbnail,
      }),
    );
    if (!ok) throw new Error(JSON.stringify(parsed));
    expect(parsed).toMatchObject({
      declaredSigning: 'CON',
      declaredContentType: 0xb0000,
      declaredTitleId: 'FFFE07D1',
      format: { decoded: 'svod' },
      dataFilesSize: 5000,
      titleName: 'Title',
      publisherName: 'Pub',
      contentId: '01'.repeat(20),
      thumbnail,
      titleThumbnail: null,
    });
    expect(parsed.displayNames[0]).toBe('Name');
  });
});

describe('folder', () => {
  it('lays out files and empty directories', () => {
    const f = folder({ 'a/b/file': 'x', 'c/': null });
    expect(f.list()).toEqual(['a/', 'a/b/', 'a/b/file', 'c/']);
    expect(f.handle.name).toBe('Content');
  });

  it('pulls a drive: listing rejects with NotFoundError', async () => {
    const handle = pulled(folder().handle);
    await expect(handle.keys().next()).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(handle.getDirectoryHandle('x')).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
