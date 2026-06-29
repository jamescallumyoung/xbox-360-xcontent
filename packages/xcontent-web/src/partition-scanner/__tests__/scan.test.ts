import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Partition } from 'xcontent'
import { scanPartitions, READ_SIZE } from '../scan.js'

const fixtureDir = join(fileURLToPath(new URL('.', import.meta.url)), '../../../../xcontent/src/parse-header/__tests__/fixtures')

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixtureDir, name)).buffer)
}

function makeFile(bytes: Uint8Array): FileSystemFileHandle {
  return {
    kind: 'file',
    async getFile() {
      return {
        slice(_start: number, end: number) {
          return {
            async arrayBuffer() {
              return bytes.slice(0, end).buffer
            },
          }
        },
      } as unknown as File
    },
  } as unknown as FileSystemFileHandle
}

function makeDir(entries: [string, FileSystemHandle][]): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    async *entries() {
      for (const entry of entries) yield entry
    },
  } as unknown as FileSystemDirectoryHandle
}

// Builds a title directory handle: { [contentTypeHex]: { [filename]: file } }
function makeTitleDir(contentTypeHex: string, bytes: Uint8Array): FileSystemDirectoryHandle {
  const contentTypeDir = makeDir([['header', makeFile(bytes)]])
  return makeDir([[contentTypeHex, contentTypeDir]])
}

const partition: Partition = { kind: 'public', directoryName: '0000000000000000', profileId: null }

describe('scanPartitions', () => {
  it('returns an empty result for an empty partition', async () => {
    const result = await scanPartitions([[partition, makeDir([])]])
    expect(result.titles).toHaveLength(0)
  })

  it('returns an empty result when there are no valid title directories', async () => {
    const result = await scanPartitions([[partition, makeDir([['not-a-title', makeDir([])]])]])
    expect(result.titles).toHaveLength(0)
  })

  it('scans a title directory and produces a TitleXContent from a real fixture', async () => {
    const handle = makeDir([
      ['4D530808', makeTitleDir('00000002', loadFixture('dlc-halo-wars'))],
    ])
    const result = await scanPartitions([[partition, handle]])
    expect(result.titles).toHaveLength(1)
    const title = result.titles[0]
    expect(title.titleIdHex).toBe('4D530808')
    expect(title.displayName).toBe('4D530808')
    expect(title.hasDlc).toBe(true)
    expect(title.gameIsPresent).toBe(false)
    expect(title.hasCorruptContent).toBe(false)
    expect(title.hasInternalError).toBe(false)
  })

  it('marks hasInternalError when a file cannot be read after retry', async () => {
    const badFile: FileSystemFileHandle = {
      kind: 'file',
      async getFile() { throw new Error('permission denied') },
    } as unknown as FileSystemFileHandle
    const handle = makeDir([
      ['4D530808', makeDir([['00000002', makeDir([['header', badFile]])]])],
    ])
    const result = await scanPartitions([[partition, handle]])
    expect(result.titles).toHaveLength(1)
    expect(result.titles[0].hasInternalError).toBe(true)
    expect(result.titles[0].hasCorruptContent).toBe(false)
  })

  it('marks hasCorruptContent when a file is readable but its header is invalid', async () => {
    const handle = makeDir([
      ['4D530808', makeTitleDir('00000002', new Uint8Array(READ_SIZE))],
    ])
    const result = await scanPartitions([[partition, handle]])
    expect(result.titles).toHaveLength(1)
    expect(result.titles[0].hasCorruptContent).toBe(true)
    expect(result.titles[0].hasInternalError).toBe(false)
  })

  it('sorts titles alphabetically by display name', async () => {
    const handle = makeDir([
      ['555308C5', makeTitleDir('00007000', loadFixture('god-south-park-tsot'))],
      ['4B4D07F2', makeTitleDir('00007000', loadFixture('god-dead-island-riptide'))],
    ])
    const result = await scanPartitions([[partition, handle]])
    expect(result.titles).toHaveLength(2)
    expect(result.titles[0].displayName).toBe('Dead Island Riptide')
    expect(result.titles[1].displayName).toContain('South Park')
  })
})
