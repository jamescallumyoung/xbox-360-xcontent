import type { FixupEntry } from './verify.js'
import { copyFile, hashFileContent } from './_utils.js'

export type RepairEvent =
  | { type: 'log'; message: string; replace?: true }
  | { type: 'progress'; completed: number; total: number }
  | { type: 'done'; repaired: number; failed: number }
  | { type: 'cancelled' }

export async function repairFiles(
  fixupList: FixupEntry[],
  onEvent: (event: RepairEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const total = fixupList.length
  let completed = 0
  let repaired = 0
  let failed = 0

  onEvent({ type: 'progress', completed: 0, total })

  for (const entry of fixupList) {
    if (signal.aborted) { onEvent({ type: 'cancelled' }); return }

    onEvent({ type: 'log', message: `  ${entry.path}…` })

    // Remove the existing (potentially corrupt/incomplete) file if present
    try {
      await entry.targetDir.removeEntry(entry.fileName)
    } catch {
      // not present — fine, we're about to copy it anyway
    }

    // Copy fresh from source
    try {
      await copyFile(entry.sourceDir, entry.fileName, entry.targetDir)
    } catch {
      console.log(`REPAIR FAILED (copy): ${entry.path}`)
      onEvent({ type: 'log', message: `  ${entry.path}… copy failed.`, replace: true })
      failed++
      completed++
      onEvent({ type: 'progress', completed, total })
      continue
    }

    // Immediately fast-verify the repaired file
    let ok = false
    try {
      const [srcFile, dstFile] = await Promise.all([
        entry.sourceDir.getFileHandle(entry.fileName).then(h => h.getFile()),
        entry.targetDir.getFileHandle(entry.fileName).then(h => h.getFile()),
      ])
      if (srcFile.size === dstFile.size) {
        const [sh, th] = await Promise.all([
          hashFileContent(srcFile, 'fast'),
          hashFileContent(dstFile, 'fast'),
        ])
        ok = sh === th
      }
    } catch {
      // unable to read back — treat as failed
    }

    if (ok) {
      console.log(`REPAIRED: ${entry.path}`)
      onEvent({ type: 'log', message: `  ${entry.path}… ok.`, replace: true })
      repaired++
    } else {
      console.log(`REPAIR FAILED (verify): ${entry.path}`)
      onEvent({ type: 'log', message: `  ${entry.path}… failed.`, replace: true })
      failed++
    }

    completed++
    onEvent({ type: 'progress', completed, total })
  }

  onEvent({ type: 'done', repaired, failed })
}
