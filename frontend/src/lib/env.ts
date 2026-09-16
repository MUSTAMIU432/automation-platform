/**
 * Centralized access to Vite-exposed environment variables.
 * Import from here instead of reading `import.meta.env` in components.
 */

function requireEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const env = {
  graphqlUrl: requireEnv('VITE_GRAPHQL_URL'),
}
