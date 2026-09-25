import json

import pytest
from django.test import Client

from graphql_api.schema import schema as root_schema
from identity.models import User
from organizations.models import Membership, Organization

REGISTER_MUTATION = """
mutation Register($input: RegisterInput!) {
  register(input: $input) { success }
}
"""

LOGIN_MUTATION = """
mutation Login($input: LoginInput!) {
  login(input: $input) { accessToken user { id } }
}
"""

CREATE_ORGANIZATION_MUTATION = """
mutation CreateOrganization($input: CreateOrganizationInput!) {
  createOrganization(input: $input) {
    success
    message
    field
    organization { id name slug }
    membership { id status user { id email } }
  }
}
"""

ME_ORGANIZATIONS_QUERY = """
query MeOrganizations {
  meOrganizations {
    organization { id name slug }
    membership { id status user { id email } }
  }
}
"""

ME_MEMBERSHIPS_QUERY = """
query MeMemberships {
  meMemberships { id status organization { id name slug } user { id email } }
}
"""

ORGANIZATION_QUERY = """
query Organization($id: ID!) {
  organization(id: $id) { id name slug }
}
"""

ORGANIZATION_MEMBERS_QUERY = """
query OrganizationMembers($organizationId: ID!) {
  organizationMembers(organizationId: $organizationId) {
    id status user { id email } organization { id slug }
  }
}
"""


@pytest.fixture
def gql(client: Client):
    def post(query, variables=None, access_token=None):
        payload = {'query': query}
        if variables is not None:
            payload['variables'] = variables
        headers = {}
        if access_token is not None:
            headers['HTTP_AUTHORIZATION'] = f'Bearer {access_token}'
        return client.post(
            '/graphql/',
            data=json.dumps(payload),
            content_type='application/json',
            **headers,
        )

    return post


def _register_and_login(gql, email):
    registration = gql(
        REGISTER_MUTATION,
        {
            'input': {
                'firstName': 'Ada',
                'lastName': 'Lovelace',
                'email': email,
                'phoneNumber': '+255712345678',
                'password': 'a-strong-unique-pass-1',
            }
        },
    )
    assert registration.json()['data']['register']['success'] is True

    login = gql(
        LOGIN_MUTATION,
        {'input': {'email': email, 'password': 'a-strong-unique-pass-1'}},
    )
    return login.json()['data']['login']['accessToken']


@pytest.mark.django_db
def test_create_organization_persists_creator_membership(gql):
    access_token = _register_and_login(gql, 'ada@example.com')

    response = gql(
        CREATE_ORGANIZATION_MUTATION,
        {'input': {'name': 'Acme Labs'}},
        access_token=access_token,
    )

    body = response.json()
    assert 'errors' not in body
    payload = body['data']['createOrganization']
    assert payload['success'] is True
    assert payload['organization']['name'] == 'Acme Labs'
    assert payload['organization']['slug'] == 'acme-labs'
    assert payload['membership']['status'] == Membership.Status.ACTIVE
    user = User.objects.get(email='ada@example.com')
    assert Membership.objects.filter(
        user=user, organization_id=payload['organization']['id']
    ).exists()


@pytest.mark.django_db
def test_create_organization_rejects_unauthenticated_request(gql):
    response = gql(CREATE_ORGANIZATION_MUTATION, {'input': {'name': 'Acme Labs'}})

    payload = response.json()['data']['createOrganization']
    assert payload['success'] is False
    assert payload['organization'] is None
    assert Organization.objects.count() == 0


@pytest.mark.django_db
def test_me_organizations_returns_membership_information(gql):
    access_token = _register_and_login(gql, 'ada@example.com')
    gql(
        CREATE_ORGANIZATION_MUTATION,
        {'input': {'name': 'Acme Labs'}},
        access_token=access_token,
    )

    response = gql(ME_ORGANIZATIONS_QUERY, access_token=access_token)

    body = response.json()
    assert 'errors' not in body
    item = body['data']['meOrganizations'][0]
    assert item['organization']['name'] == 'Acme Labs'
    assert item['membership']['status'] == Membership.Status.ACTIVE
    assert item['membership']['user']['email'] == 'ada@example.com'


