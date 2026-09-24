"""
Identity domain's GraphQL surface.

This module defines Strawberry types to be merged into the root schema
(`graphql_api/schema.py`) via inheritance - it does not instantiate its own
`strawberry.Schema`. See that module's docstring for why: one schema, with
each business domain contributing a slice of it.

Resolvers here stay thin: they translate between GraphQL types and
`identity.services`/`identity.authentication`, which own the actual
validation and business logic.
"""

from datetime import datetime

import strawberry
from django.conf import settings
from django.http import HttpRequest, HttpResponse

import identity.authentication as auth_service
from identity.authentication import AuthenticationError, get_authenticated_user
from identity.models import User
from identity.services import RegistrationError, RegistrationInput, register_user

# The refresh credential travels only as an HttpOnly cookie, never as a
# GraphQL argument or field - so no frontend JavaScript ever holds or
# forwards its raw value, which is the entire point of using a cookie for
# it instead of returning it in the response body like the access token.
# (This is a cookie *name*, not a credential - ruff's hardcoded-password
# heuristic just pattern-matches the word "token".)
REFRESH_TOKEN_COOKIE_NAME = 'refresh_token'  # noqa: S105
# Scoped to the GraphQL endpoint only: every operation that needs the
# cookie (login, refreshToken, logout) is a request to this same path, and
# there's no reason for the browser to attach it to /health/ or /admin/.
REFRESH_TOKEN_COOKIE_PATH = '/graphql/'  # noqa: S105


def _set_refresh_cookie(response: HttpResponse, raw_token: str, expires_at: datetime) -> None:
    response.set_cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        raw_token,
        expires=expires_at,
        path=REFRESH_TOKEN_COOKIE_PATH,
        httponly=True,
        # Same policy the project already applies to the session cookie
        # (config/settings/production.py sets SESSION_COOKIE_SECURE=True in
        # every deployed environment; local dev stays plain HTTP).
        secure=settings.SESSION_COOKIE_SECURE,
        samesite='Lax',
    )


def _clear_refresh_cookie(response: HttpResponse) -> None:
    response.delete_cookie(
        REFRESH_TOKEN_COOKIE_NAME, path=REFRESH_TOKEN_COOKIE_PATH, samesite='Lax'
    )


def _read_refresh_cookie(request: HttpRequest) -> str:
    return request.COOKIES.get(REFRESH_TOKEN_COOKIE_NAME, '')


@strawberry.type(description='A registered platform account (safe, public fields only).')
class UserType:
    id: strawberry.ID
    email: str
    first_name: str
    last_name: str
    phone_number: str
    is_active: bool
    is_verified: bool

    @staticmethod
    def from_model(user: User) -> 'UserType':
        return UserType(
            id=strawberry.ID(str(user.pk)),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone_number=user.phone_number,
            is_active=user.is_active,
            is_verified=user.is_verified,
        )


@strawberry.input(description='Fields required to register a new platform account.')
class RegisterInput:
    first_name: str
    last_name: str
    email: str
    phone_number: str
    password: str


@strawberry.type(description='Result of a registration attempt.')
class RegisterPayload:
    success: bool
    message: str
    # Set when `success` is False and the failure applies to one input
    # field (e.g. 'email'), so a client can show it next to that field the
    # same way it already shows its own client-side validation errors.
    field: str | None = None
    user: UserType | None = None


@strawberry.input(description='Email/password credentials.')
class LoginInput:
    email: str
    password: str


@strawberry.input(
    description=(
        "A Google-issued ID token (JWT) from Google Identity Services' Sign "
        'In With Google flow, to be verified server-side. Never a client-'
        'supplied email, name, or Google user id - those are only trusted '
        'once extracted from this verified credential.'
    )
)
class GoogleLoginInput:
    credential: str


@strawberry.type(
    description=(
        'Result of an authentication attempt (login or refresh). On success, '
        'carries a short-lived access token to hold in memory; the refresh '
        'credential is never in this payload - it travels only as an HttpOnly '
        'cookie set alongside this response.'
    )
)
class AuthPayload:
    success: bool
    message: str
    access_token: str | None = None
    # ISO 8601. A string, not a custom scalar - this schema has no need for
    # a dedicated DateTime scalar yet, and the client only ever compares it
    # to `Date.now()` when deciding when to pre-emptively refresh.
    access_token_expires_at: str | None = None
    user: UserType | None = None


@strawberry.type(description='Result of logging out.')
class LogoutPayload:
    success: bool


