// Text fields in a header (spec §6.5).

const utf16be = new TextDecoder('utf-16be', { ignoreBOM: true });
const latin1 = new TextDecoder('latin1');

/** Cuts text at its first U+0000 character, if it has one. */
const untilTerminator = (text: string): string => {
  const end = text.indexOf('\0');
  return end === -1 ? text : text.slice(0, end);
};

/**
 * Decodes a UTF-16BE text field of `length` bytes at `offset`, or returns null
 * when it's empty.
 *
 * The text ends at the first U+0000 character, like a C `char16_t[]`, or uses the
 * field's full width when there isn't one. A field whose first code unit is
 * 0x0000 is empty.
 *
 * Unpaired surrogates are replaced with U+FFFD, so the result is always
 * well-formed. A leading byte-order mark (U+FEFF) is kept. Nothing else is
 * changed: text stored as UTF-8 inside UTF-16BE is returned exactly as decoded.
 */
export function decodeUtf16Field(bytes: Uint8Array, offset: number, length: number): string | null {
  const text = untilTerminator(utf16be.decode(bytes.subarray(offset, offset + length)));
  return text === '' ? null : text;
}

/**
 * Decodes a single-byte text field of `length` bytes at `offset`, up to its first
 * 0x00 byte.
 *
 * The header's single-byte fields (the certificate's part number and date) are
 * ASCII. The 'latin1' decoder is really windows-1252, which matches ASCII exactly
 * and only differs for bytes 0x80-0x9F.
 */
export function decodeLatin1Field(bytes: Uint8Array, offset: number, length: number): string {
  return untilTerminator(latin1.decode(bytes.subarray(offset, offset + length)));
}
