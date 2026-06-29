export const TAIL_SIZE = 4096

export async function copyFile(
  sourceDir: FileSystemDirectoryHandle,
  name: string,
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  const src = await sourceDir.getFileHandle(name)
  const file = await src.getFile()
  const buffer = await file.arrayBuffer()
  const dst = await targetDir.getFileHandle(name, { create: true })
  const writable = await dst.createWritable()
  try {
    await writable.write(buffer)
    await writable.close()
  } catch (err) {
    await writable.abort()
    throw err
  }
}

export async function hashFileContent(file: File, mode: 'fast' | 'slow'): Promise<string> {
  const blob = mode === 'fast' ? file.slice(Math.max(0, file.size - TAIL_SIZE)) : file
  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
