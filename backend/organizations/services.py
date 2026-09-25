from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.utils.text import slugify

from identity.models import User
from organizations.models import (
    Membership,
    MembershipRole,
    Organization,
    Permission,
    Role,
    RolePermission,
)


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


PERMISSION_DEFINITIONS = (
    (
        'organization.view',
        'View organization',
        'View the organization workspace and its details.',
    ),
    (
        'organization.create',
        'Create organization',
        'Create a new organization workspace.',
    ),
    (
        'organization.update',
        'Update organization',
        'Update organization details.',
    ),
    (
        'organization.members.view',
        'View organization members',
        'View active memberships in the organization.',
    ),
    (
        'organization.members.manage',
        'Manage organization members',
        'Manage organization memberships and their roles.',
    ),
)
DEFAULT_OWNER_ROLE_SLUG = 'owner'


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


def _normalize_id(value: object, field: str) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        raise OrganizationError(f'Invalid {field}.', field=field) from None


def _permission_set() -> list[Permission]:
    permissions = []
    for code, name, description in PERMISSION_DEFINITIONS:
        permission, _ = Permission.objects.get_or_create(
            code=code,
            defaults={'name': name, 'description': description},
        )
        permissions.append(permission)
    return permissions


def _role_queryset():
    return Role.objects.select_related('organization').prefetch_related(
        'role_permissions__permission'
    )


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

        permissions = _permission_set()
        try:
            owner_role = Role.objects.create(
                organization=organization,
                name='Owner',
                slug=DEFAULT_OWNER_ROLE_SLUG,
                description='Full access to the organization foundation.',
                is_system=True,
            )
            RolePermission.objects.bulk_create(
                [
                    RolePermission(role=owner_role, permission=permission)
                    for permission in permissions
                ]
            )
        except IntegrityError:
            raise OrganizationError(
                'We could not provision the organization owner role. Please try again.'
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

        try:
            MembershipRole.objects.create(membership=membership, role=owner_role)
        except IntegrityError:
            raise OrganizationError(
                'We could not assign the organization owner role. Please try again.'
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
        .prefetch_related('membership_roles__role__role_permissions__permission')
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
        .prefetch_related('membership_roles__role__role_permissions__permission')
        .order_by('user__email')
    )
    return list(memberships)


def list_roles_for_user(user: User | None, organization_id: object | None = None) -> list[Role]:
    if user is None or not user.is_active:
        return []

    roles = _role_queryset().filter(
        organization__memberships__user=user,
        organization__memberships__status=Membership.Status.ACTIVE,
    )
    if organization_id is not None:
        try:
            normalized_id = int(str(organization_id))
        except (TypeError, ValueError):
            return []
        roles = roles.filter(organization_id=normalized_id)

    return list(roles.distinct().order_by('organization__name', 'name', 'slug'))


def get_role_for_user(user: User | None, role_id: object) -> Role | None:
    if user is None or not user.is_active:
        return None

    try:
        normalized_id = int(str(role_id))
    except (TypeError, ValueError):
        return None

    return (
        _role_queryset()
        .filter(
            id=normalized_id,
            organization__memberships__user=user,
            organization__memberships__status=Membership.Status.ACTIVE,
        )
        .first()
    )


def list_permissions_for_role(user: User | None, role_id: object) -> list[Permission]:
    role = get_role_for_user(user, role_id)
    if role is None:
        return []
    return [role_permission.permission for role_permission in role.role_permissions.all()]


def assign_role_to_membership(
    user: User | None, membership_id: object, role_id: object
) -> MembershipRole:
    user = _require_active_user(user)
    normalized_membership_id = _normalize_id(membership_id, 'membershipId')
    normalized_role_id = _normalize_id(role_id, 'roleId')

    with transaction.atomic():
        try:
            membership = (
                Membership.objects.select_for_update()
                .select_related('organization')
                .get(id=normalized_membership_id)
            )
            role = _role_queryset().select_for_update().get(id=normalized_role_id)
        except (Membership.DoesNotExist, Role.DoesNotExist):
            raise OrganizationError('Membership or role not found.') from None

        if membership.organization_id != role.organization_id:
            raise OrganizationError('Membership and role must belong to the same organization.')
        if membership.status != Membership.Status.ACTIVE:
            raise OrganizationError('Roles can only be assigned to active memberships.')
        if not Membership.objects.filter(
            user=user,
            organization_id=membership.organization_id,
            status=Membership.Status.ACTIVE,
        ).exists():
            raise OrganizationError('You must belong to the organization to manage its roles.')

        if MembershipRole.objects.filter(membership=membership, role=role).exists():
            raise OrganizationError('This membership already has this role.')

        try:
            return MembershipRole.objects.create(membership=membership, role=role)
        except IntegrityError:
            raise OrganizationError('This membership already has this role.') from None


def remove_role_from_membership(user: User | None, membership_id: object, role_id: object) -> None:
    user = _require_active_user(user)
    normalized_membership_id = _normalize_id(membership_id, 'membershipId')
    normalized_role_id = _normalize_id(role_id, 'roleId')

    with transaction.atomic():
        try:
            membership = Membership.objects.select_for_update().get(id=normalized_membership_id)
            role = Role.objects.get(id=normalized_role_id)
        except (Membership.DoesNotExist, Role.DoesNotExist):
            raise OrganizationError('Membership or role not found.') from None

        if membership.organization_id != role.organization_id:
            raise OrganizationError('Membership and role must belong to the same organization.')
        if not Membership.objects.filter(
            user=user,
            organization_id=membership.organization_id,
            status=Membership.Status.ACTIVE,
        ).exists():
            raise OrganizationError('You must belong to the organization to manage its roles.')

        deleted, _ = MembershipRole.objects.filter(membership=membership, role=role).delete()
        if not deleted:
            raise OrganizationError('This membership does not have this role.')
