from typing import ClassVar

from django.contrib import admin

from organizations.models import Membership, Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = ['name', 'slug', 'created_at']
    search_fields: ClassVar[list[str]] = ['name', 'slug']
    readonly_fields: ClassVar[list[str]] = ['created_at', 'updated_at']


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display: ClassVar[list[str]] = [
        'user',
        'organization',
        'status',
        'created_at',
    ]
    list_filter: ClassVar[list[str]] = ['status']
    search_fields: ClassVar[list[str]] = [
        'user__email',
        'organization__name',
        'organization__slug',
    ]
    readonly_fields: ClassVar[list[str]] = ['created_at', 'updated_at']
