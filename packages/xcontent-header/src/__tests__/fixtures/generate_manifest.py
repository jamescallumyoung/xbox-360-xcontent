#!/usr/bin/env python3
"""Generates manifest.generated.ts: the expected values for every fixture in this folder.

The values are computed straight from each fixture's raw bytes, using offsets
copied from the spec (docs/xcontent-specification.md §6). It shares no code with the package,
so the tests can't confirm a package bug by repeating it.

Run from this folder, after adding or changing a fixture:

    python3 generate_manifest.py > manifest.generated.ts

The output starts with an @generated header, and has a `.generated` suffix. Prettier skips it.
"""

import hashlib
import json
import os
import struct
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))

DESCRIPTIONS = {
    'con-971a-mv0-download-in-progress': 'CON, 0x971A header, metadata version 0, a download in progress (spec §4.4), no thumbnail',
    'con-971a-mv2-xna-save': 'CON, 0x971A header, metadata version 2, an XNA indie save',
    'con-ad0e-svod-disc-install': 'CON with a 0xAD0E header, SVOD, a disc install',
    'live-stfs-dlc-halo-wars': 'LIVE STFS DLC',
    'live-stfs-dlc-non-ascii': 'LIVE STFS DLC, display name with ™',
    'live-stfs-mv0-title-update': 'LIVE STFS title update, metadata version 0, display name with ®',
    'live-svod-god-dead-island-riptide': 'LIVE SVOD GOD',
    'live-svod-god-empty-signature': 'LIVE SVOD GOD made by a tool: all-zero signature',
    'live-svod-god-south-park-mojibake': 'LIVE SVOD GOD with UTF-8 stored as UTF-16BE; Polish and Russian names in slots 10 and 11',
    'pirs-stfs-avatar-item-no-thumbnail': 'PIRS avatar item, thumbnail size 0',
    'pirs-stfs-dlc-non-ascii': 'PIRS STFS DLC, display name with ’',
}


def u8(b, o): return b[o]
def u16(b, o): return struct.unpack_from('>H', b, o)[0]
def u32(b, o): return struct.unpack_from('>I', b, o)[0]
def u64(b, o): return struct.unpack_from('>Q', b, o)[0]
def hexs(b, o, n): return b[o:o + n].hex().upper()
def sha1(data): return hashlib.sha1(data).hexdigest()


def utf16_field(b, o, n):
    """UTF-16BE text up to the first U+0000; None when the first code unit is 0 (spec §6.5)."""
    text = b[o:o + n].decode('utf-16-be', errors='replace')  # keeps a leading U+FEFF
    text = text.split('\0', 1)[0]
    return text if text else None


def ascii_field(b, o, n):
    """Text up to the first 0x00 byte."""
    return b[o:o + n].split(b'\0', 1)[0].decode('latin-1')


def thumbnail(b, size_offset, image_offset):
    size = u32(b, size_offset)
    if size == 0:
        return None
    return {'size': size, 'sha1': sha1(b[image_offset:image_offset + size])}


