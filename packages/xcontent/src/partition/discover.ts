import type { Partition } from '../types.js'
import { classifyPartitionName } from './classify.js'

export type DiscoverPartitionsResult = {
  partitions: Partition[]
  ignoredCount: number
}

/** Scans a Content/ root directory and returns all valid partitions. Non-partition entries (wrong name format, files) are counted in ignoredCount and skipped. */
export async function discoverPartitions(
  contentRoot: FileSystemDirectoryHandle,
): Promise<DiscoverPartitionsResult> {
  const partitions: Partition[] = []
  let ignoredCount = 0

  for await (const [name, handle] of contentRoot.entries()) {
    if (handle.kind !== 'directory') {
      ignoredCount++
      continue
    }
    const kind = classifyPartitionName(name)
    if (kind !== null) {
      partitions.push({
        kind,
        directoryName: name,
        profileId: kind === 'profile' ? name : null,
        handle: handle as FileSystemDirectoryHandle,
      })
    } else {
      console.debug(`[xcontent] discoverPartitions: ignoring "${name}" (not a 16-character hex string)`)
      ignoredCount++
    }
  }

  return { partitions, ignoredCount }
}
