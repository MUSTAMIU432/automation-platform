"""
The complete authentication journey, over real HTTP (S1-009).

Everything here goes through the real endpoint - `django.test.Client` ->
URLconf -> middleware (security, CORS, CSRF, session, auth, clickjacking) ->
`csrf_exempt` GraphQL view -> Strawberry -> the schema's own resolvers ->
`identity.services` / `identity.authentication` -> the database. Nothing is
called directly: the unit suites in `identity/tests/` deliberately stub these
same layers, so a wiring mistake that only shows up end-to-end (a rotation
that never reaches the client, a middleware that swallows the response) would
not be caught there.

Authentication is token-based, with no cookie: the access token (a short-lived
JWT) authenticates requests as `Authorization: Bearer`, and the refresh token
comes back in the response body and is presented as an argument to
`refreshToken` and `logout`. The journey asserted here is exactly the one the
frontend performs, in order:

    register -> login (both tokens, no cookie) -> authenticated `me`
    -> refreshToken -> refresh rotation verified -> a parallel tab inside the
    grace window is renewed -> the old refresh token is rejected after it ->
    logout -> the refresh session is revoked -> refreshing after logout fails.
"""

import json
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from identity.models import RefreshSession, User

REGISTER_MUTATION = """
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    success
    message
    field
    user { id email firstName lastName phoneNumber isActive isVerified }
  }
}
"""

LOGIN_MUTATION = """
mutation Login($input: LoginInput!) {
  login(input: $input) {
    success
    message
    accessToken
    accessTokenExpiresAt
    refreshToken
    refreshTokenExpiresAt
    user { id email }
  }
}
"""

REFRESH_MUTATION = """
mutation RefreshToken($token: String!) {
  refreshToken(refreshToken: $token) {
    success
    message
    accessToken
    accessTokenExpiresAt
    refreshToken
    user { id email }
  }
}
"""

LOGOUT_MUTATION = """
mutation Logout($token: String!) {
  logout(refreshToken: $token) { success }
}
"""

ME_QUERY = """
query Me {
  me { id email isActive isVerified }
}
"""

PASSWORD = 'a-strong-unique-pass-1'


class GraphQLClient:
    """
    A minimal browser-like GraphQL caller over Django's test client.

    Wraps `Client` rather than replacing it: the point of these tests is the
    *real* request path, including the response headers a browser would act on.
    """

    def __init__(self, client: Client):
        self.client = client

    def raw(self, query, variables=None, *, bearer=None, content_type='application/json'):
        payload = {'query': query}
        if variables is not None:
            payload['variables'] = variables
        headers = {}
        if bearer is not None:
            headers['HTTP_AUTHORIZATION'] = f'Bearer {bearer}'
        return self.client.post(
            '/graphql/', data=json.dumps(payload), content_type=content_type, **headers
        )

    def run(self, query, variables=None, *, bearer=None, root_field=None):
        """POST an operation and return its single root field, failing loudly on
        a GraphQL-level error (which is how every failure in this project is
        meant to surface: a `success: false` payload, never an `errors` array).
        """
        response = self.raw(query, variables, bearer=bearer)
        assert response.status_code == 200, response.content
        body = response.json()
        assert 'errors' not in body, body
        return body['data'][root_field] if root_field else body['data']

    def register(self, *, first='Ada', last='Lovelace', email='ada@example.com', password=PASSWORD):
        return self.run(
            REGISTER_MUTATION,
            {
                'input': {
                    'firstName': first,
                    'lastName': last,
                    'email': email,
                    'phoneNumber': '+255712345678',
                    'password': password,
                }
            },
            root_field='register',
        )

    def login(self, email='ada@example.com', password=PASSWORD):
        return self.run(
            LOGIN_MUTATION,
            {'input': {'email': email, 'password': password}},
            root_field='login',
        )

    def refresh(self, token=''):
        return self.run(REFRESH_MUTATION, {'token': token}, root_field='refreshToken')

    def logout(self, token=''):
        return self.run(LOGOUT_MUTATION, {'token': token}, root_field='logout')

    def me(self, access_token):
        return self.run(ME_QUERY, bearer=access_token, root_field='me')


@pytest.fixture
def gql(client: Client) -> GraphQLClient:
    return GraphQLClient(client)


