import { describe, expect, it } from 'vitest'

import { cardBrand, cardErrors, formatCardNumber, formatExpiry, TOKENIZERS } from './cardTokenizers'

const TODAY = new Date('2026-10-17')
const GOOD = {
  holder: 'Buyer Person',
  number: '4242 4242 4242 4242',
  expiry: '08 / 28',
  cvc: '123',
}

describe('card details', () => {
  it('knows Visa and Mastercard by their first digits', () => {
    expect(cardBrand('4242')).toBe('Visa')
    expect(cardBrand('5555 5555')).toBe('Mastercard')
    expect(cardBrand('2221 0000')).toBe('Mastercard')
    expect(cardBrand('3782')).toBeNull()
  })

  it('formats what is typed', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242')
    expect(formatExpiry('0828')).toBe('08 / 28')
  })

  it('says what is wrong with each field', () => {
    expect(cardErrors(GOOD, TODAY)).toEqual({})
    expect(cardErrors({ ...GOOD, number: '4242 4242 4242 4241' }, TODAY).number).toBe(
      'Check the card number.',
    )
    expect(cardErrors({ ...GOOD, expiry: '09 / 26' }, TODAY).expiry).toBe('This card has expired.')
    expect(cardErrors({ ...GOOD, expiry: '13 / 28' }, TODAY).expiry).toMatch(/MM \/ YY/)
    expect(cardErrors({ ...GOOD, cvc: '12' }, TODAY).cvc).toMatch(/3 or 4 digits/)
    expect(cardErrors({ ...GOOD, holder: ' ' }, TODAY).holder).toMatch(/name/)
  })

  it('keeps nothing but the last four digits in a sandbox token', async () => {
    const { token, label } = await TOKENIZERS.sandbox(GOOD)
    expect(token).toBe('sbx_card_4242')
    expect(label).toBe('Visa •••• 4242')
  })
})
