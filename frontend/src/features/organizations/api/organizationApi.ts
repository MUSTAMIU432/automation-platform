import { graphqlClient } from '../../../graphql/client'

export interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationMember {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface Membership {
  id: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
  user: OrganizationMember
  organization: Organization
}

export interface OrganizationMembership {
  organization: Organization
  membership: Membership
}

export interface CreateOrganizationInput {
  name: string
  slug?: string
}

export interface CreateOrganizationResult {
  success: boolean
  message: string
  field: string | null
  organization: Organization | null
  membership: Membership | null
}

const ORGANIZATION_FIELDS = `
  id
  name
  slug
  createdAt
  updatedAt
`

const MEMBERSHIP_FIELDS = `
  id
  status
  createdAt
  updatedAt
  user {
    id
    email
    firstName
    lastName
  }
`

const ME_ORGANIZATIONS_QUERY = `
  query MeOrganizations {
    meOrganizations {
      organization { ${ORGANIZATION_FIELDS} }
      membership {
        ${MEMBERSHIP_FIELDS}
        organization { ${ORGANIZATION_FIELDS} }
      }
    }
  }
`

const CREATE_ORGANIZATION_MUTATION = `
  mutation CreateOrganization($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      success
      message
      field
      organization { ${ORGANIZATION_FIELDS} }
      membership {
        ${MEMBERSHIP_FIELDS}
        organization { ${ORGANIZATION_FIELDS} }
      }
    }
  }
`

export async function organizationsRequest(): Promise<OrganizationMembership[]> {
  const data = await graphqlClient.request<{ meOrganizations: OrganizationMembership[] }>(
    ME_ORGANIZATIONS_QUERY,
  )
  return data.meOrganizations
}

export async function createOrganizationRequest(
  input: CreateOrganizationInput,
): Promise<CreateOrganizationResult> {
  const data = await graphqlClient.request<{ createOrganization: CreateOrganizationResult }>(
    CREATE_ORGANIZATION_MUTATION,
    { input },
  )
  return data.createOrganization
}
