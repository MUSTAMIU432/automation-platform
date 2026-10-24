"""`platformStats`: real counts, open to anyone, and only counts."""

import json

import pytest
from django.core.cache import cache
from django.test import Client

from identity.models import User
from organizations.models import Organization
from website.stats import CACHE_KEY

QUERY = """
query { platformStats { ideasSubmitted organizations projects activeUsers reviewsCompleted } }
"""


def fetch():
    response = Client().post(
        '/graphql/', data=json.dumps({'query': QUERY}), content_type='application/json'
    )
    body = response.json()
    assert 'errors' not in body, body
    return body['data']['platformStats']


@pytest.mark.django_db
def test_an_anonymous_visitor_gets_the_real_counts():
    User.objects.create_user(email='a@example.com', password='a-strong-unique-pass-1')
    inactive = User.objects.create_user(email='b@example.com', password='a-strong-unique-pass-1')
    inactive.is_active = False
    inactive.save()
    Organization.objects.create(name='Acme', slug='acme')

    assert fetch() == {
        'ideasSubmitted': 0,
        'organizations': 1,
        'projects': 0,
        'activeUsers': 1,
        'reviewsCompleted': 0,
    }


@pytest.mark.django_db
def test_the_figures_are_cached_between_visits():
    assert fetch()['organizations'] == 0
    Organization.objects.create(name='Acme', slug='acme')

    assert fetch()['organizations'] == 0

    cache.delete(CACHE_KEY)
    assert fetch()['organizations'] == 1
