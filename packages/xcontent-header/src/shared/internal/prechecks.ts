import type { DeclaredSigning, HeaderSize, PrecheckResult } from '../precheck-header.js'
import { readU32 } from './bytes.js'
import { decodeLatin1Field } from './text.js'
import {
  HEADER_SIZE_END,
  HEADER_SIZE_INSTALLER,
  HEADER_SIZE_OFFSET,
  HEADER_SIZE_STANDARD,
  MAGIC_LENGTH,
  MAGIC_OFFSET,
} from './layout.js'

const SIGNING_BY_MAGIC: Partial<Record<string, DeclaredSigning>> = {
  'CON ': 'CON',
  LIVE: 'LIVE',
  PIRS: 'PIRS',
}

const isHeaderSize = (value: number): value is HeaderSize =>
  value === HEADER_SIZE_STANDARD || value === HEADER_SIZE_INSTALLER

/**
 * Runs the shared pre-checks, requiring `requiredLength(headerSize)` bytes in the
 * last step.
 *
 * `precheckHeader` requires the header size itself; `precheckPaddedHeader`
 * requires the padded header. Everything else is the same.
 */
export function runPrechecks(bytes: Uint8Array, requiredLength: (headerSize: HeaderSize) => number): PrecheckResult {
  const got = bytes.length

  if (got < MAGIC_LENGTH) return [false, [{ kind: 'insufficient-bytes', needed: MAGIC_LENGTH, got }]]

  const declaredSigning = SIGNING_BY_MAGIC[decodeLatin1Field(bytes, MAGIC_OFFSET, MAGIC_LENGTH)]
  if (declaredSigning === undefined) return [false, [{ kind: 'not-a-package' }]]

  if (got < HEADER_SIZE_END) return [false, [{ kind: 'insufficient-bytes', needed: HEADER_SIZE_END, got }]]

  const headerSize = readU32(bytes, HEADER_SIZE_OFFSET)
  if (!isHeaderSize(headerSize)) return [false, [{ kind: 'header-size-invalid', declared: headerSize }]]

  const needed = requiredLength(headerSize)
  if (got < needed) return [false, [{ kind: 'insufficient-bytes', needed, got }]]

  return [true, { declaredSigning, headerSize }]
}
