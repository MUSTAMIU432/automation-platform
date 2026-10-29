from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import GraphQLView

from .context import AuthenticatedGraphQLContext
from .schema import schema


class _AuthenticatedGraphQLView(GraphQLView):
    """
    The only change from Strawberry's own `GraphQLView`: the request
    context is `AuthenticatedGraphQLContext` (adds `user`, cached) instead
    of the base `StrawberryDjangoContext` - see `graphql_api/context.py`.
    """

    def get_context(
        self, request: HttpRequest, response: HttpResponse
    ) -> AuthenticatedGraphQLContext:
        return AuthenticatedGraphQLContext(request=request, response=response)


# CSRF-exempt, deliberately. Authentication here is token-based, with no
# cookie: the access token is a JWT the page attaches as `Authorization:
# Bearer`, and the refresh token is a mutation argument (identity/schema.py).
# A cross-site request therefore carries no credential the browser would add
# on its own - the precondition for CSRF does not exist. Independently, the
# endpoint only accepts JSON, which a bare HTML <form> cannot send, and
# CORS_ALLOWED_ORIGINS (config/settings/base.py) refuses the preflight a JSON
# request from any other origin needs. tests/test_csrf.py asserts both.
graphql_view = csrf_exempt(
    _AuthenticatedGraphQLView.as_view(
        schema=schema,
        graphql_ide='graphiql' if settings.DEBUG else None,
    )
)
