import { createHash } from 'node:crypto'

// A test-only builder for synthetic package headers, for edge cases the real
// fixtures don't cover.
//
// It deliberately uses literal offsets copied from the spec (xcontent-spec2.md
// §6), and never imports the package's own layout constants. A wrong constant in
// the package then can't be confirmed by its own copy here.

const MAGIC_OFFSET = 0x000 // §6.2
const CONTENT_ID_OFFSET = 0x32c // §6.3
const HEADER_SIZE_OFFSET = 0x340 // §6.3
const HASHED_FROM = 0x344 // §6.3: the content ID covers 0x344 up to the padded end
const METADATA_VERSION_OFFSET = 0x348 // §6.4

/** The padded length of a header (§6.1): 0xA000 for a 0x971A header, otherwise 0xB000. */
const paddedLength = (headerSize: number): number => (headerSize === 0x971a ? 0xa000 : 0xb000)

export interface HeaderBuilder {
  setBytes(offset: number, bytes: ArrayLike<number>): HeaderBuilder
  setU8(offset: number, value: number): HeaderBuilder
  setU16(offset: number, value: number): HeaderBuilder
  setU32(offset: number, value: number): HeaderBuilder
  setU64(offset: number, value: bigint): HeaderBuilder
  /** Writes each UTF-16 code unit big-endian. Writes no terminator. */
  setUtf16(offset: number, text: string): HeaderBuilder
  /** Cuts the header to `length` bytes. */
  truncate(length: number): HeaderBuilder
  /** Sets the content ID to the SHA-1 of 0x344 up to the padded end (§6.3). */
  withContentId(): HeaderBuilder
  /** Returns a copy of the bytes built so far. */
  bytes(): Uint8Array
}

export interface BuildHeaderOptions {
  /** Any 4 characters. Real magics are 'CON ', 'LIVE' and 'PIRS'. */
  magic: string
  /** Defaults to 0x971A for 'CON ' and 0xAD0E otherwise. */
  headerSize?: number
  /** The stored metadata version. Defaults to 2. */
  metadataVersion?: number
}

/** Builds a zero-filled header of the padded length, with the magic, header size and metadata version set. */
export function buildHeader({ magic, headerSize, metadataVersion = 2 }: BuildHeaderOptions): HeaderBuilder {
  const size = headerSize ?? (magic === 'CON ' ? 0x971a : 0xad0e)
  const builder = builderFor(new Uint8Array(paddedLength(size)))
  for (let i = 0; i < 4; i++) builder.setU8(MAGIC_OFFSET + i, magic.charCodeAt(i))
  return builder.setU32(HEADER_SIZE_OFFSET, size).setU32(METADATA_VERSION_OFFSET, metadataVersion)
}

/** Starts a builder from a copy of existing bytes, such as a real fixture. */
export function headerFrom(bytes: Uint8Array): HeaderBuilder {
  return builderFor(bytes.slice())
}

function builderFor(initial: Uint8Array): HeaderBuilder {
  let buffer = initial
  const view = () => new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  const builder: HeaderBuilder = {
    setBytes(offset, bytes) {
      buffer.set(bytes, offset)
      return builder
    },
    setU8(offset, value) {
      view().setUint8(offset, value)
      return builder
    },
    setU16(offset, value) {
      view().setUint16(offset, value)
      return builder
    },
    setU32(offset, value) {
      view().setUint32(offset, value)
      return builder
    },
    setU64(offset, value) {
      view().setBigUint64(offset, value)
      return builder
    },
    setUtf16(offset, text) {
      for (let i = 0; i < text.length; i++) view().setUint16(offset + i * 2, text.charCodeAt(i))
      return builder
    },
    truncate(length) {
      buffer = buffer.slice(0, length)
      return builder
    },
    withContentId() {
      const end = paddedLength(view().getUint32(HEADER_SIZE_OFFSET))
      const hash = createHash('sha1').update(buffer.subarray(HASHED_FROM, end)).digest()
      buffer.set(hash, CONTENT_ID_OFFSET)
      return builder
    },
    bytes() {
      return buffer.slice()
    },
  }
  return builder
}