def entry(name):
    with open(os.path.join(HERE, name), 'rb') as f:
        b = f.read()
    magic = b[0:4].decode('latin-1')
    header_size = u32(b, 0x340)                      # §6.3
    padded = 0xA000 if header_size == 0x971A else 0xB000  # §6.1
    metadata_version = u32(b, 0x348)                 # §6.4
    slots = 12 if metadata_version == 2 else 9       # §6.5

    if magic == 'CON ':                              # §6.2
        signature = b[0x1AC:0x22C]
        certificate = {
            'publicKeyCertificateSize': u16(b, 0x004),
            'ownerConsoleId': hexs(b, 0x006, 5),
            'consolePartNumber': ascii_field(b, 0x00B, 0x14),
            'consoleType': u8(b, 0x01F),
            'certificateDate': ascii_field(b, 0x020, 8),
            'publicExponent': u32(b, 0x028),
            'publicModulusSha1': sha1(b[0x02C:0x0AC]),
            'certificateSignatureSha1': sha1(b[0x0AC:0x1AC]),
        }
    else:
        signature = b[0x004:0x104]
        certificate = None

    licences = []                                    # §6.3
    for i in range(16):
        o = 0x22C + i * 0x10
        licences.append({
            'licenseeType': u16(b, o),
            'licenseeData': hexs(b, o + 2, 6),
            'bits': u32(b, o + 8),
            'flags': u32(b, o + 12),
        })

    names = [utf16_field(b, 0x411 + i * 0x100, 0x100) for i in range(9)]
    descriptions = [utf16_field(b, 0xD11 + i * 0x100, 0x100) for i in range(9)]
    if slots == 12:
        names += [utf16_field(b, 0x541A + i * 0x100, 0x100) for i in range(3)]
        descriptions += [utf16_field(b, 0x941A + i * 0x100, 0x100) for i in range(3)]

    return {
        'description': DESCRIPTIONS[name],
        'fileLength': len(b),
        'magic': magic,
        'signatureAllZero': not any(signature),
        'certificate': certificate,
        'licences': licences,
        'contentId': hexs(b, 0x32C, 0x14),
        'contentIdMatchesHash': hashlib.sha1(b[0x344:padded]).digest() == b[0x32C:0x340],
        'headerSize': header_size,
        'contentType': u32(b, 0x344),
        'metadataVersion': metadata_version,
        'contentSize': ('bigint', u64(b, 0x34C)),
        'mediaId': hexs(b, 0x354, 4),
        'version': u32(b, 0x358),
        'baseVersion': u32(b, 0x35C),
        'titleId': hexs(b, 0x360, 4),
        'platform': u8(b, 0x364),
        'executableType': u8(b, 0x365),
        'discNumber': u8(b, 0x366),
        'discCount': u8(b, 0x367),
        'saveGameId': hexs(b, 0x368, 4),
        'creatorConsoleId': hexs(b, 0x36C, 5),
        'profileId': hexs(b, 0x371, 8),
        'volumeDescriptorLength': u8(b, 0x379),
        'dataFileCount': u32(b, 0x39D),
        'dataFilesSize': ('bigint', u64(b, 0x3A1)),
        'volumeType': u32(b, 0x3A9),
        'onlineCreator': hexs(b, 0x3AD, 8),
        'category': u32(b, 0x3B5),
        'reservedAllZero': not any(b[0x3B9:0x3D9]),
        'mediaOrAvatarData': hexs(b, 0x3D9, 0x24),
        'deviceId': hexs(b, 0x3FD, 0x14),
        'displayNames': names,
        'descriptions': descriptions,
        'publisherName': utf16_field(b, 0x1611, 0x80),
        'titleName': utf16_field(b, 0x1691, 0x80),
        'transferFlags': u8(b, 0x1711),
        'thumbnail': thumbnail(b, 0x1712, 0x171A),
        'titleThumbnail': thumbnail(b, 0x1716, 0x571A),
        'installerMetadataSha1': sha1(b[0x971A:0xAD0E]) if header_size == 0xAD0E else None,
    }


# Fields written in hex, because that's how the spec writes them.
HEX_KEYS = {'fileLength', 'headerSize', 'contentType', 'licenseeType', 'publicKeyCertificateSize',
            'publicExponent', 'transferFlags', 'volumeDescriptorLength', 'size'}


def string_literal(text):
    """A double-quoted string, with control characters (such as the C1 characters in mojibake) escaped."""
    out = json.dumps(text, ensure_ascii=False)
    return ''.join(f'\\u{ord(c):04X}' if unicodedata.category(c) == 'Cc' else c for c in out)


def ts(value, indent=0, key=None):
    """Formats a value as TypeScript source."""
    pad = '  ' * indent
    if isinstance(value, tuple) and value[0] == 'bigint':
        return f'{value[1]}n'
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, int):
        return f'0x{value:X}' if key in HEX_KEYS else str(value)
    if isinstance(value, str):
        return string_literal(value)
    if isinstance(value, list):
        if all(not isinstance(v, (dict, list)) for v in value):
            return '[' + ', '.join(ts(v) for v in value) + ']'
        return '[\n' + ''.join(f'{pad}  {ts(v, indent + 1)},\n' for v in value) + pad + ']'
    if isinstance(value, dict):
        if all(not isinstance(v, (dict, list)) for v in value.values()):
            return '{ ' + ', '.join(f'{k}: {ts(v, key=k)}' for k, v in value.items()) + ' }'
        return '{\n' + ''.join(f'{pad}  {k}: {ts(v, indent + 1, k)},\n' for k, v in value.items()) + pad + '}'
    raise TypeError(value)


def main():
    names = sorted(f for f in os.listdir(HERE) if '.' not in f)
    out = sys.stdout
    out.write('// @generated by generate_manifest.py from the raw fixture bytes. Do not edit by hand.\n')
    out.write("import type { ManifestEntry } from './manifest-types.js'\n\n")
    out.write('export const manifest = {\n')
    for name in names:
        out.write(f"  '{name}': {ts(entry(name), 1)},\n")
    out.write('} as const satisfies Record<string, ManifestEntry>\n')


if __name__ == '__main__':
    main()
