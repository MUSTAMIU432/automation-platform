"""
Identity domain's GraphQL surface.

This module defines Strawberry types to be merged into the root schema
(`graphql_api/schema.py`) via inheritance - it does not instantiate its own
`strawberry.Schema`. See that module's docstring for why: one schema, with
each business domain contributing a slice of it.

Resolvers here stay thin: they translate between GraphQL types and
`identity.services`/`identity.authentication`, which own the actual
validation and business logic.

Two cross-cutting concerns are applied in the resolvers rather than in the
services, because both are properties of *this HTTP entry point* rather than
of the business operation, and because both need the raw request/response
the services deliberately never see:

- Authentication throttling (`identity.throttling`), checked *before* the
  underlying work so an over-limit request never reaches a password hash or
  a Google signature verification. The services stay usable from a
  management command or a future non-HTTP adapter without a request to
  throttle against.
- Handing the refresh credential to the client and taking it back: it travels
  in the response body and as a mutation argument, never as a cookie.
"""

import strawberry

import identity.authentication as auth_service
import identity.avatars as avatars
import identity.services as services
import identity.throttling as throttling
from identity.authentication import AuthenticationError
from identity.models import User
from identity.services import (
    AccountError,
    EmailLinkError,
    RegistrationError,
    RegistrationInput,
    register_user,
)
from identity.throttling import ThrottledError

# The refresh credential: a long-lived, single-use, server-revocable token that the
# client keeps and sends back to `refreshToken` and `logout`. It is returned in the
# response body and taken as a mutation argument - there is no cookie - so the browser
# app works the same whether or not it is served from the API's own site. The access
# token, a short-lived JWT, is what authenticates every other request
# (`Authorization: Bearer`).


@strawberry.type(description='A registered platform account (safe, public fields only).')
class UserType:
    id: strawberry.ID
    email: str
    first_name: str
    last_name: str
    phone_number: str
    is_active: bool
    is_verified: bool
    avatar_url: str | None = None

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
            avatar_url=avatars.avatar_url(user),
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
    # The new refresh credential, to keep and present to `refreshToken` once the access
    # token is due. Null when none was issued - a failure, or a refresh inside the
    # rotation grace window, where the client already holds the current one.
    refresh_token: str | None = None
    refresh_token_expires_at: str | None = None
    user: UserType | None = None


def _signed_in(message: str, session: auth_service.AuthenticatedSession) -> AuthPayload:
    return AuthPayload(
        success=True,
        message=message,
        access_token=session.access_token,
        access_token_expires_at=session.access_token_expires_at.isoformat(),
        refresh_token=session.refresh_token,
        refresh_token_expires_at=(
            session.refresh_token_expires_at.isoformat()
            if session.refresh_token_expires_at
            else None
        ),
        user=UserType.from_model(session.user),
    )


@strawberry.type(description='Result of logging out.')
class LogoutPayload:
    success: bool


@strawberry.input(description='The email address to send a password reset link to.')
class RequestPasswordResetInput:
    email: str


@strawberry.input(
    description=('The token from a password reset link, together with the new password to set.')
)
class ResetPasswordInput:
    token: str
    new_password: str


@strawberry.input(description='The token from an account activation link.')
class ActivateAccountInput:
    token: str


@strawberry.input(description='The email address to send a confirmation link to.')
class ResendActivationEmailInput:
    email: str


@strawberry.type(
    description=(
        'Result of an operation that establishes no session: requesting a '
        'reset link, setting a new password with one, following an activation '
        'link, or asking for the activation link again. On success, `user` is '
        'the affected account where the operation had one (resetting a '
        'password, activating an account) and `null` where it did not '
        '(requesting a link) - the difference is what the caller already '
        'knows, never something it could not already see.'
    )
)
class ActionPayload:
    success: bool
    message: str
    # The input field a failure applies to, in the same camelCase naming the
    # schema uses - 'email', 'password' or 'token' - or null for a whole-form
    # failure. `RegisterPayload.field` explains the same convention.
    field: str | None = None
    user: UserType | None = None


@strawberry.input(description="The signed-in user's editable profile fields.")
class UpdateProfileInput:
    first_name: str
    last_name: str
    phone_number: str


@strawberry.input(description='The current password and the one to replace it with.')
class ChangePasswordInput:
    current_password: str
    new_password: str
    # This device's refresh token, so it stays signed in while every other one is
    # signed out. Without it, this device is signed out too at its next refresh.
    refresh_token: str | None = None


def _to_camel_case(snake_case_name: str) -> str:
    """`phone_number` -> `phoneNumber`, matching Strawberry's own field-name
    conversion so `RegisterPayload.field` names a field the way the client
    actually sees it in `RegisterInput`, not the Python-side attribute name.
    """
    first, *rest = snake_case_name.split('_')
    return first + ''.join(word.capitalize() for word in rest)


