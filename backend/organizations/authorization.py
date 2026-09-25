from typing import Literal

from identity.models import User
from organizations.models import Membership, MembershipRole, Organization

ORGANIZATION_VIEW = 'organization.view'
ORGANIZATION_CREATE = 'organization.create'
ORGANIZATION_UPDATE = 'organization.update'
ORGANIZATION_MEMBERS_VIEW = 'organization.members.view'
ORGANIZATION_MEMBERS_MANAGE = 'organization.members.manage'

AuthorizationReason = Literal['unauthenticated', 'membership_required', 'forbidden']


class AuthorizationError(Exception):
    def __init__(
        self,
        message: str,
        reason: AuthorizationReason = 'forbidden',
        field: str | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.reason = reason
        self.field = field


def _organization_id(organization: Organization | object) -> int | None:
    try:
        return int(str(getattr(organization, 'pk', organization)))
    except (TypeError, ValueError):
        return None


def _active_user(user: User | None) -> User | None:
    if user is None or not user.is_active:
        return None
    return user


def get_membership(user: User | None, organization: Organization | object) -> Membership | None:
    active_user = _active_user(user)
    normalized_id = _organization_id(organization)
    if active_user is None or normalized_id is None:
        return None

    return (
        Membership.objects.filter(
            user=active_user,
            organization_id=normalized_id,
            status=Membership.Status.ACTIVE,
        )
        .select_related('organization')
        .first()
    )


def is_member_of(user: User | None, organization: Organization | object) -> bool:
    return get_membership(user, organization) is not None


def membership_has_permission(membership: Membership | None, permission_code: str) -> bool:
    if membership is None or not permission_code:
        return False

    return MembershipRole.objects.filter(
        membership=membership,
        role__organization_id=membership.organization_id,
        role__role_permissions__permission__code=permission_code,
    ).exists()


def has_permission(
    user: User | None,
    organization: Organization | object,
    permission_code: str,
) -> bool:
    return membership_has_permission(get_membership(user, organization), permission_code)


def require_permission(
    user: User | None,
    organization: Organization | object,
    permission_code: str,
) -> Membership:
    if _active_user(user) is None:
        raise AuthorizationError('Authentication is required.', reason='unauthenticated')

    normalized_id = _organization_id(organization)
    if normalized_id is None or not Organization.objects.filter(id=normalized_id).exists():
        raise AuthorizationError('Organization is unavailable.')

    membership = get_membership(user, organization)
    if membership is None:
        raise AuthorizationError(
            'You must be an active member of this organization.',
            reason='membership_required',
        )

    if not has_permission(user, organization, permission_code):
        raise AuthorizationError('You do not have permission to perform this action.')

    return membership
