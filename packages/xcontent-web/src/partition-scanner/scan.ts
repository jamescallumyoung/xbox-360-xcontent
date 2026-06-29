import type { Partition, XContentHeader } from 'xcontent'
import { parseHeader } from 'xcontent'
import type { PartitionScanResult } from '../types.js'
import { buildTitle } from './build-title.js'

const TITLE_DIR_RE = /^[0-9A-Fa-f]{8}$/
const CONTENT_TYPE_DIR_RE = /^[0-9A-Fa-f]{8}$/
export const READ_SIZE = 0x2000

async function readHeaderBytes(fileHandle: FileSystemFileHandle): Promise<Uint8Array | null> {
  try {
    const file = await fileHandle.getFile()
    const buffer = await file.slice(0, READ_SIZE).arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

type CtScanResult =
  | { outcome: 'header'; header: XContentHeader }
  | { outcome: 'corrupt' }
  | { outcome: 'ioError' }
  | { outcome: 'empty' }

// May throw if iterating the directory itself fails (caller should retry).
async function scanCtDirectory(ctHandle: FileSystemDirectoryHandle): Promise<CtScanResult> {
  let anyFile = false
  let anyIoError = false

  for await (const [, fileEntry] of ctHandle.entries()) {
    if (fileEntry.kind !== 'file') continue
    anyFile = true

    let bytes = await readHeaderBytes(fileEntry as FileSystemFileHandle)
    if (bytes === null) {
      bytes = await readHeaderBytes(fileEntry as FileSystemFileHandle)
      if (bytes === null) { anyIoError = true; continue }
    }

    const parsed = parseHeader(bytes)
    if (parsed.success) return { outcome: 'header', header: parsed.header }
    // Non-parsing file: keep trying others before concluding corrupt
  }

  if (!anyFile) return { outcome: 'empty' }
  if (anyIoError) return { outcome: 'ioError' }
  return { outcome: 'corrupt' }
}

type TitleScanOutcome = { headers: XContentHeader[]; hasCorruptContent: boolean; hasInternalError: boolean }

// May throw if iterating titleHandle fails (caller should retry).
async function attemptScanTitleDirectory(titleHandle: FileSystemDirectoryHandle): Promise<TitleScanOutcome> {
  const headers: XContentHeader[] = []
  let hasCorruptContent = false
  let hasInternalError = false

  for await (const [ctName, ctEntry] of titleHandle.entries()) {
    if (ctEntry.kind !== 'directory' || !CONTENT_TYPE_DIR_RE.test(ctName)) continue
    const ctHandle = ctEntry as FileSystemDirectoryHandle

    let result: CtScanResult
    try {
      result = await scanCtDirectory(ctHandle)
    } catch {
      try {
        result = await scanCtDirectory(ctHandle)
      } catch {
        hasInternalError = true
        continue
      }
    }

    if (result.outcome === 'header') headers.push(result.header)
    else if (result.outcome === 'corrupt') hasCorruptContent = true
    else if (result.outcome === 'ioError') hasInternalError = true
  }

  return { headers, hasCorruptContent, hasInternalError }
}

async function scanTitleDirectory(titleHandle: FileSystemDirectoryHandle): Promise<TitleScanOutcome> {
  try {
    return await attemptScanTitleDirectory(titleHandle)
  } catch {
    try {
      return await attemptScanTitleDirectory(titleHandle)
    } catch {
      return { headers: [], hasCorruptContent: false, hasInternalError: true }
    }
  }
}

/** Scans a set of partition/handle tuples and returns all titles found within them, sorted alphabetically by display name. */
export async function scanPartitions(
  partitions: [Partition, FileSystemDirectoryHandle][],
  titleLookup?: Record<string, string>,
): Promise<PartitionScanResult> {
  const titles = []

  for (const [partition, handle] of partitions) {
    console.debug(`[xcontent-web] scanning partition ${partition.directoryName}`)
    try {
      for await (const [dirName, entry] of handle.entries()) {
        if (entry.kind !== 'directory' || !TITLE_DIR_RE.test(dirName)) continue
        const { headers, hasCorruptContent, hasInternalError } = await scanTitleDirectory(
          entry as FileSystemDirectoryHandle,
        )
        titles.push(buildTitle(dirName, headers, hasCorruptContent, hasInternalError, titleLookup))
      }
    } catch {
      console.warn(`[xcontent-web] failed to read partition ${partition.directoryName}`)
    }
  }

  titles.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))

  return { titles }
}
