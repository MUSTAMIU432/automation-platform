"""
`dashboardCounts`: each figure is what its page would list for the caller, and
nothing the caller may not read is ever counted.
"""

import json

import pytest
from django.test import Client
from django.utils import timezone

from automation.tests.test_opportunity import make_user, opened, ready_idea
from dashboard.counts import dashboard_counts
from ideas.models import Idea

QUERY = """
query { dashboardCounts { ideas reviewQueue myIdeasInReview opportunities projects } }
"""


@pytest.mark.django_db
def test_an_anonymous_caller_gets_zeros():
    response = Client().post(
        '/graphql/', data=json.dumps({'query': QUERY}), content_type='application/json'
    )
    body = response.json()

    assert 'errors' not in body, body
    assert body['data']['dashboardCounts'] == {
        'ideas': 0,
        'reviewQueue': 0,
        'myIdeasInReview': 0,
        'opportunities': 0,
        'projects': 0,
    }


@pytest.mark.django_db
def test_it_counts_the_callers_own_ideas_and_those_waiting_on_a_reviewer():
    author = make_user('author@example.com')
    stranger = make_user('stranger@example.com')
    ready_idea(author, status=Idea.Status.DRAFT)
    ready_idea(author, status=Idea.Status.SUBMITTED, submitted_at=timezone.now())
    ready_idea(author, status=Idea.Status.UNDER_REVIEW, submitted_at=timezone.now())
    # Private to somebody else: never counted.
    ready_idea(stranger, status=Idea.Status.SUBMITTED, submitted_at=timezone.now())

    counts = dashboard_counts(author)

    assert counts.ideas == 3
    assert counts.my_ideas_in_review == 2
    # Reviews nothing, so nothing waits for them.
    assert counts.review_queue == 0


@pytest.mark.django_db
def test_an_opportunity_counts_for_its_owner_only():
    author = make_user('author@example.com')
    stranger = make_user('stranger@example.com')
    opened(author)

    assert dashboard_counts(author).opportunities == 1
    assert dashboard_counts(author).projects == 0
    assert dashboard_counts(stranger).opportunities == 0
    assert dashboard_counts(stranger).ideas == 0


@pytest.mark.django_db
def test_an_organization_queue_counts_only_for_a_reviewer_there():
    author = make_user('author@example.com')
    member = make_user('member@example.com')

    # Not a reviewer anywhere: the organization's id adds nothing.
    assert dashboard_counts(member, organization_id='12345').review_queue == 0
    assert dashboard_counts(author, organization_id='not-an-id').review_queue == 0
