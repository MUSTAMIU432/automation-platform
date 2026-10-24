"""
The website's contact form at the GraphQL boundary.

What the frontend relies on: a message it is told was sent is a stored row; every
refusal is a `success: false` payload naming the field at fault, never a GraphQL
error; and the team's email, when configured, never decides the visitor's answer.
"""

import json
from unittest import mock

import pytest
from django.core import mail
from django.test import Client

from website.models import ContactMessage
from website.schema import CONTACT_PER_CLIENT

SEND = """
mutation Send($input: SendContactMessageInput!) {
  sendContactMessage(input: $input) { success message field }
}
"""

VALID = {
    'name': 'Ada Lovelace',
    'email': 'ada@example.com',
    'subject': 'Partnership',
    'message': 'We would like to submit ideas from our faculty.',
}


def send(**overrides):
    response = Client().post(
        '/graphql/',
        data=json.dumps({'query': SEND, 'variables': {'input': {**VALID, **overrides}}}),
        content_type='application/json',
    )
    body = response.json()
    assert 'errors' not in body, body
    return body['data']['sendContactMessage']


@pytest.mark.django_db
def test_a_valid_message_is_stored_and_reported_as_sent(settings):
    settings.CONTACT_NOTIFY_EMAIL = ''

    result = send(name='  Ada Lovelace  ')

    assert result['success'] is True
    stored = ContactMessage.objects.get()
    assert stored.name == 'Ada Lovelace'
    assert stored.email == 'ada@example.com'
    assert stored.is_handled is False
    assert mail.outbox == []


@pytest.mark.django_db
def test_the_team_is_emailed_with_the_visitor_as_reply_to(settings):
    settings.CONTACT_NOTIFY_EMAIL = 'team@example.com'

    send()

    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ['team@example.com']
    assert sent.reply_to == ['ada@example.com']
    assert 'Partnership' in sent.body
    assert 'Partnership' not in sent.subject


@pytest.mark.django_db
def test_a_failed_notification_still_keeps_the_message(settings):
    settings.CONTACT_NOTIFY_EMAIL = 'team@example.com'

    with mock.patch('website.services.EmailMessage.send', side_effect=OSError('down')):
        result = send()

    assert result['success'] is True
    assert ContactMessage.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('overrides', 'field'),
    [
        ({'name': '   '}, 'name'),
        ({'email': ''}, 'email'),
        ({'email': 'not-an-address'}, 'email'),
        ({'subject': ''}, 'subject'),
        ({'message': ''}, 'message'),
        ({'message': 'x' * 5001}, 'message'),
    ],
)
def test_an_invalid_message_is_refused_with_its_field(overrides, field):
    result = send(**overrides)

    assert result['success'] is False
    assert result['field'] == field
    assert ContactMessage.objects.count() == 0


@pytest.mark.django_db
def test_one_client_is_throttled_after_its_hourly_budget(settings):
    settings.CONTACT_NOTIFY_EMAIL = ''
    for _ in range(CONTACT_PER_CLIENT.limit):
        assert send()['success'] is True

    result = send()

    assert result == {
        'success': False,
        'message': 'Too many attempts. Please try again later.',
        'field': None,
    }
    assert ContactMessage.objects.count() == CONTACT_PER_CLIENT.limit
