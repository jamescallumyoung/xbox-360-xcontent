/**
 * The index of each language's slot in `displayNames` and `descriptions`.
 *
 * Slot n holds the language with ID n + 1 (spec §6.5). Slots 9-11 exist only in
 * metadata version 2. Slot 9 has no entry because its language isn't confirmed:
 * most sources say Simplified Chinese, but xenia-canary disagrees. Its value is
 * still at index 9.
 */
export const LanguageSlot = {
  English: 0,
  Japanese: 1,
  German: 2,
  French: 3,
  Spanish: 4,
  Italian: 5,
  Korean: 6,
  TraditionalChinese: 7,
  Portuguese: 8,
  Polish: 10,
  Russian: 11,
} as const

/** The slot index of a language with a confirmed slot: one of `LanguageSlot`'s values. */
export type LanguageSlot = (typeof LanguageSlot)[keyof typeof LanguageSlot]
