"""
Identity domain services.

GraphQL (or any other adapter - a future REST endpoint, a management
command) calls these functions rather than talking to the User model
directly, so registration and future authentication logic stay owned by
the identity app instead of leaking into the API layer.
"""

from dataclasses import dataclass

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction

from identity.models import User, validate_phone_number


class RegistrationError(Exception):
    """
    Raised for any registration input/business-rule failure.

    `field` names the offending input field (e.g. `'email'`) when the
    error applies to one, so a caller like the GraphQL layer can report it
    the same way the frontend already reports its own client-side
    validation errors - field-by-field, not just a single blob of text.
    It's `None` for whole-form errors.
    """

    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


@dataclass(frozen=True)
class RegistrationInput:
    first_name: str
    last_name: str
    email: str
    phone_number: str
    password: str


def _require_non_empty(value: str, field: str, message: str) -> str:
    value = (value or '').strip()
    if not value:
        raise RegistrationError(message, field=field)
    return value


def _validate_and_normalize_email(email: str) -> str:
    """
    Validate `email` and return it normalized.

    Security note: unlike a future "forgot password" flow (which must
    return the same generic response whether or not an account exists, to
    avoid confirming account existence to an attacker), registration is
    initiated by someone actively trying to claim that exact email. Telling
    them it's already taken is required for them to know to sign in
    instead, and is no more than they could already infer from a slower,
    generic failure - so this reports it plainly rather than inventing an
    ambiguous response.
    """
    if not (email or '').strip():
        raise RegistrationError('Email is required.', field='email')

    normalized_email = User.objects.normalize_email(email)
    try:
        validate_email(normalized_email)
    except ValidationError:
        raise RegistrationError('Enter a valid email address.', field='email') from None

    if User.objects.filter(email=normalized_email).exists():
        raise RegistrationError('An account with this email already exists.', field='email')

    return normalized_email


def _validate_phone_number(phone_number: str) -> str:
    phone_number = (phone_number or '').strip()
    if not phone_number:
        raise RegistrationError('Phone number is required.', field='phone_number')

    try:
        validate_phone_number(phone_number)
    except ValidationError as exc:
        raise RegistrationError(exc.messages[0], field='phone_number') from None

    return phone_number


def _validate_password(password: str, user: User) -> None:
    if not password:
        raise RegistrationError('Password is required.', field='password')

    try:
        password_validation.validate_password(password, user=user)
    except ValidationError as exc:
        raise RegistrationError(' '.join(exc.messages), field='password') from None


def register_user(data: RegistrationInput) -> User:
    """
    Validate `data` and create a new platform account.

    Raises RegistrationError for any validation or business-rule failure
    (missing name, invalid email, an email already registered, an invalid
    phone number, or a password that fails Django's password validators).
    Never lets a raw Django/database exception escape - callers only need
    to handle RegistrationError.
    """
    first_name = _require_non_empty(data.first_name, 'first_name', 'First name is required.')
    last_name = _require_non_empty(data.last_name, 'last_name', 'Last name is required.')
    normalized_email = _validate_and_normalize_email(data.email)
    phone_number = _validate_phone_number(data.phone_number)

    user = User(
        email=normalized_email,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
    )

    # Validated against the (unsaved) user instance so
    # UserAttributeSimilarityValidator can compare it against the name/email
    # above, then hashed - never persisted or logged in plain text.
    _validate_password(data.password, user)
    user.set_password(data.password)

    try:
        user.full_clean()
    except ValidationError as exc:
        message = '; '.join(m for messages in exc.message_dict.values() for m in messages)
        raise RegistrationError(message or 'Invalid registration details.') from None

    try:
        with transaction.atomic():
            user.save()
    except IntegrityError:
        # Race: two concurrent registrations for the same email landed
        # between the `.exists()` check above and this save. The database's
        # unique constraint on `email` is the real guarantee; the earlier
        # check is only a fast path that produces a friendlier error in the
        # overwhelmingly common non-race case.
        raise RegistrationError(
            'An account with this email already exists.', field='email'
        ) from None

    return user
