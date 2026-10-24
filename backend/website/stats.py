"""
The platform's headline figures, as the public website shows them.

Counts only - no names, no tenants, nothing a visitor could not learn from the size of
the platform itself - and cached briefly, because the homepage is public and every
visit would otherwise be five table scans.
"""

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.core.cache import cache

from automation.models import Project
from ideas.models import Idea
from organizations.models import Organization
from reviews.models import Review

CACHE_KEY = 'website:platform_stats'
CACHE_SECONDS = 300


@dataclass(frozen=True)
class PlatformStats:
    ideas_submitted: int
    organizations: int
    projects: int
    active_users: int
    reviews_completed: int


def platform_stats() -> PlatformStats:
    cached = cache.get(CACHE_KEY)
    if cached is not None:
        return cached
    stats = PlatformStats(
        # Submitted at least once: a draft is still private to its author.
        ideas_submitted=Idea.objects.exclude(status=Idea.Status.DRAFT).count(),
        organizations=Organization.objects.count(),
        projects=Project.objects.count(),
        active_users=get_user_model().objects.filter(is_active=True).count(),
        reviews_completed=Review.objects.filter(completed_at__isnull=False).count(),
    )
    cache.set(CACHE_KEY, stats, CACHE_SECONDS)
    return stats
