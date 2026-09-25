from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.utils.text import slugify

from identity.models import User
from organizations.models import Membership, Organization


class OrganizationError(Exception):
    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


@dataclass(frozen=True)
class CreateOrganizationInput:
    name: str
    slug: str | None = None


@dataclass(frozen=True)
class OrganizationMembership:
    organization: Organization
    membership: Membership


def _require_active_user(user: User | None) -> User:
    if user is None or not user.is_active:
        raise OrganizationError('You must be signed in to access organizations.')
    return user


def _validate_name(name: str | None) -> str:
    normalized_name = (name or '').strip()
    if not normalized_name:
        raise OrganizationError('Organization name is required.', field='name')
    if len(normalized_name) > Organization._meta.get_field('name').max_length:
        raise OrganizationError('Organization name is too long.', field='name')
    return normalized_name


def _normalize_slug(name: str, value: str | None) -> str:
    slug_source = value if value and value.strip() else name
    normalized_slug = slugify(slug_source)
    if not normalized_slug:
        raise OrganizationError('Enter a name that can be represented as a slug.', field='slug')
    if len(normalized_slug) > Organization._meta.get_field('slug').max_length:
        raise OrganizationError('Organization slug is too long.', field='slug')
    return normalized_slug


def create_organization_for_user(
    user: User | None, data: CreateOrganizationInput
) -> OrganizationMembership:
    user = _require_active_user(user)
    name = _validate_name(data.name)
    normalized_slug = _normalize_slug(name, data.slug)

    if Organization.objects.filter(slug=normalized_slug).exists():
        raise OrganizationError('An organization with this slug already exists.', field='slug')

    with transaction.atomic():
        try:
            organization = Organization.objects.create(name=name, slug=normalized_slug)
        except IntegrityError:
            raise OrganizationError(
                'An organization with this slug already exists.', field='slug'
            ) from None

        try:
            membership = Membership.objects.create(
                user=user,
                organization=organization,
                status=Membership.Status.ACTIVE,
            )
        except IntegrityError:
            raise OrganizationError(
                'We could not create the organization membership. Please try again.'
            ) from None

    return OrganizationMembership(organization=organization, membership=membership)


def list_organizations_for_user(user: User | None) -> list[OrganizationMembership]:
    if user is None or not user.is_active:
        return []

    memberships = (
        Membership.objects.filter(
            user=user,
            status=Membership.Status.ACTIVE,
        )
        .select_related('organization', 'user')
        .order_by('organization__name', 'organization_id')
    )
    return [
        OrganizationMembership(organization=membership.organization, membership=membership)
        for membership in memberships
    ]


def get_organization_for_user(user: User | None, organization_id: object) -> Organization | None:
    if user is None or not user.is_active:
        return None

    try:
        normalized_id = int(str(organization_id))
    except (TypeError, ValueError):
        return None

    membership = (
        Membership.objects.filter(
            user=user,
            organization_id=normalized_id,
            status=Membership.Status.ACTIVE,
        )
        .select_related('organization')
        .first()
    )
    return membership.organization if membership else None


def list_memberships_for_organization(
    user: User | None, organization_id: object
) -> list[Membership]:
    if user is None or not user.is_active:
        return []

    try:
        normalized_id = int(str(organization_id))
    except (TypeError, ValueError):
        return []

    memberships = (
        Membership.objects.filter(
            organization_id=normalized_id,
            status=Membership.Status.ACTIVE,
            organization__memberships__user=user,
            organization__memberships__status=Membership.Status.ACTIVE,
        )
        .select_related('user', 'organization')
        .order_by('user__email')
    )
    return list(memberships)
