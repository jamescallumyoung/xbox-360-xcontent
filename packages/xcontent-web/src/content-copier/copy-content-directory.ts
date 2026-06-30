export type CopyContentDirEvent =
  | { type: 'file-progress'; fileName: string; bytesWritten: number; bytesTotal: number }
  | { type: 'file-done'; fileName: string }
  | { type: 'complete-did-write' }
  | { type: 'complete-no-op' }
  | { type: 'err-spec-violation-contains-directories' }
  | { type: 'err-file-size-mismatch'; fileName: string; expectedBytes: number; actualBytes: number }

type SourceFile = { name: string; size: number; handle: FileSystemFileHandle }
type TargetSnapshot = { files: Map<string, number>; partMarkers: Set<string> }

async function snapshotTarget(dir: FileSystemDirectoryHandle): Promise<TargetSnapshot> {
  const files = new Map<string, number>()
  const partMarkers = new Set<string>()
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'file') continue
    if (name.endsWith('.part')) {
      partMarkers.add(name)
    } else {
      files.set(name, (await (handle as FileSystemFileHandle).getFile()).size)
    }
  }
  return { files, partMarkers }
}

async function createEmptyFile(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.close()
}

export async function copyContentDirectory(
  sourceDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
  chunkSize: number,
  onEvent: (event: CopyContentDirEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const sourceFiles: SourceFile[] = []
  for await (const [name, handle] of sourceDir.entries()) {
    if (handle.kind === 'directory') {
      onEvent({ type: 'err-spec-violation-contains-directories' })
      throw new Error('Content type directory contains subdirectories (spec violation)')
    }
    const file = await handle.getFile()
    sourceFiles.push({ name, size: file.size, handle: handle })
  }
  sourceFiles.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  const { files: targetFiles, partMarkers } = await snapshotTarget(targetDir)

  const toCopy = sourceFiles.filter(src => {
    const targetSize = targetFiles.get(src.name)
    if (targetSize === undefined || targetSize !== src.size) return true
    if (partMarkers.has(`${src.name}.part`)) return true
    return false
  })

  if (toCopy.length === 0) {
    onEvent({ type: 'complete-no-op' })
    return
  }

  for (const src of toCopy) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const markerName = `${src.name}.part`
    if (!partMarkers.has(markerName)) {
      await createEmptyFile(targetDir, markerName)
    }

    const destHandle = await targetDir.getFileHandle(src.name, { create: true })
    const writable = await destHandle.createWritable()

    let bytesWritten = 0
    const sourceFile = await src.handle.getFile()

    try {
      while (bytesWritten < src.size) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        const chunk = sourceFile.slice(bytesWritten, bytesWritten + chunkSize)
        await writable.write(chunk)
        bytesWritten += chunk.size
        onEvent({ type: 'file-progress', fileName: src.name, bytesWritten, bytesTotal: src.size })
      }
      await writable.close()
    } catch (err) {
      await writable.abort()
      throw err
    }

    const actualSize = (await (await targetDir.getFileHandle(src.name)).getFile()).size
    if (actualSize !== src.size) {
      onEvent({ type: 'err-file-size-mismatch', fileName: src.name, expectedBytes: src.size, actualBytes: actualSize })
      throw new Error(`Size mismatch for "${src.name}": expected ${src.size} bytes, got ${actualSize}`)
    }

    await targetDir.removeEntry(markerName)
    onEvent({ type: 'file-done', fileName: src.name })
  }

  onEvent({ type: 'complete-did-write' })
}
