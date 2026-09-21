from strawberry.django.views import GraphQLView

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt

from .schema import schema

# CSRF-exempt: this endpoint has no session/cookie-based auth yet (none is
# introduced until a later sprint), so Django's CSRF protection - designed
# for cookie-authenticated form/browser requests - doesn't apply here.
graphql_view = csrf_exempt(
    GraphQLView.as_view(
        schema=schema,
        graphql_ide='graphiql' if settings.DEBUG else None,
    )
)
