import { afterEach, describe, expect, it, vi } from 'vitest'

import { graphqlClient } from './client'

// No backend is contacted: fetch is stubbed, so this stays a unit test.
describe('graphqlClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts operations to the configured GraphQL URL and returns data', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: { apiStatus: { status: 'ok' } } }, { headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const data = await graphqlClient.request('{ apiStatus { status } }')

    expect(data).toEqual({ apiStatus: { status: 'ok' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL | string, RequestInit]
    expect(String(url)).toBe('http://localhost:8000/graphql/')
    expect(init.method).toBe('POST')
  })
})
