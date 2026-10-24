"""The dashboard's GraphQL surface: one query, merged into the root schema."""

import strawberry

from dashboard.counts import dashboard_counts


@strawberry.type
class DashboardCountsType:
    ideas: int
    review_queue: int
    my_ideas_in_review: int
    opportunities: int
    projects: int


@strawberry.type
class Query:
    @strawberry.field(
        description=(
            "The figures on the caller's dashboard: each counts what the page its card "
            'leads to would list for them (see dashboard.counts). `organizationId` is '
            "the organization picked in the app's switcher, whose review queue counts "
            'for a reviewer there. All zero for an anonymous caller.'
        )
    )
    def dashboard_counts(
        self, info: strawberry.Info, organization_id: strawberry.ID | None = None
    ) -> DashboardCountsType:
        counts = dashboard_counts(info.context.user, organization_id)
        return DashboardCountsType(
            ideas=counts.ideas,
            review_queue=counts.review_queue,
            my_ideas_in_review=counts.my_ideas_in_review,
            opportunities=counts.opportunities,
            projects=counts.projects,
        )
