import { afterEach, describe, expect, it } from 'vitest'

import { getAccessToken, setAccessToken } from './tokenStore'

describe('tokenStore', () => {
  afterEach(() => {
    setAccessToken(null)
  })

  it('starts with no access token', () => {
    expect(getAccessToken()).toBeNull()
  })

  it('returns the token that was set', () => {
    setAccessToken('a-token')

    expect(getAccessToken()).toBe('a-token')
  })

  it('can be cleared back to null', () => {
    setAccessToken('a-token')
    setAccessToken(null)

    expect(getAccessToken()).toBeNull()
  })
})
