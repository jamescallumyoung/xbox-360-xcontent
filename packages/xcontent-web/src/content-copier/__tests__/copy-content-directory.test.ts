import { describe, it, expect } from 'vitest'
import { Volume } from 'memfs'
import { nodeToFsa } from 'memfs/lib/node-to-fsa/index.js'
import { copyContentDirectory, type CopyContentDirEvent } from '../copy-content-directory.js'

const MB = 1024 * 1024

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

function collectEvents(events: CopyContentDirEvent[]): (event: CopyContentDirEvent) => void {
  return (e) => events.push(e)
}

function makeAborted(): AbortSignal {
  const c = new AbortController()
  c.abort()
  return c.signal
}

function randomBytes(size: number): Uint8Array {
  const buf = new Uint8Array(size)
  for (let i = 0; i < size; i++) buf[i] = (i * 251 + 37) % 256
  return buf
}

describe('copyContentDirectory', () => {
  describe('spec violation', () => {
    it('emits content-dir-err-spec-violation-contains-directories and throws when source contains a subdirectory', async () => {
      const { src, dst } = await freshDirs()
      await makeDir(src, 'subdir')

      const events: CopyContentDirEvent[] = []
      await expect(
        copyContentDirectory(src, dst, MB, collectEvents(events), new AbortController().signal),
      ).rejects.toThrow()
      expect(events).toContainEqual({ type: 'content-dir-err-spec-violation-contains-directories', directoryName: 'subdir' })
    })

    it('throws on the first subdirectory encountered even if files are also present', async () => {
      const { src, dst } = await freshDirs()
      await writeFile(src, 'file.bin', new Uint8Array([1, 2, 3]))
      await makeDir(src, 'nested')

      const events: CopyContentDirEvent[] = []
      await expect(
        copyContentDirectory(src, dst, MB, collectEvents(events), new AbortController().signal),
      ).rejects.toThrow()
      expect(events.some(e => e.type === 'content-dir-err-spec-violation-contains-directories')).toBe(true)
    })
  })

  describe('no-op', () => {
    it('emits content-dir-no-op when all source files are present in target with correct sizes', async () => {
      const { src, dst } = await freshDirs()
      const data = randomBytes(512)
      await writeFile(src, 'aaa', data)
      await writeFile(dst, 'aaa', data)

      const events: CopyContentDirEvent[] = []
      await copyContentDirectory(src, dst, MB, collectEvents(events), new AbortController().signal)
      expect(events).toEqual([{ type: 'content-dir-no-op' }])
    })

    it('copies a file that exists in target but has a .part marker', async () => {
      const { src, dst } = await freshDirs()
      const data = randomBytes(512)
      await writeFile(src, 'aaa', data)
      await writeFile(dst, 'aaa', data)
      await writeFile(dst, 'aaa.part', new Uint8Array())  // stale marker

      const events: CopyContentDirEvent[] = []
      await copyContentDirectory(src, dst, MB, collectEvents(events), new AbortController().signal)
      expect(events.some(e => e.type === 'content-dir-file-done')).toBe(true)
      expect(events.at(-1)?.type).toBe('content-dir-did-write')
    })

    it('copies a file that exists in target but has the wrong size', async () => {
      const { src, dst } = await freshDirs()
      await writeFile(src, 'aaa', randomBytes(512))
      await writeFile(dst, 'aaa', randomBytes(256))  // wrong size

      const events: CopyContentDirEvent[] = []
      await copyContentDirectory(src, dst, MB, collectEvents(events), new AbortController().signal)
      expect(events.at(-1)?.type).toBe('content-dir-did-write')
      expect((await readFile(dst, 'aaa')).byteLength).toBe(512)
    })
  })

  describe('copying', () => {
    it('copies all files when target is empty', async () => {
      const { src, dst } = await freshDirs()
      const a = randomBytes(512)
      const b = randomBytes(256)
      await writeFile(src, 'aaa', a)
      await writeFile(src, 'bbb', b)

      const events: CopyContentDirEvent[] = []
      await copyContentDirectory(src, dst, MB, collectEvents(events), new AbortController().signal)

      expect(events.at(-1)).toEqual({ type: 'content-dir-did-write' })
      expect(await readFile(dst, 'aaa')).toEqual(a)
      expect(await readFile(dst, 'bbb')).toEqual(b)
    })

    it('copies files in alphanumeric order', async () => {
      const { src, dst } = await freshDirs()
      await writeFile(src, 'ccc', randomBytes(4))
      await writeFile(src, 'aaa', randomBytes(4))
      await writeFile(src, 'bbb', randomBytes(4))

      const doneFns: string[] = []
      await copyContentDirectory(src, dst, MB, (e) => {
        if (e.type === 'content-dir-file-done') doneFns.push(e.fileName)
      }, new AbortController().signal)

      expect(doneFns).toEqual(['aaa', 'bbb', 'ccc'])
    })

    it('emits content-dir-file-progress events during copy', async () => {
      const { src, dst } = await freshDirs()
      await writeFile(src, 'data', randomBytes(3 * MB))

      const progressEvents: CopyContentDirEvent[] = []
      await copyContentDirectory(src, dst, MB, (e) => {
        if (e.type === 'content-dir-file-progress') progressEvents.push(e)
      }, new AbortController().signal)

      expect(progressEvents.length).toBeGreaterThan(0)
      const last = progressEvents.at(-1) as Extract<CopyContentDirEvent, { type: 'content-dir-file-progress' }>
      expect(last.bytesWritten).toBe(last.bytesTotal)
    })

    it('emits correct event sequence: content-dir-file-progress*, content-dir-file-done, content-dir-did-write', async () => {
      const { src, dst } = await freshDirs()
      await writeFile(src, 'aaa', randomBytes(512))

      const types: string[] = []
      await copyContentDirectory(src, dst, MB, (e) => types.push(e.type), new AbortController().signal)

      const doneIdx = types.indexOf('content-dir-file-done')
      expect(doneIdx).toBeGreaterThan(0)
      expect(types.slice(0, doneIdx).every(t => t === 'content-dir-file-progress')).toBe(true)
      expect(types.at(-1)).toBe('content-dir-did-write')
    })

    it('skips already-complete files and copies only the remainder', async () => {
      const { src, dst } = await freshDirs()
      const done = randomBytes(512)
      await writeFile(src, 'aaa', done)
      await writeFile(dst, 'aaa', done)
      await writeFile(src, 'bbb', randomBytes(256))

      const doneFiles: string[] = []
      await copyContentDirectory(src, dst, MB, (e) => {
        if (e.type === 'content-dir-file-done') doneFiles.push((e as { fileName: string }).fileName)
      }, new AbortController().signal)

      expect(doneFiles).toEqual(['bbb'])
    })

    it('leaves no .part marker after a successful copy', async () => {
      const { src, dst } = await freshDirs()
      await writeFile(src, 'aaa', randomBytes(512))

      await copyContentDirectory(src, dst, MB, () => {}, new AbortController().signal)

      const names = await listNames(dst)
      expect(names).toEqual(['aaa'])
    })

    it.each([
      ['1 MB chunks', 1 * MB],
      ['20 MB chunks', 20 * MB],
      ['200 MB chunks', 200 * MB],
    ])('produces correct output with %s', async (_, chunkSize) => {
      const { src, dst } = await freshDirs()
      const data = randomBytes(5 * MB)
      await writeFile(src, 'game.bin', data)

      await copyContentDirectory(src, dst, chunkSize, () => {}, new AbortController().signal)

      expect(await readFile(dst, 'game.bin')).toEqual(data)
    })
  })

  describe('abort', () => {
    it('throws AbortError immediately if signal is already aborted', async () => {
      const { src, dst } = await freshDirs()
      await writeFile(src, 'aaa', randomBytes(512))

      await expect(
        copyContentDirectory(src, dst, MB, () => {}, makeAborted()),
      ).rejects.toThrow('Aborted')
    })

    it('leaves .part marker in target when aborted mid-copy', async () => {
      const { src, dst } = await freshDirs()
      await writeFile(src, 'big', randomBytes(10 * MB))

      const controller = new AbortController()
      let aborted = false
      await expect(
        copyContentDirectory(src, dst, MB, (e) => {
          if (!aborted && e.type === 'content-dir-file-progress') {
            controller.abort()
            aborted = true
          }
        }, controller.signal),
      ).rejects.toThrow()

      const names = await listNames(dst)
      expect(names).toContain('big.part')
    })

    it('resumes correctly on re-invocation after abort', async () => {
      const { src, dst } = await freshDirs()
      const data = randomBytes(3 * MB)
      await writeFile(src, 'aaa', data)

      const controller = new AbortController()
      let fired = false
      await expect(
        copyContentDirectory(src, dst, MB, (e) => {
          if (!fired && e.type === 'content-dir-file-progress') {
            controller.abort()
            fired = true
          }
        }, controller.signal),
      ).rejects.toThrow()

      // Re-invoke — should complete successfully
      await copyContentDirectory(src, dst, MB, () => {}, new AbortController().signal)
      expect(await readFile(dst, 'aaa')).toEqual(data)
      expect(await listNames(dst)).toEqual(['aaa'])
    })
  })
})
