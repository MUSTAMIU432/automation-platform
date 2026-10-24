"""
Messages sent from the public website's contact form.

Stored first, so a message the team was sent is never lost to a mail outage: the
database row is the record, and the notification email (`contact.services`) is only a
courtesy on top of it. Read and closed from Django's admin site.
"""

from django.db import models

NAME_MAX_LENGTH = 120
SUBJECT_MAX_LENGTH = 200
MESSAGE_MAX_LENGTH = 5000


class ContactMessage(models.Model):
    """One message from a visitor, who may or may not have an account."""

    name = models.CharField(max_length=NAME_MAX_LENGTH)
    email = models.EmailField()
    subject = models.CharField(max_length=SUBJECT_MAX_LENGTH)
    message = models.TextField(max_length=MESSAGE_MAX_LENGTH)
    # Whether someone on the team has dealt with it; set from the admin site.
    is_handled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self) -> str:
        return f'{self.subject} ({self.email})'
