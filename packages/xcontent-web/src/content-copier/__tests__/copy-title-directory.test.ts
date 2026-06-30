import { describe, it, expect } from 'vitest'
import { Volume } from 'memfs'
import { nodeToFsa } from 'memfs/lib/node-to-fsa/index.js'
import { copyTitleDirectory, type CopyTitleDirEvent } from '../copy-title-directory.js'
import type { CopyContentDirEvent } from '../copy-content-directory.js'
import type { ContentTypeName } from 'xcontent'

const MB = 1024 * 1024

type AnyEvent = CopyTitleDirEvent | CopyContentDirEvent

function freshDirs(): { src: FileSystemDirectoryHandle; dst: FileSystemDirectoryHandle } {
  const vol = new Volume()
  vol.mkdirSync('/src', { recursive: true })
  vol.mkdirSync('/dst', { recursive: true })
  return {
    src: nodeToFsa(vol, '/src', { mode: 'readwrite' }) as unknown as FileSystemDirectoryHandle,
    dst: nodeToFsa(vol, '/dst', { mode: 'readwrite' }) as unknown as FileSystemDirectoryHandle,
  }
}

async function makeDir(parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true })
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Uint8Array): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

async function readFile(dir: FileSystemDirectoryHandle, name: string): Promise<Uint8Array> {
  const handle = await dir.getFileHandle(name)
  const file = await handle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

async function listNames(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []
  for await (const [name] of dir.entries()) names.push(name)
  return names.sort()
}

function types(events: AnyEvent[]): string[] {
  return events.map(e => e.type)
}

function randomBytes(size: number): Uint8Array {
  const buf = new Uint8Array(size)
  for (let i = 0; i < size; i++) buf[i] = (i * 251 + 37) % 256
  return buf
}

const signal = new AbortController().signal

describe('copyTitleDirectory', () => {
  describe('spec violation', () => {
    it('emits title-dir-err-spec-violation-contains-files and throws when source contains a file', async () => {
      const { src, dst } = freshDirs()
      await writeFile(src, 'stray.bin', new Uint8Array([1, 2, 3]))

      const events: AnyEvent[] = []
      await expect(
        copyTitleDirectory(src, dst, MB, e => events.push(e), signal),
      ).rejects.toThrow()
      expect(events).toContainEqual({ type: 'title-dir-err-spec-violation-contains-files' })
    })

    it('throws even if CT dirs are also present alongside the file', async () => {
      const { src, dst } = freshDirs()
      await makeDir(src, '00000001')
      await writeFile(src, 'stray.bin', new Uint8Array([1]))

      const events: AnyEvent[] = []
      await expect(
        copyTitleDirectory(src, dst, MB, e => events.push(e), signal),
      ).rejects.toThrow()
      expect(events.some(e => e.type === 'title-dir-err-spec-violation-contains-files')).toBe(true)
    })
  })

  describe('no-op', () => {
    it('emits title-dir-no-op when all CT dirs are already complete', async () => {
      const { src, dst } = freshDirs()
      const data = randomBytes(256)
      const srcCt = await makeDir(src, '00000001')
      await writeFile(srcCt, 'save.bin', data)
      const dstCt = await makeDir(dst, '00000001')
      await writeFile(dstCt, 'save.bin', data)

      const events: AnyEvent[] = []
      await copyTitleDirectory(src, dst, MB, e => events.push(e), signal)
      expect(events).toEqual([{ type: 'title-dir-no-op' }])
    })

    it('does not no-op when a CT dir has a .part marker even if contents match', async () => {
      const { src, dst } = freshDirs()
      const data = randomBytes(256)
      const srcCt = await makeDir(src, '00000001')
      await writeFile(srcCt, 'save.bin', data)
      const dstCt = await makeDir(dst, '00000001')
      await writeFile(dstCt, 'save.bin', data)
      await writeFile(dst, '00000001.part', new Uint8Array())

      const events: AnyEvent[] = []
      await copyTitleDirectory(src, dst, MB, e => events.push(e), signal)
      expect(events.at(-1)?.type).toBe('title-dir-did-write')
    })

    it('does not no-op when a CT dir is absent from target', async () => {
      const { src, dst } = freshDirs()
      const srcCt = await makeDir(src, '00000001')
      await writeFile(srcCt, 'save.bin', randomBytes(128))

      const events: AnyEvent[] = []
      await copyTitleDirectory(src, dst, MB, e => events.push(e), signal)
      expect(events.at(-1)?.type).toBe('title-dir-did-write')
    })

    it('does not no-op when a CT dir file has the wrong size in target', async () => {
      const { src, dst } = freshDirs()
      const srcCt = await makeDir(src, '00000001')
      await writeFile(srcCt, 'save.bin', randomBytes(512))
      const dstCt = await makeDir(dst, '00000001')
      await writeFile(dstCt, 'save.bin', randomBytes(256))  // wrong size

      const events: AnyEvent[] = []
      await copyTitleDirectory(src, dst, MB, e => events.push(e), signal)
      expect(events.at(-1)?.type).toBe('title-dir-did-write')
    })
  })

  describe('copying', () => {
    it('copies all CT dirs and emits title-dir-directory-done per dir and title-dir-did-write', async () => {
      const { src, dst } = freshDirs()
      const ct1 = await makeDir(src, '00000001')
      await writeFile(ct1, 'save.bin', randomBytes(128))
      const ct2 = await makeDir(src, '00000002')
      await writeFile(ct2, 'dlc.bin', randomBytes(256))

      const events: AnyEvent[] = []
      await copyTitleDirectory(src, dst, MB, e => events.push(e), signal)

      const doneDirs = events.filter(e => e.type === 'title-dir-directory-done').map(e => (e as { directoryName: string }).directoryName)
      expect(doneDirs).toEqual(['00000001', '00000002'])
      expect(events.at(-1)?.type).toBe('title-dir-did-write')
    })

    it('copies CT dirs in alphanumeric order', async () => {
      const { src, dst } = freshDirs()
      for (const name of ['000B0000', '00000002', '00000001']) {
        const d = await makeDir(src, name)
        await writeFile(d, 'data', randomBytes(64))
      }

      const doneDirs: string[] = []
      await copyTitleDirectory(src, dst, MB, e => {
        if (e.type === 'title-dir-directory-done') doneDirs.push((e as { directoryName: string }).directoryName)
      }, signal)

      expect(doneDirs).toEqual(['00000001', '00000002', '000B0000'])
    })

    it('forwards CopyContentDirEvents from copyContentDirectory', async () => {
      const { src, dst } = freshDirs()
      const ct = await makeDir(src, '00000001')
      await writeFile(ct, 'data', randomBytes(512))

      const events: AnyEvent[] = []
      await copyTitleDirectory(src, dst, MB, e => events.push(e), signal)

      expect(events.some(e => e.type === 'content-dir-file-done')).toBe(true)
      expect(events.some(e => e.type === 'content-dir-file-progress')).toBe(true)
    })

    it('skips already-complete CT dirs and copies only incomplete ones', async () => {
      const { src, dst } = freshDirs()
      const data = randomBytes(128)
      const ct1 = await makeDir(src, '00000001')
      await writeFile(ct1, 'save.bin', data)
      const dstCt1 = await makeDir(dst, '00000001')
      await writeFile(dstCt1, 'save.bin', data)  // already complete

      const ct2 = await makeDir(src, '00000002')
      await writeFile(ct2, 'dlc.bin', randomBytes(128))  // needs copying

      const doneDirs: string[] = []
      await copyTitleDirectory(src, dst, MB, e => {
        if (e.type === 'title-dir-directory-done') doneDirs.push((e as { directoryName: string }).directoryName)
      }, signal)

      expect(doneDirs).toEqual(['00000002'])
    })

    it('leaves no .part markers in target after successful copy', async () => {
      const { src, dst } = freshDirs()
      const ct = await makeDir(src, '00000001')
      await writeFile(ct, 'data', randomBytes(128))

      await copyTitleDirectory(src, dst, MB, () => {}, signal)

      const names = await listNames(dst)
      expect(names.every(n => !n.endsWith('.part'))).toBe(true)
    })

    it('copies file content correctly', async () => {
      const { src, dst } = freshDirs()
      const data = randomBytes(512)
      const ct = await makeDir(src, '00000001')
      await writeFile(ct, 'save.bin', data)

      await copyTitleDirectory(src, dst, MB, () => {}, signal)

      const dstCt = await dst.getDirectoryHandle('00000001')
      expect(await readFile(dstCt, 'save.bin')).toEqual(data)
    })
  })

  describe('content type filtering', () => {
    it('skips CT dirs whose hex maps to an excluded known ContentTypeName', async () => {
      const { src, dst } = freshDirs()
      const game = await makeDir(src, '00001000')  // Xbox360Title
      await writeFile(game, 'game.bin', randomBytes(128))
      const save = await makeDir(src, '00000001')  // SavedGame — excluded
      await writeFile(save, 'save.bin', randomBytes(64))

      const allowed = new Set<ContentTypeName>(['Xbox360Title'])
      const doneDirs: string[] = []
      await copyTitleDirectory(src, dst, MB, e => {
        if (e.type === 'title-dir-directory-done') doneDirs.push((e as { directoryName: string }).directoryName)
      }, signal, allowed)

      expect(doneDirs).toEqual(['00001000'])
      expect(await listNames(dst)).not.toContain('00000001')
    })

    it('always copies CT dirs with unknown hex names regardless of filter', async () => {
      const { src, dst } = freshDirs()
      const unknown = await makeDir(src, 'deadbeef')  // not in CONTENT_TYPE_HEX
      await writeFile(unknown, 'data', randomBytes(64))

      const allowed = new Set<ContentTypeName>(['Xbox360Title'])  // doesn't include deadbeef
      const doneDirs: string[] = []
      await copyTitleDirectory(src, dst, MB, e => {
        if (e.type === 'title-dir-directory-done') doneDirs.push((e as { directoryName: string }).directoryName)
      }, signal, allowed)

      expect(doneDirs).toContain('deadbeef')
    })

    it('copies everything when no filter is provided', async () => {
      const { src, dst } = freshDirs()
      for (const [name, size] of [['00001000', 128], ['00000001', 64], ['00000002', 96]] as const) {
        const d = await makeDir(src, name)
        await writeFile(d, 'data', randomBytes(size))
      }

      const doneDirs: string[] = []
      await copyTitleDirectory(src, dst, MB, e => {
        if (e.type === 'title-dir-directory-done') doneDirs.push((e as { directoryName: string }).directoryName)
      }, signal)

      expect(doneDirs.sort()).toEqual(['00000001', '00000002', '00001000'])
    })
  })

  describe('abort', () => {
    it('throws AbortError if signal is already aborted', async () => {
      const { src, dst } = freshDirs()
      const ct = await makeDir(src, '00000001')
      await writeFile(ct, 'data', randomBytes(128))

      const aborted = new AbortController()
      aborted.abort()
      await expect(
        copyTitleDirectory(src, dst, MB, () => {}, aborted.signal),
      ).rejects.toThrow('Aborted')
    })

    it('propagates abort into copyContentDirectory and leaves .part markers', async () => {
      const { src, dst } = freshDirs()
      const ct = await makeDir(src, '00000001')
      await writeFile(ct, 'big', randomBytes(10 * MB))

      const controller = new AbortController()
      let fired = false
      await expect(
        copyTitleDirectory(src, dst, MB, e => {
          if (!fired && e.type === 'content-dir-file-progress') { controller.abort(); fired = true }
        }, controller.signal),
      ).rejects.toThrow()

      const dstNames = await listNames(dst)
      expect(dstNames).toContain('00000001.part')
    })

    it('resumes correctly on re-invocation after abort', async () => {
      const { src, dst } = freshDirs()
      const data = randomBytes(3 * MB)
      const ct = await makeDir(src, '00000001')
      await writeFile(ct, 'game.bin', data)

      const controller = new AbortController()
      let fired = false
      await expect(
        copyTitleDirectory(src, dst, MB, e => {
          if (!fired && e.type === 'content-dir-file-progress') { controller.abort(); fired = true }
        }, controller.signal),
      ).rejects.toThrow()

      await copyTitleDirectory(src, dst, MB, () => {}, new AbortController().signal)

      const dstCt = await dst.getDirectoryHandle('00000001')
      expect(await readFile(dstCt, 'game.bin')).toEqual(data)
      expect(await listNames(dst)).toEqual(['00000001'])
    })
  })
})