def _to_camel_case(snake_case_name: str) -> str:
    """`phone_number` -> `phoneNumber`, matching Strawberry's own field-name
    conversion so `RegisterPayload.field` names a field the way the client
    actually sees it in `RegisterInput`, not the Python-side attribute name.
    """
    first, *rest = snake_case_name.split('_')
    return first + ''.join(word.capitalize() for word in rest)


@strawberry.type
class Query:
    @strawberry.field(
        description=(
            'The currently authenticated user (from the Authorization: Bearer '
            'access token), or null if the request is unauthenticated.'
        )
    )
    def me(self, info: strawberry.Info) -> UserType | None:
        user = get_authenticated_user(info.context.request)
        return UserType.from_model(user) if user else None


@strawberry.type
class Mutation:
    @strawberry.mutation(
        description=(
            'Register a new platform account. Creates the User record only - '
            'profile details and email verification are handled by later '
            'Identity operations.'
        )
    )
    def register(self, input: RegisterInput) -> RegisterPayload:
        try:
            user = register_user(
                RegistrationInput(
                    first_name=input.first_name,
                    last_name=input.last_name,
                    email=input.email,
                    phone_number=input.phone_number,
                    password=input.password,
                )
            )
        except RegistrationError as exc:
            field = _to_camel_case(exc.field) if exc.field else None
            return RegisterPayload(success=False, message=exc.message, field=field, user=None)

        return RegisterPayload(
            success=True,
            message='Account created successfully.',
            user=UserType.from_model(user),
        )

    @strawberry.mutation(
        description=(
            'Sign in with email and password. On success, sets an HttpOnly '
            'refresh-session cookie and returns a short-lived access token.'
        )
    )
    def login(self, info: strawberry.Info, input: LoginInput) -> AuthPayload:
        try:
            session = auth_service.login(input.email, input.password)
        except AuthenticationError as exc:
            return AuthPayload(success=False, message=str(exc))

        _set_refresh_cookie(
            info.context.response, session.refresh_token, session.refresh_token_expires_at
        )
        return AuthPayload(
            success=True,
            message='Signed in successfully.',
            access_token=session.access_token,
            access_token_expires_at=session.access_token_expires_at.isoformat(),
            user=UserType.from_model(session.user),
        )

    @strawberry.mutation(
        description=(
            'Sign in (or provision a new account) using a verified Google '
            "identity. Accepts the ID token issued by Google Identity Services'"
            ' Sign In With Google flow, verifies it server-side, and on '
            'success behaves exactly like `login`: sets the HttpOnly '
            'refresh-session cookie and returns a short-lived access token.'
        )
    )
    def google_login(self, info: strawberry.Info, input: GoogleLoginInput) -> AuthPayload:
        try:
            session = auth_service.authenticate_with_google(input.credential)
        except AuthenticationError as exc:
            return AuthPayload(success=False, message=str(exc))

        _set_refresh_cookie(
            info.context.response, session.refresh_token, session.refresh_token_expires_at
        )
        return AuthPayload(
            success=True,
            message='Signed in successfully.',
            access_token=session.access_token,
            access_token_expires_at=session.access_token_expires_at.isoformat(),
            user=UserType.from_model(session.user),
        )

    @strawberry.mutation(
        description=(
            'Exchange the current refresh-session cookie for a new access '
            'token, rotating the refresh credential in the same operation. '
            'Takes no arguments - the refresh credential is read from the '
            'HttpOnly cookie, never from client-supplied input.'
        )
    )
    def refresh_token(self, info: strawberry.Info) -> AuthPayload:
        raw_token = _read_refresh_cookie(info.context.request)
        try:
            session = auth_service.refresh(raw_token)
        except AuthenticationError as exc:
            # The presented credential didn't work (missing, expired,
            # revoked, or reused) - clear it rather than leave a dead
            # cookie the browser keeps resending.
            _clear_refresh_cookie(info.context.response)
            return AuthPayload(success=False, message=str(exc))

        _set_refresh_cookie(
            info.context.response, session.refresh_token, session.refresh_token_expires_at
        )
        return AuthPayload(
            success=True,
            message='Session renewed.',
            access_token=session.access_token,
            access_token_expires_at=session.access_token_expires_at.isoformat(),
            user=UserType.from_model(session.user),
        )

    @strawberry.mutation(
        description=(
            'Revoke the current refresh session and clear its cookie. Takes '
            'no arguments, for the same reason refreshToken does.'
        )
    )
    def logout(self, info: strawberry.Info) -> LogoutPayload:
        raw_token = _read_refresh_cookie(info.context.request)
        auth_service.logout(raw_token)
        _clear_refresh_cookie(info.context.response)
        return LogoutPayload(success=True)
