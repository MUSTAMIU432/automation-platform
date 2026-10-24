"""
The public website's GraphQL surface, merged into the root schema.

Both operations are open to anyone, signed in or not: `platformStats` answers with
aggregate counts only (see `website.stats`), and `sendContactMessage` is throttled per
client address with the same shared counters `identity.throttling` uses for its
unauthenticated entry points.
"""

import strawberry
from django.core.cache import InvalidCacheBackendError

import website.services as services
from identity.throttling import (
    THROTTLED_MESSAGE,
    ThrottledError,
    ThrottlePolicy,
    register_attempt,
)
from website.stats import platform_stats

# Five messages an hour from one address: plenty for a person, little for a script.
CONTACT_PER_CLIENT = ThrottlePolicy('contact.client', limit=5, window_seconds=3600)


@strawberry.input
class SendContactMessageInput:
    name: str
    email: str
    subject: str
    message: str


@strawberry.type
class ContactPayload:
    success: bool
    message: str
    # The input a failure belongs to ('name', 'email', 'subject' or 'message'), or null.
    field: str | None = None


def _guard(request) -> None:
    # REMOTE_ADDR only, never a forwarded header - see identity.throttling._client_address.
    address = (request.META.get('REMOTE_ADDR') or '').strip() or 'unknown-client'
    try:
        register_attempt(CONTACT_PER_CLIENT, address)
    except (ThrottledError, InvalidCacheBackendError):
        raise ThrottledError(THROTTLED_MESSAGE) from None


@strawberry.type
class PlatformStatsType:
    ideas_submitted: int
    organizations: int
    projects: int
    active_users: int
    reviews_completed: int


@strawberry.type
class Query:
    @strawberry.field(
        description=(
            "The platform's headline figures for the public website: aggregate counts "
            'only, open to anyone, refreshed every few minutes.'
        )
    )
    def platform_stats(self) -> PlatformStatsType:
        stats = platform_stats()
        return PlatformStatsType(
            ideas_submitted=stats.ideas_submitted,
            organizations=stats.organizations,
            projects=stats.projects,
            active_users=stats.active_users,
            reviews_completed=stats.reviews_completed,
        )


@strawberry.type
class Mutation:
    @strawberry.mutation(
        description=(
            "Send a message to the team from the website's contact form. Stored, and "
            'emailed to CONTACT_NOTIFY_EMAIL when that is set. Throttled per client.'
        )
    )
    def send_contact_message(
        self, info: strawberry.Info, input: SendContactMessageInput
    ) -> ContactPayload:
        try:
            _guard(info.context.request)
        except ThrottledError as exc:
            return ContactPayload(success=False, message=str(exc))

        try:
            services.send_contact_message(
                services.ContactInput(
                    name=input.name,
                    email=input.email,
                    subject=input.subject,
                    message=input.message,
                )
            )
        except services.ContactError as exc:
            return ContactPayload(success=False, message=str(exc), field=exc.field)

        return ContactPayload(success=True, message=services.SENT_MESSAGE)
