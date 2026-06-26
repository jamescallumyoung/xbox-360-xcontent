import { describe, it, expect } from 'vitest'
import { discoverPartitions } from '../discover.js'

type FakeEntry = [string, { kind: 'file' | 'directory' }]

function makeRoot(entries: FakeEntry[]): FileSystemDirectoryHandle {
  return {
    async *entries() {
      for (const entry of entries) yield entry
    },
  } as unknown as FileSystemDirectoryHandle
}

describe('discoverPartitions', () => {
  it('identifies the public partition', async () => {
    const root = makeRoot([['0000000000000000', { kind: 'directory' }]])
    const { partitions, ignoredCount } = await discoverPartitions(root)
    expect(partitions).toHaveLength(1)
    expect(partitions[0].kind).toBe('public')
    expect(partitions[0].directoryName).toBe('0000000000000000')
    expect(partitions[0].profileId).toBeNull()
    expect(ignoredCount).toBe(0)
  })

  it('identifies a profile partition and sets profileId to the directory name', async () => {
    const root = makeRoot([['E000ABCDEF123456', { kind: 'directory' }]])
    const { partitions } = await discoverPartitions(root)
    expect(partitions).toHaveLength(1)
    expect(partitions[0].kind).toBe('profile')
    expect(partitions[0].profileId).toBe('E000ABCDEF123456')
  })

  it('handles a mix of public, profile, and ignored entries', async () => {
    const root = makeRoot([
      ['0000000000000000', { kind: 'directory' }],
      ['E000ABCDEF123456', { kind: 'directory' }],
      ['DEADBEEF01234567', { kind: 'directory' }],
      ['SomeRandomDir', { kind: 'directory' }],
      ['readme.txt', { kind: 'file' }],
    ])
    const { partitions, ignoredCount } = await discoverPartitions(root)
    expect(partitions).toHaveLength(3)
    expect(partitions.filter(p => p.kind === 'public')).toHaveLength(1)
    expect(partitions.filter(p => p.kind === 'profile')).toHaveLength(2)
    expect(ignoredCount).toBe(2)
  })

  it('counts files as ignored regardless of their name', async () => {
    const root = makeRoot([['0000000000000000', { kind: 'file' }]])
    const { partitions, ignoredCount } = await discoverPartitions(root)
    expect(partitions).toHaveLength(0)
    expect(ignoredCount).toBe(1)
  })

  it('returns empty results for an empty Content/ directory', async () => {
    const root = makeRoot([])
    const { partitions, ignoredCount } = await discoverPartitions(root)
    expect(partitions).toHaveLength(0)
    expect(ignoredCount).toBe(0)
  })
})
