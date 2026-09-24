"""
Authentication business logic: login, refresh-token rotation, logout, and
resolving the authenticated user from an access token.

GraphQL (`identity.schema`) calls these functions and only translates their
results to/from GraphQL types; it doesn't implement any authentication
logic of its own.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime

from django.conf import settings
from django.contrib.auth import authenticate
from django.http import HttpRequest
from django.utils import timezone

from identity.models import RefreshSession, User
from identity.tokens import TokenError, decode_access_token, issue_access_token

# Shown to the caller for every login/refresh failure, regardless of cause
# (unknown email, wrong password, inactive account, expired/revoked/reused
# refresh credential, ...) - see `login()` and `refresh()` docstrings for
# why each one deliberately collapses its failure modes into this.
GENERIC_LOGIN_ERROR = 'Invalid email or password.'
GENERIC_REFRESH_ERROR = 'Your session has expired. Please sign in again.'

# High-entropy opaque credential (not a JWT - see RefreshSession). 384 bits
# from `secrets` (cryptographically secure) comfortably exceeds what's
# needed to make guessing infeasible.
_REFRESH_TOKEN_BYTES = 48


class AuthenticationError(Exception):
    """
    Raised for any login/refresh/logout failure.

    The message is always the generic, pre-written text above - never a
    field name, never a distinguishing detail - so it's always safe to
    show the caller verbatim.
    """


@dataclass(frozen=True)
class AuthenticatedSession:
    user: User
    access_token: str
    access_token_expires_at: datetime
    refresh_token: str
    refresh_token_expires_at: datetime


def _hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


def _issue_authenticated_session(
    user: User, *, replaces: RefreshSession | None = None
) -> AuthenticatedSession:
    """Issue a fresh access token + refresh session for `user`.

    If `replaces` is given (the refresh flow), that old session is revoked
    and linked to the new one as part of the same operation - the old
    credential stops working at the moment the new one starts, not before
    and not after.
    """
    access_token, access_expires_at = issue_access_token(user.pk)

    raw_refresh_token = secrets.token_urlsafe(_REFRESH_TOKEN_BYTES)
    session = RefreshSession.objects.create(
        user=user,
        token_hash=_hash_refresh_token(raw_refresh_token),
        expires_at=timezone.now() + settings.REFRESH_TOKEN_LIFETIME,
    )

    if replaces is not None:
        replaces.revoked_at = timezone.now()
        replaces.replaced_by = session
        replaces.save(update_fields=['revoked_at', 'replaced_by'])

    return AuthenticatedSession(
        user=user,
        access_token=access_token,
        access_token_expires_at=access_expires_at,
        refresh_token=raw_refresh_token,
        refresh_token_expires_at=session.expires_at,
    )


def login(email: str, password: str) -> AuthenticatedSession:
    """
    Authenticate by email/password and issue a new access token + refresh
    session.

    Uses Django's own `authenticate()` (the `ModelBackend` it resolves to)
    rather than calling `check_password` directly, for two reasons: (1) it
    already runs a dummy password hash when the email doesn't match any
    user, so an unknown-email attempt takes about as long as a
    wrong-password one - not doing this would let a timing difference leak
    which emails are registered; (2) it already rejects an inactive user
    (`is_active=False`) as part of the same call, via
    `user_can_authenticate`, so this function doesn't need a separate check
    that could accidentally diverge from it.

    Raises AuthenticationError with the single generic message for every
    failure - unknown email, wrong password, or an inactive account - so a
    caller can never distinguish one from another. This differs
    deliberately from registration (where confirming an email is already
    taken is expected and necessary): login is the endpoint an attacker
    would use to test a list of addresses, so account existence must never
    leak from it.
    """
    user = authenticate(email=email, password=password)
    if user is None:
        raise AuthenticationError(GENERIC_LOGIN_ERROR)

    return _issue_authenticated_session(user)


def refresh(raw_refresh_token: str) -> AuthenticatedSession:
    """
    Validate `raw_refresh_token`, rotate it, and issue a new access token.

    Rotation: the presented credential is looked up by its hash and
    checked for validity (not expired, not already revoked, owning user
    still active), then immediately revoked and linked to a newly issued
    replacement - so this exact credential can never be used again. If the
    same raw credential is presented a second time (a stolen or
    already-rotated credential being replayed), the lookup finds a row
    that's already revoked and rejects it, rather than finding nothing -
    that's what makes the reuse detectable at all. This task does not go
    further and automatically revoke the rest of that user's sessions on
    detected reuse; it's flagged here as a natural next step, not silently
    treated as already handled.
    """
    if not raw_refresh_token:
        raise AuthenticationError(GENERIC_REFRESH_ERROR)

    token_hash = _hash_refresh_token(raw_refresh_token)
    session = RefreshSession.objects.select_related('user').filter(token_hash=token_hash).first()

    if session is None or not session.is_active or not session.user.is_active:
        raise AuthenticationError(GENERIC_REFRESH_ERROR)

    session.last_used_at = timezone.now()
    session.save(update_fields=['last_used_at'])

    return _issue_authenticated_session(session.user, replaces=session)


def logout(raw_refresh_token: str) -> None:
    """
    Revoke the refresh session backing `raw_refresh_token`, if any.

    Never raises: an already-invalid, unknown, expired, or missing
    credential still results in "logged out" from the caller's point of
    view - there's nothing actionable to tell them, and distinguishing
    "already logged out" from "never was logged in" would leak session
    validity to whoever holds the (possibly stolen) credential.
    """
    if not raw_refresh_token:
        return

    token_hash = _hash_refresh_token(raw_refresh_token)
    RefreshSession.objects.filter(token_hash=token_hash, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )


def get_authenticated_user(request: HttpRequest) -> User | None:
    """
    Resolve the authenticated User from `request`'s `Authorization: Bearer
    <token>` header.

    Returns None - never raises - for a missing header, a malformed
    header, an invalid/expired/tampered/wrong-type token, or a token whose
    user no longer exists or has since been deactivated. A GraphQL resolver
    treats all of those identically ("not authenticated"), so this
    collapses them rather than distinguishing why. The user id inside the
    token is never trusted on its own without the signature/expiry/type
    checks in `decode_access_token` - it is not, and must never become, a
    value the frontend can simply assert.
    """
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None

    token = header.removeprefix('Bearer ').strip()
    try:
        claims = decode_access_token(token)
    except TokenError:
        return None

    return User.objects.filter(pk=claims.user_id, is_active=True).first()
