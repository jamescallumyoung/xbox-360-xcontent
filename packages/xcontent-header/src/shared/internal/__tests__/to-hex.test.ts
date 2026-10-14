import { describe, expect, it } from 'vitest';
import { toHex } from '../to-hex.js';

describe('toHex (R1.15)', () => {
  it('writes uppercase hex digits with no prefix', () => {
    expect(toHex(new Uint8Array([0x4d, 0x53, 0x07, 0xe6]))).toBe('4D5307E6');
  });

  it('pads every byte to two digits, keeping leading zeros', () => {
    expect(toHex(new Uint8Array([0x00, 0x00, 0x00, 0x01]))).toBe('00000001');
  });

  it('pads bytes below 0x10 anywhere in a value, next to bytes that need no padding', () => {
    expect(toHex(new Uint8Array([0x0a, 0xb0, 0x05]))).toBe('0AB005');
  });

  it('writes two digits per byte, for any width', () => {
    expect(toHex(new Uint8Array(20))).toBe('0'.repeat(40));
    expect(toHex(new Uint8Array(5).fill(0xff))).toBe('FFFFFFFFFF');
  });

  it('writes an empty string for no bytes', () => {
    expect(toHex(new Uint8Array(0))).toBe('');
  });
});
