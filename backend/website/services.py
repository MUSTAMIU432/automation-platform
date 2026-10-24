"""
Sending a message to the team from the public website.

`send_contact_message` validates, stores, and then tells the team by email when
`CONTACT_NOTIFY_EMAIL` is set. The stored row is the outcome the visitor is told about;
a failed notification is logged and does not undo it.
"""

import logging
from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage
from django.core.validators import validate_email

from website.models import (
    MESSAGE_MAX_LENGTH,
    NAME_MAX_LENGTH,
    SUBJECT_MAX_LENGTH,
    ContactMessage,
)

logger = logging.getLogger(__name__)

SENT_MESSAGE = 'Thank you. Your message has reached the MUSTANET team.'


class ContactError(Exception):
    """The message was refused; `field` names the input at fault, in camelCase."""

    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.field = field


@dataclass(frozen=True)
class ContactInput:
    name: str
    email: str
    subject: str
    message: str


def _required(value: str, field: str, label: str, max_length: int) -> str:
    value = (value or '').strip()
    if not value:
        raise ContactError(f'{label} is required.', field)
    if len(value) > max_length:
        raise ContactError(f'{label} must be at most {max_length} characters.', field)
    return value


def send_contact_message(data: ContactInput) -> ContactMessage:
    name = _required(data.name, 'name', 'Name', NAME_MAX_LENGTH)
    email = _required(data.email, 'email', 'Email', 254)
    try:
        validate_email(email)
    except ValidationError:
        raise ContactError('Enter a valid email address.', 'email') from None
    subject = _required(data.subject, 'subject', 'Subject', SUBJECT_MAX_LENGTH)
    message = _required(data.message, 'message', 'Message', MESSAGE_MAX_LENGTH)

    record = ContactMessage.objects.create(name=name, email=email, subject=subject, message=message)
    _notify_team(record)
    return record


def _notify_team(record: ContactMessage) -> None:
    recipient = settings.CONTACT_NOTIFY_EMAIL
    if not recipient:
        return
    notification = EmailMessage(
        # The visitor's subject is theirs to choose, so it goes in the body, not the header.
        subject='New message from the MUSTANET website',
        body=(
            f'From: {record.name} <{record.email}>\nSubject: {record.subject}\n\n{record.message}\n'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient],
        reply_to=[record.email],
    )
    try:
        notification.send(fail_silently=False)
    except Exception:
        # Broad for the reason identity.email gives: the row is already saved, and no
        # delivery failure of any type should turn that into an error for the visitor.
        logger.exception('Could not email the team about contact message %s.', record.pk)
