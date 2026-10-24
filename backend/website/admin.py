from typing import ClassVar

from django.contrib import admin

from website.models import ContactMessage


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    """The team's inbox for the website's contact form. Only `is_handled` is editable."""

    list_display: ClassVar[list[str]] = ['subject', 'name', 'email', 'is_handled', 'created_at']
    list_filter: ClassVar[list[str]] = ['is_handled']
    search_fields: ClassVar[list[str]] = ['name', 'email', 'subject', 'message']
    readonly_fields: ClassVar[list[str]] = ['name', 'email', 'subject', 'message', 'created_at']

    def has_add_permission(self, request) -> bool:
        return False
