export type CleanupEvent =
  | { type: 'log'; message: string }
  | { type: 'done'; removedContentTypeDirs: number; removedTitleDirs: number }
  | { type: 'cancelled' }

const TITLE_DIR_RE = /^[0-9A-Fa-f]{8}$/
const CONTENT_TYPE_DIR_RE = /^[0-9A-Fa-f]{8}$/

async function isDirEmpty(dir: FileSystemDirectoryHandle): Promise<boolean> {
  for await (const _ of dir.values()) return false
  return true
}

export async function cleanupContentRoot(
  contentRoot: FileSystemDirectoryHandle,
  onEvent: (event: CleanupEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let removedContentTypeDirs = 0
  let removedTitleDirs = 0

  const partitionEntries: FileSystemHandle[] = []
  for await (const entry of contentRoot.values()) partitionEntries.push(entry)

  for (const partitionEntry of partitionEntries) {
    if (partitionEntry.kind !== 'directory') continue
    if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

    const partitionDir = await contentRoot.getDirectoryHandle(partitionEntry.name)

    const titleEntries: FileSystemHandle[] = []
    for await (const entry of partitionDir.values()) titleEntries.push(entry)

    for (const titleEntry of titleEntries) {
      if (titleEntry.kind !== 'directory' || !TITLE_DIR_RE.test(titleEntry.name)) continue
      if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

      const titlePath = `${partitionEntry.name}/${titleEntry.name}`
      const titleDir = await partitionDir.getDirectoryHandle(titleEntry.name)

      const ctEntries: FileSystemHandle[] = []
      for await (const entry of titleDir.values()) ctEntries.push(entry)

      let removedInTitle = 0
      for (const ctEntry of ctEntries) {
        if (ctEntry.kind !== 'directory' || !CONTENT_TYPE_DIR_RE.test(ctEntry.name)) continue
        const ctDir = await titleDir.getDirectoryHandle(ctEntry.name)
        if (await isDirEmpty(ctDir)) {
          await titleDir.removeEntry(ctEntry.name)
          removedInTitle++
          removedContentTypeDirs++
        }
      }

      if (await isDirEmpty(titleDir)) {
        await partitionDir.removeEntry(titleEntry.name)
        removedTitleDirs++
        if (removedInTitle > 0) {
          onEvent({ type: 'log', message: `  ${titlePath}: removed ${removedInTitle} empty content type dir${removedInTitle === 1 ? '' : 's'}, title dir also removed.` })
        } else {
          onEvent({ type: 'log', message: `  ${titlePath}: empty title dir removed.` })
        }
      } else if (removedInTitle > 0) {
        onEvent({ type: 'log', message: `  ${titlePath}: removed ${removedInTitle} empty content type dir${removedInTitle === 1 ? '' : 's'}.` })
      }
    }
  }

  onEvent({ type: 'done', removedContentTypeDirs, removedTitleDirs })
}