def _failed_action(exc: EmailLinkError) -> ActionPayload:
    """
    Report an `EmailLinkError` the way `register` reports a `RegistrationError`.

    The two exceptions carry the same `(message, field)` pair precisely so
    they can be rendered by the same rule, and both messages are written to be
    shown verbatim - the invalid-link ones especially, which are the only thing
    a caller holding a bad token is told about it.
    """
    return ActionPayload(
        success=False,
        message=exc.message,
        field=_to_camel_case(exc.field) if exc.field else None,
    )


@strawberry.type
class Query:
    @strawberry.field(
        description=(
            'The currently authenticated user (from the Authorization: Bearer '
            'access token), or null if the request is unauthenticated.'
        )
    )
    def me(self, info: strawberry.Info) -> UserType | None:
        # `info.context.user` (graphql_api/context.py) is the one place a
        # resolver gets the authenticated user from - this resolver never
        # decodes a token or reads a header itself, and neither should any
        # future one (S1-006+).
        user = info.context.user
        return UserType.from_model(user) if user else None


@strawberry.type
class Mutation:
    @strawberry.mutation(description="Update the signed-in user's name and phone number.")
    def update_profile(self, info: strawberry.Info, input: UpdateProfileInput) -> ActionPayload:
        user = info.context.user
        if user is None:
            return ActionPayload(success=False, message='Sign in to update your profile.')
        try:
            user = services.update_profile(
                user, input.first_name, input.last_name, input.phone_number
            )
        except AccountError as exc:
            return ActionPayload(
                success=False,
                message=exc.message,
                field=_to_camel_case(exc.field) if exc.field else None,
            )
        return ActionPayload(
            success=True, message='Your profile has been updated.', user=UserType.from_model(user)
        )

    @strawberry.mutation(
        description=(
            "Change the signed-in user's password. Requires the current password. "
            'Every other device is signed out; this one stays signed in.'
        )
    )
    def change_password(self, info: strawberry.Info, input: ChangePasswordInput) -> ActionPayload:
        user = info.context.user
        if user is None:
            return ActionPayload(success=False, message='Sign in to change your password.')
        try:
            throttling.guard_password_change(user.pk)
            services.change_password(
                user,
                input.current_password,
                input.new_password,
                keep_refresh_token=input.refresh_token or '',
            )
        except ThrottledError as exc:
            return ActionPayload(success=False, message=str(exc))
        except AccountError as exc:
            return ActionPayload(
                success=False,
                message=exc.message,
                field=_to_camel_case(exc.field) if exc.field else None,
            )
        return ActionPayload(
            success=True,
            message='Your password has been changed. Other devices have been signed out.',
        )

    @strawberry.mutation(
        description=(
            'Register a new platform account and email it an activation link. '
            'The returned user has `isVerified: false` until that link is '
            'followed; it can still sign in, since verification is not a login '
            'requirement. Profile details are completed later.'
        )
    )
    def register(self, info: strawberry.Info, input: RegisterInput) -> RegisterPayload:
        try:
            # Throttled before any validation, so a flood of registration
            # attempts costs a cache increment each rather than a full Django
            # password-validator pass. A throttle is not a registration
            # failure, so it never names a field: no field of the form is at
            # fault, and attributing it to one would be a lie the frontend
            # would render as a validation error.
            throttling.guard_registration(info.context.request)
        except ThrottledError as exc:
            return RegisterPayload(success=False, message=str(exc))

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
            # Before `auth_service.login`, deliberately: that call verifies a
            # password hash, and the point of the limit is that a throttled
            # caller must not be able to make the server do that work for
            # them.
            throttling.guard_login(info.context.request, input.email)
            session = auth_service.login(input.email, input.password)
        except ThrottledError as exc:
            return AuthPayload(success=False, message=str(exc))
        except AuthenticationError as exc:
            return AuthPayload(success=False, message=str(exc))

        # A correct password clears that account's own counter, so the next
        # run of mistyped passwords starts from zero rather than from the
        # accumulated total. Only this account's: the per-client counter is
        # the spray limit and is left for its window to expire.
        throttling.clear_login_account(input.email)

        return _signed_in('Signed in successfully.', session)

    @strawberry.mutation(
        description=(
            'Sign in (or provision a new account) using a verified Google '
            "identity. Accepts the ID token issued by Google Identity Services'"
            ' Sign In With Google flow, verifies it server-side, and on '
            'success behaves exactly like `login`: returns a short-lived access '
            'token and a refresh token.'
        )
    )
    def google_login(self, info: strawberry.Info, input: GoogleLoginInput) -> AuthPayload:
        try:
            # Before verification, for the same reason `login` throttles
            # before authenticating: verifying Google's signature is the
            # expensive part, and an over-limit caller must not be able to
            # make us perform it on demand.
            throttling.guard_google_login(info.context.request, input.credential)
            session = auth_service.authenticate_with_google(input.credential)
        except (AuthenticationError, ThrottledError) as exc:
            return AuthPayload(success=False, message=str(exc))

        return _signed_in('Signed in successfully.', session)

    @strawberry.mutation(
        description=(
            'Exchange a refresh token for a new access token, rotating the refresh '
            'token in the same operation: the one presented stops working and a new '
            'one is returned. Inside the short rotation grace window - several tabs '
            'refreshing at once - a just-rotated token gets a new access token and no '
            'new refresh token.'
        )
    )
    def refresh_token(self, info: strawberry.Info, refresh_token: str = '') -> AuthPayload:
        raw_token = refresh_token.strip()
        try:
            throttling.guard_refresh(raw_token, info.context.request)
        except ThrottledError as exc:
            # The session itself is fine; it is the request rate that is not. The
            # frontend treats an unsuccessful refresh as "sign me out" (fail closed),
            # and signing in again after the window works normally.
            return AuthPayload(success=False, message=str(exc))

        try:
            session = auth_service.refresh(raw_token)
        except AuthenticationError as exc:
            return AuthPayload(success=False, message=str(exc))
        return _signed_in('Session renewed.', session)

    @strawberry.mutation(
        description=(
            'Revoke a refresh token, signing that device out. Answers the same '
            'whether or not the token was still valid.'
        )
    )
    def logout(self, info: strawberry.Info, refresh_token: str = '') -> LogoutPayload:
        auth_service.logout(refresh_token.strip())
        return LogoutPayload(success=True)

    @strawberry.mutation(
        description=(
            'Email a password reset link to `input.email`. Answers the same '
            'way whether or not that address has an account, so it cannot be '
            'used to find out whether someone is registered here - see '
            'identity.services.request_password_reset. Throttled per address '
            'and per client so it cannot be used to mail someone else on '
            'demand.'
        )
    )
    def request_password_reset(
        self, info: strawberry.Info, input: RequestPasswordResetInput
    ) -> ActionPayload:
        try:
            throttling.guard_password_reset_request(info.context.request, input.email)
        except ThrottledError as exc:
            return ActionPayload(success=False, message=str(exc))

        try:
            message = services.request_password_reset(input.email)
        except EmailLinkError as exc:
            # Only ever a malformed address - see the docstring. Reported
            # plainly, because the answer would be the same for a registered
            # address and an unregistered one.
            return _failed_action(exc)

        return ActionPayload(success=True, message=message)

    @strawberry.mutation(
        description=(
            'Set a new password using the token from a reset link. The token '
            'is spent on success and every existing session for the account is '
            "revoked, so the caller's own refresh cookie is cleared too - they "
            'must sign in again with the new password.'
        )
    )
    def reset_password(self, info: strawberry.Info, input: ResetPasswordInput) -> ActionPayload:
        try:
            # Before the lookup, for the same reason login throttles before
            # authenticating: the point is that an over-limit caller never gets
            # this far. What is being bounded is the work an anonymous request
            # can cause, not guesses at the token - see
            # identity.throttling.PASSWORD_RESET_PER_CLIENT.
            throttling.guard_password_reset(info.context.request)
            user = services.reset_password(input.token, input.new_password)
        except ThrottledError as exc:
            return ActionPayload(success=False, message=str(exc))
        except EmailLinkError as exc:
            return _failed_action(exc)

        return ActionPayload(
            success=True,
            message='Your password has been reset. Please sign in with your new password.',
            user=UserType.from_model(user),
        )

    @strawberry.mutation(
        description=(
            'Confirm an email address using the token from an activation link. '
            "Idempotent: following an already-confirmed account's link "
            'succeeds again and spends the token, so a link that gets '
            'prefetched by a mail client cannot be replayed afterwards.'
        )
    )
    def activate_account(self, info: strawberry.Info, input: ActivateAccountInput) -> ActionPayload:
        try:
            throttling.guard_activation(info.context.request)
            user = services.activate_account(input.token)
        except ThrottledError as exc:
            return ActionPayload(success=False, message=str(exc))
        except EmailLinkError as exc:
            return _failed_action(exc)

        return ActionPayload(
            success=True,
            message='Your email address has been confirmed.',
            user=UserType.from_model(user),
        )

    @strawberry.mutation(
        description=(
            'Email another activation link to `input.email`, for an account '
            'whose original link was lost. Answers the same way whether or '
            'not that address needs confirming.'
        )
    )
    def resend_activation_email(
        self, info: strawberry.Info, input: ResendActivationEmailInput
    ) -> ActionPayload:
        try:
            throttling.guard_activation_resend(info.context.request, input.email)
        except ThrottledError as exc:
            return ActionPayload(success=False, message=str(exc))

        try:
            message = services.request_account_activation(input.email)
        except EmailLinkError as exc:
            return _failed_action(exc)

        return ActionPayload(success=True, message=message)
