import type { MergeSource } from './merge.js'
import { hashFileContent } from './_utils.js'

export type VerifyMode = 'fast' | 'slow'

export type FixupEntry = {
  path: string
  sourceDir: FileSystemDirectoryHandle
  targetDir: FileSystemDirectoryHandle
  fileName: string
}

export type VerifyEvent =
  | { type: 'log'; message: string; replace?: true }
  | { type: 'progress'; completed: number; total: number }
  | { type: 'done'; verified: number; mismatches: number; fixupList: FixupEntry[] }
  | { type: 'cancelled' }

const TITLE_DIR_RE = /^[0-9A-Fa-f]{8}$/
const CONTENT_TYPE_DIR_RE = /^[0-9A-Fa-f]{8}$/

export async function verifySources(
  sources: MergeSource[],
  targetRoot: FileSystemDirectoryHandle,
  onEvent: (event: VerifyEvent) => void,
  signal: AbortSignal,
  mode: VerifyMode = 'slow',
): Promise<void> {
  const total = sources.length
  let completed = 0
  let totalVerified = 0
  let totalMismatches = 0
  const fixupList: FixupEntry[] = []

  onEvent({ type: 'progress', completed: 0, total })

  for (const source of sources) {
    if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

    onEvent({ type: 'log', message: `Verifying ${source.name}…` })

    for (const [partition, partitionHandle] of source.partitions) {
      if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

      let targetPartitionDir: FileSystemDirectoryHandle
      try {
        targetPartitionDir = await targetRoot.getDirectoryHandle(partition.directoryName)
      } catch {
        continue
      }

      for await (const titleEntry of partitionHandle.values()) {
        if (titleEntry.kind !== 'directory' || !TITLE_DIR_RE.test(titleEntry.name)) continue
        const titleDirName = titleEntry.name
        const titlePath = `${partition.directoryName}/${titleDirName}`

        if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

        let targetTitleDir: FileSystemDirectoryHandle
        try {
          targetTitleDir = await targetPartitionDir.getDirectoryHandle(titleDirName)
        } catch {
          continue
        }

        onEvent({ type: 'log', message: `  ${titleDirName}…` })

        const sourceTitleDir = await partitionHandle.getDirectoryHandle(titleDirName)
        let titleVerified = 0
        let titleMismatches = 0

        for await (const ctEntry of sourceTitleDir.values()) {
          if (ctEntry.kind !== 'directory' || !CONTENT_TYPE_DIR_RE.test(ctEntry.name)) continue
          const contentTypeName = ctEntry.name

          let targetContentDir: FileSystemDirectoryHandle
          try {
            targetContentDir = await targetTitleDir.getDirectoryHandle(contentTypeName)
          } catch {
            continue
          }

          const sourceContentDir = await sourceTitleDir.getDirectoryHandle(contentTypeName)

          for await (const fileEntry of sourceContentDir.values()) {
            if (fileEntry.kind !== 'file') continue
            if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

            const fileName = fileEntry.name
            const filePath = `${titlePath}/${contentTypeName}/${fileName}`

            let targetFileHandle: FileSystemFileHandle
            try {
              targetFileHandle = await targetContentDir.getFileHandle(fileName)
            } catch {
              console.log(`MISSING in target: ${filePath}`)
              fixupList.push({ path: filePath, sourceDir: sourceContentDir, targetDir: targetContentDir, fileName })
              titleMismatches++
              totalMismatches++
              continue
            }

            const sourceFileHandle = await sourceContentDir.getFileHandle(fileName)
            const [sourceFile, targetFile] = await Promise.all([
              sourceFileHandle.getFile(),
              targetFileHandle.getFile(),
            ])

            if (mode === 'fast' && sourceFile.size !== targetFile.size) {
              console.log(`SIZE MISMATCH: ${filePath} (source ${sourceFile.size}B, target ${targetFile.size}B)`)
              fixupList.push({ path: filePath, sourceDir: sourceContentDir, targetDir: targetContentDir, fileName })
              titleMismatches++
              totalMismatches++
              continue
            }

            const [sourceHash, targetHash] = await Promise.all([
              hashFileContent(sourceFile, mode),
              hashFileContent(targetFile, mode),
            ])

            if (sourceHash !== targetHash) {
              console.log(`${mode === 'fast' ? 'TAIL MISMATCH' : 'MISMATCH'}: ${filePath}`)
              fixupList.push({ path: filePath, sourceDir: sourceContentDir, targetDir: targetContentDir, fileName })
              titleMismatches++
              totalMismatches++
            } else {
              titleVerified++
              totalVerified++
            }
          }
        }

        let titleResult: string
        if (titleVerified === 0 && titleMismatches === 0) {
          titleResult = `  ${titleDirName}… no files to verify.`
        } else if (titleMismatches === 0) {
          titleResult = `  ${titleDirName}… ok (${titleVerified} file${titleVerified === 1 ? '' : 's'}).`
        } else {
          const checked = titleVerified + titleMismatches
          titleResult = `  ${titleDirName}… ${titleMismatches} mismatch${titleMismatches === 1 ? '' : 'es'} of ${checked}.`
        }

        onEvent({ type: 'log', message: titleResult, replace: true })
      }
    }

    completed++
    onEvent({ type: 'progress', completed, total })
  }

  onEvent({ type: 'done', verified: totalVerified, mismatches: totalMismatches, fixupList })
}
