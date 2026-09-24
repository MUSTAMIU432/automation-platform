from datetime import timedelta

import jwt
import pytest
from django.conf import settings
from django.test import RequestFactory
from django.utils import timezone

from identity.authentication import (
    GENERIC_LOGIN_ERROR,
    GENERIC_REFRESH_ERROR,
    AuthenticationError,
    get_authenticated_user,
    login,
    logout,
    refresh,
)
from identity.models import RefreshSession, User
from identity.tokens import issue_access_token

VALID_PASSWORD = 'a-strong-unique-pass-1'


def _make_user(**overrides):
    fields = {
        'email': 'ada@example.com',
        'first_name': 'Ada',
        'last_name': 'Lovelace',
        'phone_number': '+255712345678',
    }
    fields.update(overrides)
    password = fields.pop('password', VALID_PASSWORD)
    return User.objects.create_user(password=password, **fields)


def _request_with_auth_header(header_value):
    request = RequestFactory().get('/graphql/')
    if header_value is not None:
        request.META['HTTP_AUTHORIZATION'] = header_value
    return request


@pytest.mark.django_db
class TestLogin:
    def test_valid_login_succeeds(self):
        _make_user()

        session = login('ada@example.com', VALID_PASSWORD)

        assert session.user.email == 'ada@example.com'
        assert session.access_token
        assert session.refresh_token

    def test_login_is_case_insensitive_on_email(self):
        _make_user(email='ada@example.com')

        session = login('ADA@EXAMPLE.COM', VALID_PASSWORD)

        assert session.user.email == 'ada@example.com'

    def test_wrong_password_fails_generically(self):
        _make_user()

        with pytest.raises(AuthenticationError) as exc_info:
            login('ada@example.com', 'the-wrong-password')

        assert str(exc_info.value) == GENERIC_LOGIN_ERROR

    def test_unknown_email_fails_with_the_same_generic_message(self):
        with pytest.raises(AuthenticationError) as exc_info:
            login('nobody@example.com', VALID_PASSWORD)

        assert str(exc_info.value) == GENERIC_LOGIN_ERROR

    def test_inactive_user_cannot_login(self):
        _make_user(is_active=False)

        with pytest.raises(AuthenticationError) as exc_info:
            login('ada@example.com', VALID_PASSWORD)

        assert str(exc_info.value) == GENERIC_LOGIN_ERROR

    def test_unverified_user_can_still_login_this_sprint(self):
        # Explicit, documented policy: registration leaves is_verified=False
        # and no email-verification flow exists yet, so login must not
        # silently require it - see identity/authentication.py's docstring.
        user = _make_user()
        assert user.is_verified is False

        session = login('ada@example.com', VALID_PASSWORD)

        assert session.user.pk == user.pk

    def test_successful_login_creates_exactly_one_refresh_session(self):
        _make_user()

        login('ada@example.com', VALID_PASSWORD)

        assert RefreshSession.objects.count() == 1

    def test_refresh_credential_is_stored_hashed_not_plaintext(self):
        _make_user()

        session = login('ada@example.com', VALID_PASSWORD)

        stored = RefreshSession.objects.get()
        assert stored.token_hash != session.refresh_token
        assert session.refresh_token not in stored.token_hash
        assert len(stored.token_hash) == 64  # SHA-256 hex digest


