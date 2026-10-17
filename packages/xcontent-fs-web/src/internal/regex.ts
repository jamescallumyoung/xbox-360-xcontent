/**
 * Escapes the regular expression syntax characters in `text`, so a pattern built
 * from it matches `text` literally.
 *
 * Function design doc, J1.13. FATX names can contain `. ( ) [ ] ^ $ { }`
 * (spec §5), so a package name must be escaped before it goes into a pattern.
 * This stands in for `RegExp.escape`, which is ES2025; the package targets
 * ES2024. Patterns built with it must not use the `u` or `v` flag.
 */
export function escapeRegExp(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
}
