"""
Root GraphQL schema for the Automation Platform API.

This module holds only foundation/infrastructure types. Business-domain
schemas (identity, organizations, ideas, ...) will be introduced in later
sprints and merged into this root Query/Mutation, not scattered into
separate schema instances.
"""

import django
import strawberry


@strawberry.type
class ApiStatus:
    """Foundation type proving the GraphQL layer is wired up end to end."""

    status: str
    version: str
    django_version: str


@strawberry.type
class Query:
    @strawberry.field(
        description=(
            'Infrastructure check: proves the GraphQL endpoint is reachable and resolving.'
        )
    )
    def api_status(self) -> ApiStatus:
        return ApiStatus(
            status='ok',
            version='0.1.0',
            django_version=django.get_version(),
        )


@strawberry.type
class Mutation:
    @strawberry.mutation(
        description=('Infrastructure check: echoes the input to prove the mutation root resolves.')
    )
    def ping(self, message: str) -> str:
        return message


schema = strawberry.Schema(query=Query, mutation=Mutation)
