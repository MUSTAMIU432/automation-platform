/**
 * Card details, and the tokenizers that turn them into the one-time token the server
 * charges.
 *
 * **A card's number and security code never go to the platform's server.** A tokenizer
 * hands them to the payment gateway and returns only its token and a label such as
 * "Visa •••• 4242"; the server charges the token (`marketplace/gateways.py`). The server says
 * which tokenizer to use (`marketCardTokenizer`). For a real gateway, its tokenizer should
 * mount the gateway's own hosted card fields (iframes), which keep the numbers out of this
 * page entirely; the sandbox one below keeps nothing but the last four digits.
 */

export interface CardDetails {
  holder: string
  number: string
  /** "MM / YY". */
  expiry: string
  cvc: string
}

export interface CardToken {
  token: string
  label: string
}

export type CardBrand = 'Visa' | 'Mastercard'
export type Tokenizer = (card: CardDetails) => Promise<CardToken>

export const digitsOf = (value: string) => value.replace(/\D/g, '')

export function cardBrand(number: string): CardBrand | null {
  const digits = digitsOf(number)
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'Mastercard'
  return null
}

/** The Luhn checksum every card number carries, which catches most typing slips. */
function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i += 1) {
    let n = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

/** "4242424242424242" as typed: "4242 4242 4242 4242". */
export function formatCardNumber(value: string): string {
  return digitsOf(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** "0827" as typed: "08 / 27". */
export function formatExpiry(value: string): string {
  const digits = digitsOf(value).slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits
}

/** What is wrong with each field, in words a buyer can act on; empty when all is well. */
export function cardErrors(card: CardDetails, today = new Date()): Partial<CardDetails> {
  const errors: Partial<CardDetails> = {}
  if (!card.holder.trim()) errors.holder = 'Enter the name as it is on the card.'
  const digits = digitsOf(card.number)
  if (!cardBrand(digits)) errors.number = 'We take Visa and Mastercard.'
  else if (digits.length < 13 || !luhn(digits)) errors.number = 'Check the card number.'
  const [mm, yy] =
    digitsOf(card.expiry)
      .match(/^(\d{2})(\d{2})$/)
      ?.slice(1) ?? []
  const month = Number(mm)
  if (!mm || month < 1 || month > 12) errors.expiry = 'Enter the expiry date as MM / YY.'
  else {
    const expires = new Date(2000 + Number(yy), month) // the first day after it expires
    if (expires <= today) errors.expiry = 'This card has expired.'
  }
  if (!/^\d{3,4}$/.test(card.cvc)) errors.cvc = 'Enter the 3 or 4 digits on the back.'
  return errors
}

/** Development only: the token carries the last four digits and nothing else. */
const sandbox: Tokenizer = async (card) => {
  const digits = digitsOf(card.number)
  const last4 = digits.slice(-4)
  return { token: `sbx_card_${last4}`, label: `${cardBrand(digits) ?? 'Card'} •••• ${last4}` }
}

export const TOKENIZERS: Record<string, Tokenizer> = { sandbox }