@pytest.mark.django_db
def test_complete_authentication_journey_over_real_http(gql):
    """
    The whole required sequence in one test, in order, with every intermediate
    state asserted as it is reached. Split into per-step tests it would still
    pass while a real user's flow broke between two of them (e.g. a rotation
    that revokes server-side but never reaches the client).
    """

    # --- register ------------------------------------------------------------
    registration = gql.register()
    assert registration['success'] is True
    assert registration['field'] is None
    assert registration['user']['email'] == 'ada@example.com'
    assert User.objects.filter(email='ada@example.com').count() == 1
    # Registration alone must not authenticate anybody.
    assert RefreshSession.objects.count() == 0

    # --- login: both tokens in the body, no cookie ---------------------------
    login_response = gql.raw(
        LOGIN_MUTATION, {'input': {'email': 'ada@example.com', 'password': PASSWORD}}
    )
    login = login_response.json()['data']['login']
    assert login['success'] is True
    assert login['accessToken']
    assert login['accessTokenExpiresAt']
    assert login['refreshToken']
    assert login['refreshTokenExpiresAt']
    assert not login_response.cookies
    assert not gql.client.cookies
    first_access_token = login['accessToken']
    first_refresh_value = login['refreshToken']
    # The refresh token is stored only as a hash.
    assert RefreshSession.objects.get().token_hash == _token_hash(first_refresh_value)

    # --- authenticated me ----------------------------------------------------
    me = gql.me(first_access_token)
    assert me['email'] == 'ada@example.com'
    assert me['isActive'] is True

    # --- refreshToken --------------------------------------------------------
    refresh = gql.refresh(first_refresh_value)
    assert refresh['success'] is True
    assert refresh['message'] == 'Session renewed.'
    second_access_token = refresh['accessToken']
    assert refresh['accessTokenExpiresAt']
    second_refresh_value = refresh['refreshToken']

    # --- rotation ------------------------------------------------------------
    assert second_refresh_value != first_refresh_value, 'the refresh token must rotate'
    assert second_access_token != first_access_token
    # The new credential is a different server-side session, and the old one is
    # revoked the moment the new one starts - not before, not after.
    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 1
    rotated = RefreshSession.objects.get(token_hash=_token_hash(second_refresh_value))
    assert rotated.replaced_by is None
    assert rotated.revoked_at is None
    # The old session points at its replacement: the rotation chain is
    # recorded, which is what makes reuse detectable at all.
    old_session = RefreshSession.objects.get(token_hash=_token_hash(first_refresh_value))
    assert old_session.revoked_at is not None
    assert old_session.replaced_by_id == rotated.pk
    # The renewed access token is the same user, and still works.
    assert gql.me(second_access_token)['email'] == 'ada@example.com'

    # --- a parallel tab inside the grace window is renewed --------------------
    parallel = gql.refresh(first_refresh_value)
    assert parallel['success'] is True
    assert parallel['accessToken']
    assert parallel['refreshToken'] is None
    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 1

    # --- the old refresh token is rejected once the grace window is over -----
    RefreshSession.objects.filter(pk=old_session.pk).update(
        revoked_at=timezone.now() - timedelta(minutes=5)
    )
    replay = gql.refresh(first_refresh_value)
    assert replay['success'] is False
    assert replay['accessToken'] is None
    assert replay['user'] is None
    # The current session survived the replay attempt - a replay must not be
    # able to destroy a live session.
    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 1

    # --- logout --------------------------------------------------------------
    logout = gql.logout(second_refresh_value)
    assert logout['success'] is True

    # --- the refresh session is revoked --------------------------------------
    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 0
    assert RefreshSession.objects.get(token_hash=_token_hash(second_refresh_value)).revoked_at

    # --- refreshing after logout fails ---------------------------------------
    after_logout = gql.refresh(second_refresh_value)
    assert after_logout['success'] is False
    assert after_logout['accessToken'] is None
    # A logged-out session has no live replacement, so the grace window never
    # applies to it - and the earlier token of the chain is refused too.
    assert gql.refresh(first_refresh_value)['success'] is False
    # And it stays refused - a revoked session is not silently resurrected.
    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 0


def _token_hash(raw_token):
    import hashlib

    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


@pytest.mark.django_db
def test_login_is_required_before_me_and_refresh_are_useful(gql):
    """
    The negative half of the journey, so the positive one above can't pass
    while the endpoint accepts anonymous callers.
    """
    assert gql.run(ME_QUERY, root_field='me') is None
    assert gql.refresh()['success'] is False
    assert gql.logout()['success'] is True


@pytest.mark.django_db
def test_registered_user_can_sign_in_again_after_logout(gql):
    """
    A full second round trip proves logout revoked the *session* rather than
    the account: the same credentials must still authenticate, and produce a
    brand new refresh token.
    """
    gql.register()
    first = gql.login()
    assert first['success'] is True
    gql.logout(first['refreshToken'])

    second = gql.login()

    assert second['success'] is True
    assert gql.me(second['accessToken'])['email'] == 'ada@example.com'
    assert second['refreshToken'] != first['refreshToken']
    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 1


@pytest.mark.django_db
def test_duplicate_registration_does_not_disturb_an_existing_session(gql):
    """
    The one place a "this email is already registered" answer is safe to give,
    and the reason it must not leak a session: a second registration attempt
    for an existing account reports the collision on the `email` field and
    leaves every existing refresh session untouched.
    """
    gql.register()
    live_refresh = gql.login()['refreshToken']

    duplicate = gql.register()

    assert duplicate['success'] is False
    assert duplicate['field'] == 'email'
    assert duplicate['user'] is None
    assert User.objects.filter(email='ada@example.com').count() == 1
    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 1
    # The existing session still works.
    assert gql.refresh(live_refresh)['success'] is True
