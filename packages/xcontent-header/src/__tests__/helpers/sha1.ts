import { createHash } from 'node:crypto';

/** The lowercase hex SHA-1 of some bytes, for comparing byte blocks with the manifest. */
export const sha1Hex = (bytes: Uint8Array): string => createHash('sha1').update(bytes).digest('hex');

/** Uppercase hex of some bytes, for comparing with the manifest's hex fields. */
export const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex').toUpperCase();
