import { copyBytes } from './internal/bytes.js';
import {
  HEADER_SIZE_INSTALLER,
  INSTALLER_METADATA_LENGTH,
  INSTALLER_METADATA_OFFSET,
  MEDIA_OR_AVATAR_DATA_LENGTH,
  MEDIA_OR_AVATAR_DATA_OFFSET,
} from './internal/layout.js';
import { parseHeaderSize } from './header-info.js';
import { parseMetadataVersion } from './metadata-version.js';

/**
 * Returns a copy of the 0x24 bytes at 0x3D9, or null in metadata version 1, where
 * they're unused.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * In metadata version 2 these bytes hold either media data or avatar asset data
 * (spec §6.4). The spec doesn't say how to tell which, so they're returned raw.
 */
export function parseMediaOrAvatarData(bytes: Uint8Array): Uint8Array | null {
  if (parseMetadataVersion(bytes).effective !== 2) return null;
  return copyBytes(bytes, MEDIA_OR_AVATAR_DATA_OFFSET, MEDIA_OR_AVATAR_DATA_LENGTH);
}

/**
 * Returns a copy of the installer metadata, 0x15F4 bytes from 0x971A, or null for
 * a header without any.
 *
 * Requires bytes that passed `precheckHeader`: the header up to its header size,
 * 0x971A or 0xAD0E bytes. Reading 0xB000 bytes always suffices.
 *
 * Only a header of size 0xAD0E has installer metadata (spec §6.1). The spec has
 * no layout for it, so it's returned raw.
 */
export function parseInstallerMetadata(bytes: Uint8Array): Uint8Array | null {
  if (parseHeaderSize(bytes) !== HEADER_SIZE_INSTALLER) return null;
  return copyBytes(bytes, INSTALLER_METADATA_OFFSET, INSTALLER_METADATA_LENGTH);
}
