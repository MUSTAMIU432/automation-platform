"""
The Ideas page's ordering and per-idea activity counts.

An ordering only arranges the rows the filters chose, and the comment and
attachment counts are what opening the card's discussion and evidence would list.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from automation.tests.test_opportunity import make_user, ready_idea
from ideas import selectors
from ideas.models import Comment, Idea, Vote
from ideas.schema import IdeaType
from ideas.tests.test_attachment_schema import make_attachment


def titles(user, sort=None):
    page = selectors.list_discoverable_ideas(user, selectors.IdeaFilters(sort=sort))
    return [idea.title for idea in page.items]


@pytest.fixture
def author(db):
    return make_user('author@example.com')


@pytest.fixture
def three_ideas(author):
    voter = make_user('voter@example.com')
    now = timezone.now()
    old = ready_idea(author, title='Old', status=Idea.Status.DRAFT)
    middle = ready_idea(author, title='Middle', status=Idea.Status.DRAFT)
    new = ready_idea(author, title='New', status=Idea.Status.DRAFT)
    Idea.objects.filter(pk=old.pk).update(created_at=now - timedelta(days=3), updated_at=now)
    Idea.objects.filter(pk=middle.pk).update(
        created_at=now - timedelta(days=2), updated_at=now - timedelta(days=2)
    )
    Idea.objects.filter(pk=new.pk).update(
        created_at=now - timedelta(days=1), updated_at=now - timedelta(days=1)
    )
    Vote.objects.create(idea=middle, user=author)
    Vote.objects.create(idea=middle, user=voter)
    Vote.objects.create(idea=old, user=voter)
    return old, middle, new


def test_newest_is_the_default_order(author, three_ideas):
    assert titles(author) == ['New', 'Middle', 'Old']
    assert titles(author, 'newest') == ['New', 'Middle', 'Old']
    assert titles(author, 'not-an-ordering') == ['New', 'Middle', 'Old']


def test_the_other_orderings(author, three_ideas):
    assert titles(author, 'oldest') == ['Old', 'Middle', 'New']
    assert titles(author, 'most_voted') == ['Middle', 'Old', 'New']
    assert titles(author, 'recently_updated') == ['Old', 'New', 'Middle']


def test_an_ordering_never_shows_more(author, three_ideas):
    stranger = make_user('stranger@example.com')

    assert titles(stranger, 'most_voted') == []


def test_each_row_carries_its_discussion_and_evidence_counts(author, three_ideas):
    old, middle, _new = three_ideas
    Comment.objects.create(idea=middle, author=author, content='First')
    Comment.objects.create(idea=middle, author=author, content='Second')
    make_attachment(old, author)

    rows = {
        idea.title: IdeaType.from_model(idea, author)
        for idea in selectors.list_discoverable_ideas(author).items
    }

    assert (rows['Middle'].comment_count, rows['Middle'].attachment_count) == (2, 0)
    assert (rows['Old'].comment_count, rows['Old'].attachment_count) == (0, 1)
    assert (rows['New'].comment_count, rows['New'].attachment_count) == (0, 0)


def test_a_single_idea_counts_without_the_annotation(author, three_ideas):
    old, _middle, _new = three_ideas
    make_attachment(old, author)
    Comment.objects.create(idea=old, author=author, content='Hi')

    row = IdeaType.from_model(Idea.objects.get(pk=old.pk), author)

    assert (row.comment_count, row.attachment_count) == (1, 1)
