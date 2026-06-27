import type { Partition, XContentHeader } from 'xcontent'
import { parseHeader } from 'xcontent'
import type { PartitionScanResult } from '../types.js'
import { buildTitle } from './build-title.js'

const TITLE_DIR_RE = /^[0-9A-Fa-f]{8}$/
const CONTENT_TYPE_DIR_RE = /^[0-9A-Fa-f]{8}$/
const READ_SIZE = 0x2000

async function readHeaderBytes(fileHandle: FileSystemFileHandle): Promise<Uint8Array | null> {
  try {
    const file = await fileHandle.getFile()
    const buffer = await file.slice(0, READ_SIZE).arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

async function scanTitleDirectory(
  titleHandle: FileSystemDirectoryHandle,
  titleIdHex: string,
): Promise<{ headers: XContentHeader[]; hasCorruptContent: boolean }> {
  const headers: XContentHeader[] = []
  let hasCorruptContent = false

  try {
    for await (const [ctName, ctEntry] of titleHandle.entries()) {
      if (ctEntry.kind !== 'directory' || !CONTENT_TYPE_DIR_RE.test(ctName)) continue
      try {
        for await (const [, fileEntry] of (ctEntry as FileSystemDirectoryHandle).entries()) {
          if (fileEntry.kind !== 'file') continue
          const bytes = await readHeaderBytes(fileEntry as FileSystemFileHandle)
          if (bytes === null) {
            hasCorruptContent = true
          } else {
            const result = parseHeader(bytes)
            if (result.success) {
              headers.push(result.header)
            } else {
              hasCorruptContent = true
            }
          }
          break // only the first file in each content type directory
        }
      } catch {
        hasCorruptContent = true
      }
    }
  } catch {
    hasCorruptContent = true
  }

  return { headers, hasCorruptContent }
}

/** Scans a set of partition/handle tuples and returns all titles found within them, sorted alphabetically by display name. */
export async function scanPartitions(
  partitions: [Partition, FileSystemDirectoryHandle][],
): Promise<PartitionScanResult> {
  const titles = []

  for (const [partition, handle] of partitions) {
    console.debug(`[xcontent-web] scanning partition ${partition.directoryName}`)
    try {
      for await (const [dirName, entry] of handle.entries()) {
        if (entry.kind !== 'directory' || !TITLE_DIR_RE.test(dirName)) continue
        const { headers, hasCorruptContent } = await scanTitleDirectory(
          entry as FileSystemDirectoryHandle,
          dirName,
        )
        titles.push(buildTitle(dirName, headers, hasCorruptContent))
      }
    } catch {
      console.warn(`[xcontent-web] failed to read partition ${partition.directoryName}`)
    }
  }

  titles.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))

  return { titles }
}
