import json

import pytest
from django.test import Client

from identity.models import RefreshSession, User

REGISTER_MUTATION = """
mutation Register($input: RegisterInput!) {
  register(input: $input) { success }
}
"""

LOGIN_MUTATION = """
mutation Login($input: LoginInput!) {
  login(input: $input) {
    success
    message
    accessToken
    accessTokenExpiresAt
    user { id email isActive isVerified }
  }
}
"""

REFRESH_MUTATION = """
mutation Refresh {
  refreshToken {
    success
    message
    accessToken
    user { id email }
  }
}
"""

LOGOUT_MUTATION = """
mutation Logout {
  logout { success }
}
"""

ME_QUERY = """
query Me {
  me { id email }
}
"""

EMAIL = 'ada@example.com'
PASSWORD = 'a-strong-unique-pass-1'


@pytest.fixture
def gql(client: Client):
    """POST a GraphQL operation to the real /graphql/ endpoint."""

    def post(query, variables=None):
        payload = {'query': query}
        if variables is not None:
            payload['variables'] = variables
        return client.post('/graphql/', data=json.dumps(payload), content_type='application/json')

    return post


def _register(gql, email=EMAIL, password=PASSWORD):
    gql(
        REGISTER_MUTATION,
        {
            'input': {
                'firstName': 'Ada',
                'lastName': 'Lovelace',
                'email': email,
                'phoneNumber': '+255712345678',
                'password': password,
            }
        },
    )


def _login(gql, email=EMAIL, password=PASSWORD):
    return gql(LOGIN_MUTATION, {'input': {'email': email, 'password': password}})


def _register_and_login(gql, email=EMAIL, password=PASSWORD):
    _register(gql, email, password)
    return _login(gql, email, password)


# --- login -------------------------------------------------------------------------


@pytest.mark.django_db
def test_login_succeeds_for_a_registered_user(gql):
    response = _register_and_login(gql)

    body = response.json()
    assert 'errors' not in body
    payload = body['data']['login']
    assert payload['success'] is True
    assert payload['accessToken']
    assert payload['accessTokenExpiresAt']
    assert payload['user']['email'] == EMAIL


@pytest.mark.django_db
def test_login_sets_an_httponly_refresh_cookie(gql, client):
    _register_and_login(gql)

    cookie = client.cookies.get('refresh_token')
    assert cookie is not None
    assert cookie.value
    assert cookie['httponly'] is True
    assert cookie['samesite'] == 'Lax'


@pytest.mark.django_db
def test_login_response_never_exposes_password_or_hash(gql):
    response = _register_and_login(gql)

    raw_body = response.content.decode()
    assert 'password' not in response.json()['data']['login']
    user = User.objects.get(email=EMAIL)
    assert user.password not in raw_body


@pytest.mark.django_db
def test_wrong_password_fails_with_a_generic_message(gql):
    _register(gql)

    response = gql(LOGIN_MUTATION, {'input': {'email': EMAIL, 'password': 'the-wrong-password'}})

    payload = response.json()['data']['login']
    assert payload['success'] is False
    assert payload['accessToken'] is None
    assert payload['user'] is None
    # The message is the fixed generic phrase - not, e.g., "wrong password"
    # or anything naming which of email/password was the problem.
    assert payload['message'] == 'Invalid email or password.'


@pytest.mark.django_db
def test_unknown_email_fails_with_the_exact_same_message_as_wrong_password(gql):
    _register(gql)
    wrong_password = gql(LOGIN_MUTATION, {'input': {'email': EMAIL, 'password': 'wrong'}})
    unknown_email = gql(LOGIN_MUTATION, {'input': {'email': 'nobody@example.com', 'password': 'x'}})

    assert (
        wrong_password.json()['data']['login']['message']
        == unknown_email.json()['data']['login']['message']
    )
    assert unknown_email.json()['data']['login']['success'] is False


@pytest.mark.django_db
def test_inactive_user_cannot_login_via_graphql(gql):
    _register(gql)
    User.objects.filter(email=EMAIL).update(is_active=False)

    response = _login(gql)

    assert response.json()['data']['login']['success'] is False


