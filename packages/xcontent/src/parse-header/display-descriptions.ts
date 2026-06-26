import { readStr16BE } from './bytes.js'

const OFFSET = 0x0D11
const SLOT_SIZE = 0x80
const SLOT_COUNT = 18

/** Reads the 18 UTF-16BE display description locale slots at offset 0x0D11 and returns only the non-empty ones. Returns null if the buffer is too short to reach the field. */
export function parseDisplayDescriptions(bytes: Uint8Array): string[] | null {
  if (bytes.length <= OFFSET) return null
  const results: string[] = []
  for (let i = 0; i < SLOT_COUNT; i++) {
    const value = readStr16BE(bytes, OFFSET + i * SLOT_SIZE, SLOT_SIZE)
    if (value === '') {
      console.debug(`[xcontent] parseDisplayDescriptions: discarding empty slot ${i}`)
    } else {
      results.push(value)
    }
  }
  return results
}
