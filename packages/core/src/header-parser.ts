import type { SigningMagic, ContentTypeName } from './types.js'
import { getContentTypeName } from './content-types.js'

export type ParsedHeader = {
  magic: SigningMagic
  contentType: number
  contentTypeName: ContentTypeName
  titleId: number
  titleIdHex: string
  displayName: string
}

const DISPLAY_NAME_OFFSET = 0x0411
const DISPLAY_NAME_SLOT_SIZE = 0x80
const DISPLAY_NAME_SLOT_COUNT = 18

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0
}

function readMagic(bytes: Uint8Array): SigningMagic | null {
  const b0 = bytes[0], b1 = bytes[1], b2 = bytes[2], b3 = bytes[3]
  if (b0 === 0x43 && b1 === 0x4F && b2 === 0x4E && b3 === 0x20) return 'CON'
  if (b0 === 0x4C && b1 === 0x49 && b2 === 0x56 && b3 === 0x45) return 'LIVE'
  if (b0 === 0x50 && b1 === 0x49 && b2 === 0x52 && b3 === 0x53) return 'PIRS'
  return null
}

const utf16le = new TextDecoder('utf-16le')

function readDisplayName(bytes: Uint8Array, titleIdHex: string): string {
  for (let i = 0; i < DISPLAY_NAME_SLOT_COUNT; i++) {
    const offset = DISPLAY_NAME_OFFSET + i * DISPLAY_NAME_SLOT_SIZE
    const slot = bytes.subarray(offset, offset + DISPLAY_NAME_SLOT_SIZE)
    const text = utf16le.decode(slot).replace(/\0/g, '').trim()
    if (text.length > 0) return text
  }
  return titleIdHex
}

export function parseHeader(bytes: Uint8Array): ParsedHeader | null {
  if (bytes.length < 0x0364) return null

  const magic = readMagic(bytes)
  if (magic === null) return null

  const contentType = readUint32BE(bytes, 0x0344)
  const titleId = readUint32BE(bytes, 0x0360)
  if (titleId === 0) return null

  const titleIdHex = titleId.toString(16).toUpperCase().padStart(8, '0')
  const contentTypeName = getContentTypeName(contentType)

  let displayName: string
  if (bytes.length >= DISPLAY_NAME_OFFSET + DISPLAY_NAME_SLOT_SIZE) {
    displayName = readDisplayName(bytes, titleIdHex)
  } else {
    displayName = titleIdHex
  }

  return { magic, contentType, contentTypeName, titleId, titleIdHex, displayName }
}