@pytest.mark.django_db
def test_me_memberships_returns_current_users_memberships(gql):
    access_token = _register_and_login(gql, 'ada@example.com')
    gql(
        CREATE_ORGANIZATION_MUTATION,
        {'input': {'name': 'Acme Labs'}},
        access_token=access_token,
    )

    response = gql(ME_MEMBERSHIPS_QUERY, access_token=access_token)

    assert response.json()['data']['meMemberships'][0]['organization']['slug'] == 'acme-labs'


@pytest.mark.django_db
def test_organization_query_is_scoped_to_membership(gql):
    ada_token = _register_and_login(gql, 'ada@example.com')
    grace_token = _register_and_login(gql, 'grace@example.com')
    created = gql(
        CREATE_ORGANIZATION_MUTATION,
        {'input': {'name': 'Acme Labs'}},
        access_token=ada_token,
    )
    organization_id = created.json()['data']['createOrganization']['organization']['id']

    allowed = gql(ORGANIZATION_QUERY, {'id': organization_id}, access_token=ada_token)
    denied = gql(ORGANIZATION_QUERY, {'id': organization_id}, access_token=grace_token)

    assert allowed.json()['data']['organization']['id'] == organization_id
    assert denied.json()['data']['organization'] is None


@pytest.mark.django_db
def test_organization_members_cannot_be_read_across_membership_boundary(gql):
    ada_token = _register_and_login(gql, 'ada@example.com')
    grace_token = _register_and_login(gql, 'grace@example.com')
    created = gql(
        CREATE_ORGANIZATION_MUTATION,
        {'input': {'name': 'Acme Labs'}},
        access_token=ada_token,
    )
    organization_id = created.json()['data']['createOrganization']['organization']['id']

    allowed = gql(
        ORGANIZATION_MEMBERS_QUERY,
        {'organizationId': organization_id},
        access_token=ada_token,
    )
    denied = gql(
        ORGANIZATION_MEMBERS_QUERY,
        {'organizationId': organization_id},
        access_token=grace_token,
    )

    assert len(allowed.json()['data']['organizationMembers']) == 1
    assert denied.json()['data']['organizationMembers'] == []


@pytest.mark.django_db
def test_unauthenticated_queries_return_empty_membership_data(gql):
    organizations = gql(ME_ORGANIZATIONS_QUERY)
    members = gql(ORGANIZATION_MEMBERS_QUERY, {'organizationId': '1'})

    assert organizations.json()['data']['meOrganizations'] == []
    assert members.json()['data']['organizationMembers'] == []


@pytest.mark.django_db
def test_inactive_user_cannot_create_organization_even_with_existing_token(gql):
    access_token = _register_and_login(gql, 'ada@example.com')
    User.objects.filter(email='ada@example.com').update(is_active=False)

    response = gql(
        CREATE_ORGANIZATION_MUTATION,
        {'input': {'name': 'Acme Labs'}},
        access_token=access_token,
    )

    assert response.json()['data']['createOrganization']['success'] is False
    assert Organization.objects.count() == 0


@pytest.mark.django_db
def test_duplicate_slug_returns_field_error_without_duplicate_membership(gql):
    access_token = _register_and_login(gql, 'ada@example.com')
    first = gql(
        CREATE_ORGANIZATION_MUTATION,
        {'input': {'name': 'Acme Labs'}},
        access_token=access_token,
    )
    second = gql(
        CREATE_ORGANIZATION_MUTATION,
        {'input': {'name': 'Another name', 'slug': 'acme-labs'}},
        access_token=access_token,
    )

    assert first.json()['data']['createOrganization']['success'] is True
    assert second.json()['data']['createOrganization']['field'] == 'slug'
    assert Organization.objects.count() == 1
    assert Membership.objects.count() == 1


def test_organization_schema_does_not_add_roles_or_permissions():
    schema_text = str(root_schema)
    assert 'Role' not in schema_text
    assert 'Permission' not in schema_text

    for type_name in ('OrganizationType', 'MembershipType'):
        type_definition = root_schema.get_type_by_name(type_name)
        field_names = {field.name for field in type_definition.fields}
        assert 'role' not in field_names
        assert 'permissions' not in field_names
