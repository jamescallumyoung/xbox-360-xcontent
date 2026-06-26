import type { PartitionKind } from '../types.js'

const PARTITION_NAME_PATTERN = /^[0-9a-fA-F]{16}$/
const PUBLIC_PARTITION_NAME = '0000000000000000'

/** Returns the partition kind for a Content/ subdirectory name, or null if the name is not a 16-character hex string. */
export function classifyPartitionName(dirName: string): PartitionKind | null {
  if (!PARTITION_NAME_PATTERN.test(dirName)) return null
  return dirName === PUBLIC_PARTITION_NAME ? 'public' : 'profile'
}