@pytest.mark.django_db
def test_unverified_user_can_login_this_sprint(gql):
    # Explicit, documented policy for S1-003 - see identity/authentication.py.
    response = _register_and_login(gql)

    payload = response.json()['data']['login']
    assert payload['success'] is True
    assert payload['user']['isVerified'] is False


# --- me --------------------------------------------------------------------------


@pytest.mark.django_db
def test_me_returns_null_when_unauthenticated(gql):
    response = gql(ME_QUERY)

    assert response.json()['data']['me'] is None


@pytest.mark.django_db
def test_me_returns_null_for_a_garbage_bearer_token(client):
    response = client.post(
        '/graphql/',
        data=json.dumps({'query': ME_QUERY}),
        content_type='application/json',
        HTTP_AUTHORIZATION='Bearer not-a-real-token',
    )

    assert response.json()['data']['me'] is None


@pytest.mark.django_db
def test_me_returns_the_authenticated_user(gql, client):
    login_response = _register_and_login(gql)
    access_token = login_response.json()['data']['login']['accessToken']

    response = client.post(
        '/graphql/',
        data=json.dumps({'query': ME_QUERY}),
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}',
    )

    assert response.json()['data']['me']['email'] == EMAIL


# --- refreshToken ------------------------------------------------------------------


@pytest.mark.django_db
def test_refresh_without_a_cookie_fails(gql):
    response = gql(REFRESH_MUTATION)

    assert response.json()['data']['refreshToken']['success'] is False


@pytest.mark.django_db
def test_refresh_token_rotates_and_returns_a_new_access_token(gql, client):
    login_response = _register_and_login(gql)
    first_access_token = login_response.json()['data']['login']['accessToken']
    first_cookie_value = client.cookies.get('refresh_token').value

    refresh_response = gql(REFRESH_MUTATION)

    payload = refresh_response.json()['data']['refreshToken']
    assert payload['success'] is True
    assert payload['accessToken'] != first_access_token
    assert client.cookies.get('refresh_token').value != first_cookie_value


@pytest.mark.django_db
def test_reusing_a_rotated_refresh_cookie_fails(gql, client):
    _register_and_login(gql)
    first_cookie_value = client.cookies.get('refresh_token').value
    gql(REFRESH_MUTATION)  # rotates the credential

    # Simulate the old (now-revoked) cookie being replayed by the browser.
    client.cookies['refresh_token'] = first_cookie_value
    replay_response = gql(REFRESH_MUTATION)

    assert replay_response.json()['data']['refreshToken']['success'] is False


@pytest.mark.django_db
def test_refresh_token_response_never_exposes_password_or_hash(gql):
    _register_and_login(gql)

    response = gql(REFRESH_MUTATION)

    raw_body = response.content.decode()
    user = User.objects.get(email=EMAIL)
    assert user.password not in raw_body


# --- logout ------------------------------------------------------------------------


@pytest.mark.django_db
def test_logout_revokes_the_session_so_a_later_refresh_fails(gql):
    _register_and_login(gql)

    logout_response = gql(LOGOUT_MUTATION)
    assert logout_response.json()['data']['logout']['success'] is True

    refresh_response = gql(REFRESH_MUTATION)
    assert refresh_response.json()['data']['refreshToken']['success'] is False


@pytest.mark.django_db
def test_logout_clears_the_refresh_cookie(gql, client):
    _register_and_login(gql)

    gql(LOGOUT_MUTATION)

    cookie = client.cookies.get('refresh_token')
    # Django represents a cleared cookie as an empty value with epoch expiry,
    # not the absence of the cookie key.
    assert cookie is None or cookie.value == ''


@pytest.mark.django_db
def test_logout_without_a_prior_login_still_succeeds(gql):
    response = gql(LOGOUT_MUTATION)

    assert response.json()['data']['logout']['success'] is True


@pytest.mark.django_db
def test_refresh_session_row_reflects_revocation_after_logout(gql):
    _register_and_login(gql)
    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 1

    gql(LOGOUT_MUTATION)

    assert RefreshSession.objects.filter(revoked_at__isnull=True).count() == 0
