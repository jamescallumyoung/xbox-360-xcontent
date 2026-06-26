import { describe, it, expect } from 'vitest'
import { classifyPartitionName } from '../classify.js'

describe('classifyPartitionName', () => {
  it('returns "public" for the all-zeros name', () => {
    expect(classifyPartitionName('0000000000000000')).toBe('public')
  })

  it('returns "profile" for a valid 16-char hex profile ID', () => {
    expect(classifyPartitionName('E000ABCDEF123456')).toBe('profile')
    expect(classifyPartitionName('deadbeef01234567')).toBe('profile')
    expect(classifyPartitionName('1111111111111111')).toBe('profile')
  })

  it('returns null for names shorter than 16 characters', () => {
    expect(classifyPartitionName('000000000000000')).toBeNull()
    expect(classifyPartitionName('')).toBeNull()
  })

  it('returns null for names longer than 16 characters', () => {
    expect(classifyPartitionName('00000000000000000')).toBeNull()
  })

  it('returns null for names containing non-hex characters', () => {
    expect(classifyPartitionName('ZZZZZZZZZZZZZZZZ')).toBeNull()
    expect(classifyPartitionName('Content')).toBeNull()
    expect(classifyPartitionName('0000000000000000!')).toBeNull()
  })

  it('returns null for names with spaces or separators', () => {
    expect(classifyPartitionName('00000000 00000000')).toBeNull()
    expect(classifyPartitionName('0000-0000-0000-0000')).toBeNull()
  })
})
