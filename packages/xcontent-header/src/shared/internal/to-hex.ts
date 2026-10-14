/**
 * Writes bytes as uppercase hex digits, two per byte, with no prefix.
 *
 * This stands in for `Uint8Array.prototype.toHex()`, which does the same (in
 * lowercase). It is available in modern browsers (ES2026) and Node 25 or later.
 * It can be replaced with `Uint8Array.prototype.toHex()` if this package ever
 * targets ES2026 and Node >=25.
 *
 * Every byte is padded to two digits, so leading zero bytes are kept: identifiers
 * are fixed-width, and `00000001` is a different string from `1`.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}
