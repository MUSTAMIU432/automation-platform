"""
Identity domain's GraphQL surface.

This module defines Strawberry types to be merged into the root schema
(`graphql_api/schema.py`) via inheritance - it does not instantiate its own
`strawberry.Schema`. See that module's docstring for why: one schema, with
each business domain contributing a slice of it.

Resolvers here stay thin: they translate between GraphQL types and
`identity.services`, which owns the actual validation and business logic.
"""

import strawberry

from identity.models import User
from identity.services import RegistrationError, RegistrationInput, register_user


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


def _to_camel_case(snake_case_name: str) -> str:
    """`phone_number` -> `phoneNumber`, matching Strawberry's own field-name
    conversion so `RegisterPayload.field` names a field the way the client
    actually sees it in `RegisterInput`, not the Python-side attribute name.
    """
    first, *rest = snake_case_name.split('_')
    return first + ''.join(word.capitalize() for word in rest)


@strawberry.type
class Mutation:
    @strawberry.mutation(
        description=(
            'Register a new platform account. Creates the User record only - '
            'profile details, sign-in tokens and email verification are handled '
            'by later Identity operations.'
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
