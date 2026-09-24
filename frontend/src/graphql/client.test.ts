import { afterEach, describe, expect, it, vi } from 'vitest'

import { graphqlClient } from './client'
import { setAccessToken } from './tokenStore'

// No backend is contacted: fetch is stubbed, so this stays a unit test.
describe('graphqlClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  it('posts operations to the configured GraphQL URL and returns data', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { data: { apiStatus: { status: 'ok' } } },
        { headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const data = await graphqlClient.request('{ apiStatus { status } }')

    expect(data).toEqual({ apiStatus: { status: 'ok' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL | string, RequestInit]
    expect(String(url)).toBe('http://localhost:8000/graphql/')
    expect(init.method).toBe('POST')
  })

  it('sends requests with credentials included, for the refresh-token cookie', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: {} }, { headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await graphqlClient.request('{ apiStatus { status } }')

    const [, init] = fetchMock.mock.calls[0] as unknown as [URL | string, RequestInit]
    expect(init.credentials).toBe('include')
  })

  it('attaches no Authorization header when there is no access token', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: {} }, { headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await graphqlClient.request('{ apiStatus { status } }')

    const [, init] = fetchMock.mock.calls[0] as unknown as [URL | string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.has('Authorization')).toBe(false)
  })

  it('attaches the current access token as a Bearer Authorization header', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: {} }, { headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('the-access-token')

    await graphqlClient.request('{ apiStatus { status } }')

    const [, init] = fetchMock.mock.calls[0] as unknown as [URL | string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer the-access-token')
  })
})
