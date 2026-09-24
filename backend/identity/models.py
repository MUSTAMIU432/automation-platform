"""
Identity domain models.

`User` is the platform account (email/password today; external providers
and future authentication mechanisms build on top of it, not into it).
`ExternalIdentity` is the minimal foundation for linking a User to an
external provider identity (Google now, others later) without putting any
provider-specific field directly on User.
"""

import re
from typing import ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models

# E.164-shaped: a leading '+', a non-zero first digit, then more digits,
# 7-15 digits total (E.164's own maximum). Deliberately not tied to any
# single country's numbering plan - the platform serves many - and
# deliberately not using a phone-number library, since none is already a
# project dependency and this is the level of authority the frontend's own
# (equally permissive) validation implies.
PHONE_NUMBER_PATTERN = re.compile(r'^\+[1-9]\d{6,14}$')


def validate_phone_number(value: str) -> None:
    """Authoritative, intentionally permissive phone number format check."""
    if not PHONE_NUMBER_PATTERN.match(value or ''):
        raise ValidationError(
            'Enter a valid phone number in international format, e.g. +255712345678.'
        )


class UserManager(BaseUserManager):
    """Creates Users with a hashed password and a normalized email."""

    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        """Lowercase the whole address, not just the domain.

        Django's built-in `BaseUserManager.normalize_email` only lowercases
        the domain part, leaving the local part's case untouched (RFC 5321
        technically permits a case-sensitive local part). In practice no
        mainstream mail provider treats the local part as case-sensitive, so
        leaving it alone would let `USER@example.com` and `user@example.com`
        register as two separate platform accounts - the exact bug this
        model is responsible for preventing. This intentionally does not
        apply provider-specific rules (e.g. Gmail's dot-insensitivity or
        +tag stripping): only case-folding, which holds for every provider.
        """
        return (email or '').strip().lower()

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Platform account. Email is the login identifier (see UserManager)."""

    email = models.EmailField('email address', unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    # String, not an integer field: phone numbers are not numbers you'd do
    # arithmetic on, and a leading '+' / leading zeros must survive storage.
    phone_number = models.CharField(max_length=20, validators=[validate_phone_number])

    is_active = models.BooleanField(
        default=True,
        help_text='Unset to deactivate an account without deleting it.',
    )
    is_verified = models.BooleanField(
        default=False,
        help_text='Email ownership has been confirmed. Not set automatically on registration.',
    )
    is_staff = models.BooleanField(
        default=False,
        help_text='Can access the Django admin site.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS: ClassVar[list[str]] = ['first_name', 'last_name', 'phone_number']

    class Meta:
        ordering: ClassVar[list[str]] = ['-created_at']

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        # Defense in depth: every path that constructs a User (the manager,
        # the admin, a shell, a fixture) ends up here, so the unique
        # constraint on `email` can only ever be bypassed by case if this is
        # skipped entirely - `create_user` already normalizes too, making
        # that the common case, not the only one.
        self.email = UserManager.normalize_email(self.email)
        super().save(*args, **kwargs)

    def get_full_name(self) -> str:
        return f'{self.first_name} {self.last_name}'.strip()

    def get_short_name(self) -> str:
        return self.first_name


class ExternalIdentity(models.Model):
    """
    Links a User to an identity from an external provider (Google now,
    others later). Deliberately minimal and provider-agnostic: no
    provider-specific field (e.g. `google_id`) lives on User itself, so
    adding another provider never touches the User model.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='external_identities')
    provider = models.CharField(max_length=32, help_text="e.g. 'google'.")
    provider_subject = models.CharField(
        max_length=255,
        help_text="The provider's stable unique identifier for this identity "
        "(e.g. Google's `sub` claim). Opaque to us; never assume a format.",
    )
    email = models.EmailField(
        help_text='The email the provider reported at link time. Informational - '
        'the platform identity is `user`, not this address.'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=['provider', 'provider_subject'],
                name='unique_external_identity_per_provider',
            ),
        ]
        ordering: ClassVar[list[str]] = ['-created_at']
        verbose_name_plural = 'external identities'

    def __str__(self) -> str:
        return f'{self.provider}:{self.provider_subject}'
