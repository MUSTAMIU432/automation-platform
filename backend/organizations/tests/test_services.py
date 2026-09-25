from unittest.mock import patch

import pytest
from django.db import IntegrityError

from identity.models import User
from organizations import services
from organizations.models import Membership, Organization


def _make_user(email='ada@example.com', **overrides):
    fields = {
        'first_name': 'Ada',
        'last_name': 'Lovelace',
        'phone_number': '+255712345678',
        'password': 'a-strong-unique-pass-1',
    }
    fields.update(overrides)
    return User.objects.create_user(email=email, **fields)


@pytest.mark.django_db
class TestCreateOrganizationForUser:
    def test_creates_organization_and_active_creator_membership(self):
        user = _make_user()

        result = services.create_organization_for_user(
            user, services.CreateOrganizationInput(name='Acme Labs')
        )

        assert result.organization.name == 'Acme Labs'
        assert result.organization.slug == 'acme-labs'
        assert result.membership.user_id == user.pk
        assert result.membership.status == Membership.Status.ACTIVE
        assert Organization.objects.count() == 1
        assert Membership.objects.count() == 1

    def test_normalizes_custom_slug(self):
        user = _make_user()

        result = services.create_organization_for_user(
            user,
            services.CreateOrganizationInput(name='Acme Labs', slug='  ACME / Labs  '),
        )

        assert result.organization.slug == 'acme-labs'

    def test_blank_custom_slug_generates_from_name(self):
        user = _make_user()

        result = services.create_organization_for_user(
            user,
            services.CreateOrganizationInput(name='Acme Labs', slug='   '),
        )

        assert result.organization.slug == 'acme-labs'

    def test_rejects_duplicate_slug(self):
        user = _make_user()
        services.create_organization_for_user(
            user, services.CreateOrganizationInput(name='Acme Labs', slug='acme-labs')
        )

        with pytest.raises(services.OrganizationError) as exc_info:
            services.create_organization_for_user(
                _make_user('grace@example.com'),
                services.CreateOrganizationInput(name='Other Labs', slug='acme-labs'),
            )

        assert exc_info.value.field == 'slug'
        assert Organization.objects.count() == 1

    def test_rejects_missing_name(self):
        with pytest.raises(services.OrganizationError) as exc_info:
            services.create_organization_for_user(
                _make_user(), services.CreateOrganizationInput(name='  ')
            )

        assert exc_info.value.field == 'name'

    def test_rejects_overlong_name(self):
        with pytest.raises(services.OrganizationError) as exc_info:
            services.create_organization_for_user(
                _make_user(), services.CreateOrganizationInput(name='a' * 201)
            )

        assert exc_info.value.field == 'name'

    def test_rejects_overlong_slug(self):
        with pytest.raises(services.OrganizationError) as exc_info:
            services.create_organization_for_user(
                _make_user(),
                services.CreateOrganizationInput(name='Acme Labs', slug='a' * 101),
            )

        assert exc_info.value.field == 'slug'

    def test_rejects_inactive_user(self):
        user = _make_user()
        user.is_active = False
        user.save(update_fields=['is_active'])

        with pytest.raises(services.OrganizationError):
            services.create_organization_for_user(
                user, services.CreateOrganizationInput(name='Acme Labs')
            )

    def test_membership_failure_rolls_back_organization(self):
        user = _make_user()

        with (
            patch.object(
                services.Membership.objects,
                'create',
                side_effect=IntegrityError('membership failed'),
            ),
            pytest.raises(services.OrganizationError) as exc_info,
        ):
            services.create_organization_for_user(
                user, services.CreateOrganizationInput(name='Acme Labs')
            )

        assert exc_info.value.field is None
        assert 'membership' in exc_info.value.message.lower()
        assert Organization.objects.count() == 0
        assert Membership.objects.count() == 0

    def test_duplicate_slug_race_is_converted_to_domain_error(self):
        user = _make_user()

        with (
            patch.object(
                services.Organization.objects,
                'create',
                side_effect=IntegrityError('duplicate slug'),
            ),
            pytest.raises(services.OrganizationError) as exc_info,
        ):
            services.create_organization_for_user(
                user, services.CreateOrganizationInput(name='Acme Labs')
            )

        assert exc_info.value.field == 'slug'


@pytest.mark.django_db
class TestOrganizationAccessServices:
    def test_lists_only_active_memberships_for_user(self):
        user = _make_user()
        active = Organization.objects.create(name='Active', slug='active')
        inactive = Organization.objects.create(name='Inactive', slug='inactive')
        Membership.objects.create(user=user, organization=active)
        Membership.objects.create(
            user=user,
            organization=inactive,
            status=Membership.Status.INACTIVE,
        )

        result = services.list_organizations_for_user(user)

        assert [item.organization.pk for item in result] == [active.pk]

    def test_get_organization_requires_active_membership(self):
        user = _make_user()
        other_user = _make_user('grace@example.com')
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')
        Membership.objects.create(user=other_user, organization=organization)

        assert services.get_organization_for_user(user, organization.pk) is None
        assert services.get_organization_for_user(other_user, organization.pk) == organization

    def test_member_listing_hides_organizations_from_non_members(self):
        user = _make_user()
        other_user = _make_user('grace@example.com')
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')
        membership = Membership.objects.create(user=other_user, organization=organization)

        assert services.list_memberships_for_organization(user, organization.pk) == []
        assert services.list_memberships_for_organization(other_user, organization.pk) == [
            membership
        ]

    def test_member_listing_rejects_inactive_requester_membership(self):
        requester = _make_user()
        member = _make_user('grace@example.com')
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')
        Membership.objects.create(
            user=requester,
            organization=organization,
            status=Membership.Status.INACTIVE,
        )
        Membership.objects.create(user=member, organization=organization)

        assert services.list_memberships_for_organization(requester, organization.pk) == []

    def test_invalid_organization_id_is_not_accessible(self):
        user = _make_user()

        assert services.get_organization_for_user(user, 'not-an-id') is None
        assert services.list_memberships_for_organization(user, 'not-an-id') == []
