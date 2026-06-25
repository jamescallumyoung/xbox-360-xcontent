import type { Partition } from './types.js'

const PARTITION_DIR_PATTERN = /^[0-9a-fA-F]{16}$/
const PUBLIC_PARTITION_NAME = '0000000000000000'

function classifyPartition(
  dirName: string,
  handle: FileSystemDirectoryHandle,
): Partition | null {
  if (!PARTITION_DIR_PATTERN.test(dirName)) return null
  const isPublic = dirName === PUBLIC_PARTITION_NAME
  return {
    directoryName: dirName,
    isPublic,
    profileId: isPublic ? null : dirName,
    handle,
  }
}

export type DiscoverPartitionsResult = {
  partitions: Partition[]
  ignoredCount: number
}

export async function discoverPartitions(
  rootHandle: FileSystemDirectoryHandle,
): Promise<DiscoverPartitionsResult> {
  const partitions: Partition[] = []
  let ignoredCount = 0

  for await (const [name, handle] of rootHandle.entries()) {
    if (handle.kind !== 'directory') continue
    const partition = classifyPartition(name, handle as FileSystemDirectoryHandle)
    if (partition !== null) {
      console.log(`[core] ${name} → valid partition (${partition.isPublic ? 'public' : 'profile'})`)
      partitions.push(partition)
    } else {
      console.log(`[core] ${name} → ignored (not a valid partition directory)`)
      ignoredCount++
    }
  }

  return { partitions, ignoredCount }
}