@pytest.mark.django_db
class TestGetAuthenticatedUser:
    def test_resolves_the_user_from_a_valid_token(self):
        user = _make_user()
        token, _ = issue_access_token(user.pk)

        resolved = get_authenticated_user(_request_with_auth_header(f'Bearer {token}'))

        assert resolved is not None
        assert resolved.pk == user.pk

    def test_returns_none_for_a_missing_header(self):
        assert get_authenticated_user(_request_with_auth_header(None)) is None

    def test_returns_none_for_a_malformed_header(self):
        assert get_authenticated_user(_request_with_auth_header('NotBearer abc')) is None

    def test_returns_none_for_an_invalid_token(self):
        assert get_authenticated_user(_request_with_auth_header('Bearer garbage')) is None

    def test_returns_none_when_the_user_is_inactive(self):
        user = _make_user(is_active=False)
        token, _ = issue_access_token(user.pk)

        assert get_authenticated_user(_request_with_auth_header(f'Bearer {token}')) is None

    def test_returns_none_when_the_user_no_longer_exists(self):
        token, _ = issue_access_token(999_999_999)

        assert get_authenticated_user(_request_with_auth_header(f'Bearer {token}')) is None

    def test_a_forged_token_does_not_resolve_to_the_claimed_user(self):
        # The user id in a token is never trusted on its own - only a
        # token with a valid signature (proving *we* issued it) resolves.
        other_user = _make_user(email='other@example.com', phone_number='+255700000001')
        forged = jwt.encode(
            {'sub': str(other_user.pk), 'type': 'access', 'jti': 'x', 'iat': 0, 'exp': 9999999999},
            'not-the-real-signing-key',
            algorithm='HS256',
        )

        assert get_authenticated_user(_request_with_auth_header(f'Bearer {forged}')) is None


@pytest.mark.django_db
class TestRefresh:
    def test_refresh_credential_works(self):
        user = _make_user()
        session = login('ada@example.com', VALID_PASSWORD)

        renewed = refresh(session.refresh_token)

        assert renewed.user.pk == user.pk
        assert renewed.access_token

    def test_refresh_rotates_the_credential(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)

        renewed = refresh(session.refresh_token)

        assert renewed.refresh_token != session.refresh_token

    def test_old_refresh_credential_is_invalid_after_rotation(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)
        refresh(session.refresh_token)

        with pytest.raises(AuthenticationError) as exc_info:
            refresh(session.refresh_token)

        assert str(exc_info.value) == GENERIC_REFRESH_ERROR

    def test_rotation_revokes_and_links_the_old_session_row(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)
        old_row = RefreshSession.objects.get()

        refresh(session.refresh_token)

        old_row.refresh_from_db()
        assert old_row.revoked_at is not None
        assert old_row.replaced_by is not None

    def test_revoked_refresh_credential_fails(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)
        logout(session.refresh_token)

        with pytest.raises(AuthenticationError):
            refresh(session.refresh_token)

    def test_expired_refresh_credential_fails(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)
        RefreshSession.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

        with pytest.raises(AuthenticationError) as exc_info:
            refresh(session.refresh_token)

        assert str(exc_info.value) == GENERIC_REFRESH_ERROR

    def test_unknown_refresh_credential_fails(self):
        with pytest.raises(AuthenticationError):
            refresh('this-credential-was-never-issued')

    def test_empty_refresh_credential_fails(self):
        with pytest.raises(AuthenticationError):
            refresh('')

    def test_inactive_user_cannot_refresh(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)
        User.objects.update(is_active=False)

        with pytest.raises(AuthenticationError):
            refresh(session.refresh_token)

    def test_refresh_updates_last_used_at(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)
        original_row = RefreshSession.objects.get()
        assert original_row.last_used_at is None

        refresh(session.refresh_token)

        original_row.refresh_from_db()
        assert original_row.last_used_at is not None


@pytest.mark.django_db
class TestLogout:
    def test_logout_revokes_the_refresh_session(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)

        logout(session.refresh_token)

        stored = RefreshSession.objects.get()
        assert stored.revoked_at is not None

    def test_logout_with_an_unknown_credential_does_not_raise(self):
        logout('never-issued')

    def test_logout_with_an_empty_credential_does_not_raise(self):
        logout('')

    def test_logged_out_credential_can_no_longer_refresh(self):
        _make_user()
        session = login('ada@example.com', VALID_PASSWORD)
        logout(session.refresh_token)

        with pytest.raises(AuthenticationError):
            refresh(session.refresh_token)


def test_jwt_signing_key_is_configured_and_distinct_from_secret_key():
    # Sanity check on the settings decision itself (see config/settings/base.py).
    assert settings.JWT_SIGNING_KEY
    assert settings.JWT_SIGNING_KEY != settings.SECRET_KEY
