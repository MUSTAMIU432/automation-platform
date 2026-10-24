import { describe, expect, it } from 'vitest'

import { filtersFromParams, paramsFromFilters } from './filterParams'

describe('the Ideas filters in the address', () => {
  it('survives a round trip', () => {
    const filters = {
      search: 'tax',
      categoryId: '5',
      status: 'APPROVED' as const,
      submissionContext: 'TEAM' as const,
      visibility: 'PRIVATE' as const,
      mine: true,
      sort: 'MOST_VOTED' as const,
      offset: 20,
    }

    expect(filtersFromParams(paramsFromFilters(filters))).toEqual(filters)
  })

  it('ignores values it does not know, rather than sending them', () => {
    const params = new URLSearchParams(
      'status=HACKED&owner=x&audience=EVERYONE&category=abc&sort=random&from=-4&mine=yes',
    )

    expect(filtersFromParams(params)).toEqual({})
  })

  it('leaves the defaults out of the address', () => {
    expect(paramsFromFilters({ sort: 'NEWEST', offset: 0 }).toString()).toBe('')
  })
})
