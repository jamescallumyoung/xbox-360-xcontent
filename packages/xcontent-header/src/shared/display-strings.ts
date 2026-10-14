import {
  BASE_LANGUAGE_SLOTS,
  DESCRIPTIONS_OFFSET,
  DISPLAY_NAMES_OFFSET,
  EXTRA_DESCRIPTIONS_OFFSET,
  EXTRA_DISPLAY_NAMES_OFFSET,
  EXTRA_LANGUAGE_SLOTS,
  LANGUAGE_SLOT_LENGTH,
  NAME_FIELD_LENGTH,
  PUBLISHER_NAME_OFFSET,
  TITLE_NAME_OFFSET,
} from './internal/layout.js';
import { decodeUtf16Field } from './internal/text.js';
import { parseMetadataVersion } from './metadata-version.js';

/** Reads every language slot: slots 0-8 from `baseOffset`, plus 9-11 from `extraOffset` in version 2. */
const readLanguageSlots = (bytes: Uint8Array, baseOffset: number, extraOffset: number): (string | null)[] => {
  const slot = (offset: number, index: number) =>
    decodeUtf16Field(bytes, offset + index * LANGUAGE_SLOT_LENGTH, LANGUAGE_SLOT_LENGTH);
  const slots = Array.from({ length: BASE_LANGUAGE_SLOTS }, (_, i) => slot(baseOffset, i));
  if (parseMetadataVersion(bytes).effective === 2) {
    slots.push(...Array.from({ length: EXTRA_LANGUAGE_SLOTS }, (_, i) => slot(extraOffset, i)));
  }
  return slots;
};

/**
 * Returns the display name in each language slot: 9 slots, or 12 in metadata
 * version 2. An empty slot is null.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * Each value stays at its slot's index, so `LanguageSlot` can look one up (for
 * example `names[LanguageSlot.French]`). Slots 0-8 are at 0x411; version 2's slots
 * 9-11 are at 0x541A, in space taken from the thumbnail (spec §6.5). Text is
 * UTF-16BE: unpaired surrogates become U+FFFD, and nothing else is repaired.
 */
export function parseDisplayNames(bytes: Uint8Array): (string | null)[] {
  return readLanguageSlots(bytes, DISPLAY_NAMES_OFFSET, EXTRA_DISPLAY_NAMES_OFFSET);
}

/**
 * Returns the description in each language slot: 9 slots, or 12 in metadata
 * version 2. An empty slot is null.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * Each value stays at its slot's index, as in `parseDisplayNames`. Slots 0-8 are
 * at 0xD11; version 2's slots 9-11 are at 0x941A (spec §6.5).
 */
export function parseDescriptions(bytes: Uint8Array): (string | null)[] {
  return readLanguageSlots(bytes, DESCRIPTIONS_OFFSET, EXTRA_DESCRIPTIONS_OFFSET);
}

/**
 * Returns the publisher name at 0x1611, or null when it's empty.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It's up to 64 UTF-16BE code units (0x80 bytes).
 */
export function parsePublisherName(bytes: Uint8Array): string | null {
  return decodeUtf16Field(bytes, PUBLISHER_NAME_OFFSET, NAME_FIELD_LENGTH);
}

/**
 * Returns the title name at 0x1691, or null when it's empty.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * It's up to 64 UTF-16BE code units (0x80 bytes).
 */
export function parseTitleName(bytes: Uint8Array): string | null {
  return decodeUtf16Field(bytes, TITLE_NAME_OFFSET, NAME_FIELD_LENGTH);
}
