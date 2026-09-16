import { GraphQLClient } from 'graphql-request'

import { env } from '../lib/env'

/**
 * Single shared GraphQL client for the app. Domain features import this
 * instead of constructing their own client or reading env vars directly,
 * so the endpoint and request config stay in one place.
 */
export const graphqlClient = new GraphQLClient(env.graphqlUrl)
