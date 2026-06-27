import { type Partition, classifyPartitionName } from 'xcontent'

export type DiscoverPartitionsResult = {
  partitions: [Partition, FileSystemDirectoryHandle][]
  ignoredCount: number
}

/** Scans a Content/ root directory and returns all valid partitions paired with their directory handles. Non-partition entries (wrong name format, files) are counted in ignoredCount and skipped. */
export async function discoverPartitions(
  contentRoot: FileSystemDirectoryHandle,
): Promise<DiscoverPartitionsResult> {
  const partitions: [Partition, FileSystemDirectoryHandle][] = []
  let ignoredCount = 0

  for await (const [name, handle] of contentRoot.entries()) {
    if (handle.kind !== 'directory') {
      ignoredCount++
      continue
    }
    const kind = classifyPartitionName(name)
    if (kind !== null) {
      const partition: Partition = {
        kind,
        directoryName: name,
        profileId: kind === 'profile' ? name : null,
      }
      partitions.push([partition, handle as FileSystemDirectoryHandle])
    } else {
      console.debug(`[xcontent-web] discoverPartitions: ignoring "${name}" (not a 16-character hex string)`)
      ignoredCount++
    }
  }

  return { partitions, ignoredCount }
}
