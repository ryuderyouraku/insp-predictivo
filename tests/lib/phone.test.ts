import { describe, it, expect } from 'vitest'
import { normalizePhone, isValidPhone } from '../../src/lib/phone'

describe('normalizePhone', () => {
  it('adds a leading + when missing', () => {
    expect(normalizePhone('51987654321')).toBe('+51987654321')
  })

  it('strips spaces, dashes and parentheses', () => {
    expect(normalizePhone('+51 987-654 (321)')).toBe('+51987654321')
  })

  it('leaves an already-normalized number unchanged', () => {
    expect(normalizePhone('+51987654321')).toBe('+51987654321')
  })
})

describe('isValidPhone', () => {
  it('accepts a valid E.164 number', () => {
    expect(isValidPhone('+51987654321')).toBe(true)
  })

  it('rejects a number without the + prefix', () => {
    expect(isValidPhone('51987654321')).toBe(false)
  })

  it('rejects a number starting with 0 after the +', () => {
    expect(isValidPhone('+0987654321')).toBe(false)
  })

  it('rejects a too-short number', () => {
    expect(isValidPhone('+519')).toBe(false)
  })

  it('rejects non-numeric characters', () => {
    expect(isValidPhone('+519876abcde')).toBe(false)
  })
})
