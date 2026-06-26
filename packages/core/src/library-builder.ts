import type { Partition, Title, ContentLibrary } from './types.js'
import { parseHeader, type ParsedHeader } from './header-parser.js'
import { isGameFormat, isTitleUpdate, isDlc, isSave } from './content-types.js'

const TITLE_DIR_RE = /^[0-9A-Fa-f]{8}$/
const CONTENT_TYPE_DIR_RE = /^[0-9A-Fa-f]{8}$/
const READ_SIZE = 0x2000 // 8 KB

async function readFirst8KB(fileHandle: FileSystemFileHandle): Promise<Uint8Array | null> {
  try {
    const file = await fileHandle.getFile()
    const slice = file.slice(0, READ_SIZE)
    const buffer = await slice.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

async function buildTitle(
  titleHandle: FileSystemDirectoryHandle,
  titleIdHex: string,
): Promise<Title> {
  const headers: ParsedHeader[] = []
  let hasCorruptContent = false

  try {
    for await (const [ctName, ctEntry] of titleHandle.entries()) {
      if (ctEntry.kind !== 'directory' || !CONTENT_TYPE_DIR_RE.test(ctName)) continue

      try {
        const ctHandle = ctEntry as FileSystemDirectoryHandle
        for await (const [, fileEntry] of ctHandle.entries()) {
          if (fileEntry.kind !== 'file') continue

          const bytes = await readFirst8KB(fileEntry as FileSystemFileHandle)
          if (bytes === null) {
            hasCorruptContent = true
            break
          }

          const header = parseHeader(bytes)
          if (header === null) {
            hasCorruptContent = true
          } else {
            headers.push(header)
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

  const titleId = parseInt(titleIdHex, 16)
  const upperHex = titleIdHex.toUpperCase()
  const displayName = headers.find(h => h.displayName && h.displayName !== upperHex)?.displayName ?? upperHex

  const signingTypes = new Set(headers.map(h => h.magic))
  const contentTypes = new Set(headers.map(h => h.contentTypeName))

  const gameIsPresent = headers.some(h => isGameFormat(h.contentType))
  const hasTitleUpdate = headers.some(h => isTitleUpdate(h.contentType))
  const hasDlc = headers.some(h => isDlc(h.contentType))
  const hasSaves = headers.some(h => isSave(h.contentType))
  const hasOtherContent = headers.some(h =>
    !isGameFormat(h.contentType) &&
    !isTitleUpdate(h.contentType) &&
    !isDlc(h.contentType) &&
    !isSave(h.contentType),
  )

  console.log(`[core] title ${upperHex} — ${headers.length} header(s) parsed${hasCorruptContent ? ', some corrupt' : ''}`)

  return {
    titleId,
    titleIdHex: upperHex,
    displayName,
    signingTypes,
    contentTypes,
    gameIsPresent,
    hasTitleUpdate,
    hasDlc,
    hasSaves,
    hasOtherContent,
    hasCorruptContent,
  }
}

function buildLibrary(titles: Title[]): ContentLibrary {
  titles.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
  return { titles }
}

export async function scanPartitions(
  partitions: ReadonlyArray<Partition>,
): Promise<ContentLibrary> {
  const titles: Title[] = []

  for (const partition of partitions) {
    console.log(`[core] scanning partition ${partition.directoryName}`)
    try {
      for await (const [dirName, entry] of partition.handle.entries()) {
        if (entry.kind !== 'directory' || !TITLE_DIR_RE.test(dirName)) continue
        const title = await buildTitle(entry as FileSystemDirectoryHandle, dirName)
        titles.push(title)
      }
    } catch {
      console.warn(`[core] failed to read partition ${partition.directoryName}`)
    }
  }

  return buildLibrary(titles)
}
