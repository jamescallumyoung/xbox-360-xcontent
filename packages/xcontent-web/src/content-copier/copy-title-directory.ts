import type { ContentTypeName } from 'xcontent'
import { CONTENT_TYPE_HEX } from 'xcontent'
import { copyContentDirectory, type CopyContentDirEvent } from './copy-content-directory.js'

export type CopyTitleDirEvent =
  | { type: 'title-dir-directory-done'; directoryName: string }
  | { type: 'title-dir-did-write' }
  | { type: 'title-dir-no-op' }
  | { type: 'title-dir-err-spec-violation-contains-files' }

async function fileMap(dir: FileSystemDirectoryHandle): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file') map.set(name, (await (handle as FileSystemFileHandle).getFile()).size)
  }
  return map
}

async function ctDirIsComplete(
  sourceCtDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
  ctName: string,
  partMarkers: Set<string>,
): Promise<boolean> {
  if (partMarkers.has(`${ctName}.part`)) return false
  let targetCtDir: FileSystemDirectoryHandle
  try {
    targetCtDir = await targetDir.getDirectoryHandle(ctName)
  } catch {
    return false
  }
  const src = await fileMap(sourceCtDir)
  const tgt = await fileMap(targetCtDir)
  if (src.size !== tgt.size) return false
  for (const [name, size] of src) {
    if (tgt.get(name) !== size) return false
  }
  return true
}

export async function copyTitleDirectory(
  sourceDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
  chunkSize: number,
  onEvent: (event: CopyTitleDirEvent | CopyContentDirEvent) => void,
  signal: AbortSignal,
  allowedContentTypeNames?: ReadonlySet<ContentTypeName>,
): Promise<void> {
  const allowedHexes = allowedContentTypeNames
    ? new Set([...allowedContentTypeNames].map(n => CONTENT_TYPE_HEX.get(n)).filter((h): h is string => h !== undefined))
    : null
  const knownHexes = allowedHexes ? new Set(CONTENT_TYPE_HEX.values()) : null

  const sourceCtDirs: { name: string; handle: FileSystemDirectoryHandle }[] = []
  for await (const [name, handle] of sourceDir.entries()) {
    if (handle.kind === 'file') {
      onEvent({ type: 'title-dir-err-spec-violation-contains-files' })
      throw new Error('Title directory contains files (spec violation)')
    }
    const nameLower = name.toLowerCase()
    if (knownHexes && allowedHexes && knownHexes.has(nameLower) && !allowedHexes.has(nameLower)) continue
    sourceCtDirs.push({ name, handle: handle as FileSystemDirectoryHandle })
  }
  sourceCtDirs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  const partMarkers = new Set<string>()
  for await (const [name, handle] of targetDir.entries()) {
    if (handle.kind === 'file' && name.endsWith('.part')) partMarkers.add(name)
  }

  const toCopy: { name: string; handle: FileSystemDirectoryHandle }[] = []
  for (const ct of sourceCtDirs) {
    const complete = await ctDirIsComplete(ct.handle, targetDir, ct.name, partMarkers)
    if (!complete) toCopy.push(ct)
  }

  if (toCopy.length === 0) {
    onEvent({ type: 'title-dir-no-op' })
    return
  }

  for (const ct of toCopy) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const markerName = `${ct.name}.part`
    if (!partMarkers.has(markerName)) {
      const mh = await targetDir.getFileHandle(markerName, { create: true })
      const mw = await mh.createWritable()
      await mw.close()
    }

    const targetCtDir = await targetDir.getDirectoryHandle(ct.name, { create: true })
    await copyContentDirectory(ct.handle, targetCtDir, chunkSize, onEvent, signal)

    await targetDir.removeEntry(markerName)
    onEvent({ type: 'title-dir-directory-done', directoryName: ct.name })
  }

  onEvent({ type: 'title-dir-did-write' })
}
