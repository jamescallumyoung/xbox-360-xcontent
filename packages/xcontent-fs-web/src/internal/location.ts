import type { InvalidLocationReason, PackageLocation } from '../types.js';

const SIXTEEN_HEX_DIGITS = /^[0-9A-F]{16}$/;
const EIGHT_HEX_DIGITS = /^[0-9A-F]{8}$/;

/**
 * Copies a location and checks it, reporting every invalid field together.
 *
 * Function design doc, package-wide rules 4, 6 and 7. Each field is read once,
 * into the copy, and only the copy is checked and returned, so changing the
 * caller's object later has no effect. Lowercase hex is rejected, not
 * converted. Fields that aren't strings (from JavaScript callers) are invalid.
 */
export function checkLocation(location: PackageLocation): [true, PackageLocation] | [false, InvalidLocationReason[]] {
  const source: Partial<Record<keyof PackageLocation, unknown>> =
    typeof location === 'object' && (location as unknown) !== null ? location : {};
  const copy = {
    partition: source.partition,
    titleId: source.titleId,
    contentType: source.contentType,
    packageName: source.packageName,
  };

  const reasons: InvalidLocationReason[] = [];
  const check = (field: keyof PackageLocation, isValid: (value: string) => boolean): void => {
    const value = copy[field];
    if (typeof value !== 'string' || !isValid(value)) {
      reasons.push({ kind: 'invalid-location', field, value: String(value) });
    }
  };
  check('partition', (value) => SIXTEEN_HEX_DIGITS.test(value));
  check('titleId', (value) => EIGHT_HEX_DIGITS.test(value));
  check('contentType', (value) => EIGHT_HEX_DIGITS.test(value));
  check('packageName', isValidEntryName);

  if (reasons.length > 0) return [false, reasons];
  return [true, copy as PackageLocation];
}

/**
 * Whether the File System Access API accepts `name` as an entry name: not empty,
 * not `.` or `..`, and without `/` or `\`.
 *
 * Function design doc, rule 7.2. FATX's stricter rules don't apply: an entry
 * that exists can always be named.
 */
export function isValidEntryName(name: string): boolean {
  return name !== '' && name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\');
}
