import type { Partition, ContentTypeName } from 'xcontent'
import { CONTENT_TYPE_HEX } from 'xcontent'
import type { TitleXContent } from '../types.js'

export type CopyEvent =
  | { type: 'log'; message: string; replace?: true }
  | { type: 'progress'; completed: number; total: number }
  | { type: 'done' }
  | { type: 'cancelled' }

async function isDirEmpty(handle: FileSystemDirectoryHandle): Promise<boolean> {
  for await (const _ of handle.values()) return false
  return true
}

async function copyFile(
  sourceDir: FileSystemDirectoryHandle,
  name: string,
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  const src = await sourceDir.getFileHandle(name)
  const file = await src.getFile()
  const buffer = await file.arrayBuffer()
  const dst = await targetDir.getFileHandle(name, { create: true })
  const writable = await dst.createWritable()
  try {
    await writable.write(buffer)
    await writable.close()
  } catch (err) {
    await writable.abort()
    throw err
  }
}

export async function copyTitles(
  titles: TitleXContent[],
  partitionTuples: [Partition, FileSystemDirectoryHandle][],
  targetRoot: FileSystemDirectoryHandle,
  onEvent: (event: CopyEvent) => void,
  signal: AbortSignal,
  allowedContentTypeNames?: ReadonlySet<ContentTypeName>,
): Promise<void> {
  const allowedHexes = allowedContentTypeNames
    ? new Set([...allowedContentTypeNames].map(n => CONTENT_TYPE_HEX.get(n)).filter((h): h is string => h !== undefined))
    : null
  const knownHexes = allowedHexes ? new Set(CONTENT_TYPE_HEX.values()) : null
  const total = titles.length
  let completed = 0
  onEvent({ type: 'progress', completed: 0, total })

  for (const title of titles) {
    if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

    onEvent({ type: 'log', message: `Copying ${title.displayName}…` })

    for (const [partition, partitionHandle] of partitionTuples) {
      let sourceTitleDir: FileSystemDirectoryHandle
      try {
        sourceTitleDir = await partitionHandle.getDirectoryHandle(title.titleIdHex)
      } catch {
        continue
      }

      const targetPartitionDir = await targetRoot.getDirectoryHandle(partition.directoryName, { create: true })
      const targetTitleDir = await targetPartitionDir.getDirectoryHandle(title.titleIdHex, { create: true })

      for await (const entry of sourceTitleDir.values()) {
        if (entry.kind !== 'directory') continue
        const contentTypeName = entry.name
        if (allowedHexes && knownHexes) {
          const hexLower = contentTypeName.toLowerCase()
          if (knownHexes.has(hexLower) && !allowedHexes.has(hexLower)) continue
        }

        console.log(
          `copying ${title.displayName} ${contentTypeName} from ${partition.directoryName}/${title.titleIdHex}/${contentTypeName}`,
        )

        if (signal.aborted) {
          if (await isDirEmpty(targetTitleDir)) {
            await targetPartitionDir.removeEntry(title.titleIdHex, { recursive: true })
          }
          onEvent({ type: 'cancelled' })
          return
        }

        const sourceContentDir = await sourceTitleDir.getDirectoryHandle(contentTypeName)
        const targetContentDir = await targetTitleDir.getDirectoryHandle(contentTypeName, { create: true })
        let cancelled = false

        for await (const fileEntry of sourceContentDir.values()) {
          if (fileEntry.kind !== 'file') continue
          if (signal.aborted) { cancelled = true; break }
          await copyFile(sourceContentDir, fileEntry.name, targetContentDir)
          if (signal.aborted) { cancelled = true; break }
        }

        if (cancelled) {
          await targetTitleDir.removeEntry(contentTypeName, { recursive: true })
          if (await isDirEmpty(targetTitleDir)) {
            await targetPartitionDir.removeEntry(title.titleIdHex, { recursive: true })
          }
          onEvent({ type: 'cancelled' })
          return
        }
      }
    }

    completed++
    onEvent({ type: 'log', message: `Copying ${title.displayName}… done.`, replace: true })
    onEvent({ type: 'progress', completed, total })
  }

  onEvent({ type: 'done' })
}
