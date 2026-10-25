import { afterEach, describe, expect, it, vi } from 'vitest'

// env.ts reads import.meta.env at import time, so each test re-imports it.
async function loadEnv() {
  vi.resetModules()
  return import('./env')
}

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exposes VITE_GRAPHQL_URL', async () => {
    vi.stubEnv('VITE_GRAPHQL_URL', 'https://api.example.test/graphql/')

    const { env } = await loadEnv()

    expect(env.graphqlUrl).toBe('https://api.example.test/graphql/')
  })

  it('trims a line break pasted into the host settings around a value', async () => {
    vi.stubEnv('VITE_GRAPHQL_URL', ' https://api.example.test/graphql/\n')
    vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', '\n123-abc.apps.googleusercontent.com\n')

    const { env } = await loadEnv()

    expect(env.graphqlUrl).toBe('https://api.example.test/graphql/')
    expect(env.googleClientId).toBe('123-abc.apps.googleusercontent.com')
  })

  it('fails clearly when VITE_GRAPHQL_URL is missing', async () => {
    vi.stubEnv('VITE_GRAPHQL_URL', '')

    await expect(loadEnv()).rejects.toThrow(
      'Missing required environment variable: VITE_GRAPHQL_URL',
    )
  })
})
