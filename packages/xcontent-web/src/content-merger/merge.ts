import type { Partition } from 'xcontent'
import { copyFile } from './_utils.js'

export type MergeSource = {
  name: string
  partitions: [Partition, FileSystemDirectoryHandle][]
}

export type MergeEvent =
  | { type: 'log'; message: string; replace?: true }
  | { type: 'progress'; completed: number; total: number }
  | { type: 'done' }
  | { type: 'cancelled' }

const TITLE_DIR_RE = /^[0-9A-Fa-f]{8}$/
const CONTENT_TYPE_DIR_RE = /^[0-9A-Fa-f]{8}$/

async function isDirEmpty(handle: FileSystemDirectoryHandle): Promise<boolean> {
  for await (const _ of handle.values()) return false
  return true
}

async function contentTypeDirExists(
  titleDir: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await titleDir.getDirectoryHandle(name)
    return true
  } catch {
    return false
  }
}

export async function mergeSources(
  sources: MergeSource[],
  targetRoot: FileSystemDirectoryHandle,
  onEvent: (event: MergeEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const total = sources.length
  let completed = 0
  onEvent({ type: 'progress', completed: 0, total })

  for (const source of sources) {
    if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

    console.log(`[merge] source: ${source.name}`)
    onEvent({ type: 'log', message: `Merging from ${source.name}…` })

    for (const [partition, partitionHandle] of source.partitions) {
      if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

      const targetPartitionDir = await targetRoot.getDirectoryHandle(partition.directoryName, { create: true })

      for await (const titleEntry of partitionHandle.values()) {
        if (titleEntry.kind !== 'directory' || !TITLE_DIR_RE.test(titleEntry.name)) continue
        const titleDirName = titleEntry.name
        const titlePath = `${partition.directoryName}/${titleDirName}`

        if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

        onEvent({ type: 'log', message: `  ${titleDirName}…` })

        const sourceTitleDir = await partitionHandle.getDirectoryHandle(titleDirName)
        const targetTitleDir = await targetPartitionDir.getDirectoryHandle(titleDirName, { create: true })
        let anyContentFound = false
        let anyContentCopied = false

        for await (const ctEntry of sourceTitleDir.values()) {
          if (ctEntry.kind !== 'directory' || !CONTENT_TYPE_DIR_RE.test(ctEntry.name)) continue
          anyContentFound = true
          const contentTypeName = ctEntry.name

          if (await contentTypeDirExists(targetTitleDir, contentTypeName)) {
            console.log(`skipping ${titlePath}/${contentTypeName} — already exists in target`)
            continue
          }

          if (signal.aborted) {
            if (await isDirEmpty(targetTitleDir)) {
              await targetPartitionDir.removeEntry(titleDirName, { recursive: true })
            }
            onEvent({ type: 'cancelled' })
            return
          }

          console.log(`merging ${titlePath}/${contentTypeName}`)

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
              await targetPartitionDir.removeEntry(titleDirName, { recursive: true })
            }
            onEvent({ type: 'cancelled' })
            return
          }

          anyContentCopied = true
        }

        let titleResult: string
        if (anyContentCopied) {
          titleResult = 'done.'
        } else if (!anyContentFound) {
          console.log(`skipping ${titlePath} — no valid content type directories`)
          titleResult = 'skipped (no content).'
        } else {
          console.log(`skipping ${titlePath} — all content already in target`)
          titleResult = 'skipped (already in target).'
        }

        onEvent({ type: 'log', message: `  ${titleDirName}… ${titleResult}`, replace: true })
      }
    }

    completed++
    onEvent({ type: 'progress', completed, total })
  }

  onEvent({ type: 'done' })
}
