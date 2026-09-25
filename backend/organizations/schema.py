import strawberry

from identity.schema import UserType
from organizations import services
from organizations.models import Membership, Organization


@strawberry.type(description='An organization a platform user belongs to.')
class OrganizationType:
    id: strawberry.ID
    name: str
    slug: str
    created_at: str
    updated_at: str

    @staticmethod
    def from_model(organization: Organization) -> 'OrganizationType':
        return OrganizationType(
            id=strawberry.ID(str(organization.pk)),
            name=organization.name,
            slug=organization.slug,
            created_at=organization.created_at.isoformat(),
            updated_at=organization.updated_at.isoformat(),
        )


@strawberry.type(description='A user membership in an organization.')
class MembershipType:
    id: strawberry.ID
    status: str
    created_at: str
    updated_at: str
    user: UserType
    organization: OrganizationType

    @staticmethod
    def from_model(membership: Membership) -> 'MembershipType':
        return MembershipType(
            id=strawberry.ID(str(membership.pk)),
            status=membership.status,
            created_at=membership.created_at.isoformat(),
            updated_at=membership.updated_at.isoformat(),
            user=UserType.from_model(membership.user),
            organization=OrganizationType.from_model(membership.organization),
        )


@strawberry.type(description='An organization paired with the current user membership.')
class OrganizationMembershipType:
    organization: OrganizationType
    membership: MembershipType


@strawberry.input(description='Fields for creating an organization.')
class CreateOrganizationInput:
    name: str
    slug: str | None = None


@strawberry.type(description='Result of creating an organization.')
class CreateOrganizationPayload:
    success: bool
    message: str
    field: str | None = None
    organization: OrganizationType | None = None
    membership: MembershipType | None = None


@strawberry.type
class Query:
    @strawberry.field(description='Organizations the current user can access.')
    def me_organizations(self, info: strawberry.Info) -> list[OrganizationMembershipType]:
        user = info.context.user
        return [
            OrganizationMembershipType(
                organization=OrganizationType.from_model(item.organization),
                membership=MembershipType.from_model(item.membership),
            )
            for item in services.list_organizations_for_user(user)
        ]

    @strawberry.field(description='Active memberships for the current user.')
    def me_memberships(self, info: strawberry.Info) -> list[MembershipType]:
        user = info.context.user
        memberships = [item.membership for item in services.list_organizations_for_user(user)]
        return [MembershipType.from_model(membership) for membership in memberships]

    @strawberry.field(description='An organization visible to the current user.')
    def organization(self, info: strawberry.Info, id: strawberry.ID) -> OrganizationType | None:
        organization = services.get_organization_for_user(info.context.user, id)
        return OrganizationType.from_model(organization) if organization else None

    @strawberry.field(description='Active members of an organization the current user can access.')
    def organization_members(
        self, info: strawberry.Info, organization_id: strawberry.ID
    ) -> list[MembershipType]:
        memberships = services.list_memberships_for_organization(info.context.user, organization_id)
        return [MembershipType.from_model(membership) for membership in memberships]


@strawberry.type
class Mutation:
    @strawberry.mutation(description='Create an organization and its creator membership.')
    def create_organization(
        self, info: strawberry.Info, input: CreateOrganizationInput
    ) -> CreateOrganizationPayload:
        user = info.context.user
        if user is None:
            return CreateOrganizationPayload(
                success=False,
                message='You must be signed in to create an organization.',
            )

        try:
            result = services.create_organization_for_user(
                user,
                services.CreateOrganizationInput(name=input.name, slug=input.slug),
            )
        except services.OrganizationError as exc:
            return CreateOrganizationPayload(success=False, message=exc.message, field=exc.field)

        return CreateOrganizationPayload(
            success=True,
            message='Organization created successfully.',
            organization=OrganizationType.from_model(result.organization),
            membership=MembershipType.from_model(result.membership),
        )
