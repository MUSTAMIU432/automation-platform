"""
The figures on a signed-in user's dashboard.

Each one counts exactly what the page its card leads to would list for that user,
through that page's own selector, so the number and the page can never disagree and
neither can show something the user may not read:

- **ideas** - every idea the user may read (`ideas.selectors.list_ideas`, the Ideas
  page);
- **review queue** - what is waiting for the user to review: the platform queue for a
  platform reviewer, plus the given organization's queue for a reviewer there (the
  Reviews page). Zero for anybody who reviews nothing;
- **my ideas in review** - the user's own ideas waiting on a reviewer, for the people
  who are waiting rather than reviewing;
- **opportunities** - the user's approved ideas on their way to delivery
  (`automation.services.list_opportunities`);
- **projects** - those of them being built (`automation.delivery.list_projects`).

Counts only: no titles, no owners - the pages themselves show those, with their own
checks.
"""

from dataclasses import dataclass

from automation.delivery import list_projects
from automation.services import list_opportunities
from ideas.models import Idea
from ideas.selectors import list_ideas
from reviews import eligibility
from reviews.organization_review import organization_queue_for
from reviews.platform_review import platform_queue

# An idea of the user's that is with a reviewer, at the organization or the platform.
WAITING_FOR_REVIEW = (
    Idea.Status.SUBMITTED_TO_ORGANIZATION,
    Idea.Status.SUBMITTED,
    Idea.Status.UNDER_REVIEW,
)


@dataclass(frozen=True)
class DashboardCounts:
    ideas: int
    review_queue: int
    my_ideas_in_review: int
    opportunities: int
    projects: int


def dashboard_counts(user, organization_id: object | None = None) -> DashboardCounts:
    if user is None or not user.is_active:
        return DashboardCounts(0, 0, 0, 0, 0)

    review_queue = len(platform_queue(user))
    if organization_id is not None and eligibility.is_organization_reviewer_in(
        user, organization_id
    ):
        review_queue += len(organization_queue_for(user, organization_id))

    readable = list_ideas(user)
    return DashboardCounts(
        ideas=readable.count(),
        review_queue=review_queue,
        my_ideas_in_review=readable.filter(author=user, status__in=WAITING_FOR_REVIEW).count(),
        opportunities=list_opportunities(user).count(),
        projects=list_projects(user).count(),
    )
