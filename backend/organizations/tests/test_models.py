import pytest
from django.db import IntegrityError

from identity.models import User
from organizations.models import Membership, Organization


def _make_user(email='ada@example.com'):
    return User.objects.create_user(
        email=email,
        first_name='Ada',
        last_name='Lovelace',
        phone_number='+255712345678',
        password='a-strong-unique-pass-1',
    )


@pytest.mark.django_db
class TestOrganizationModel:
    def test_organization_can_be_created_with_stable_fields(self):
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')

        assert organization.pk is not None
        assert organization.name == 'Acme Labs'
        assert organization.slug == 'acme-labs'
        assert organization.created_at is not None
        assert organization.updated_at is not None

    def test_slug_is_unique(self):
        Organization.objects.create(name='Acme Labs', slug='acme-labs')

        with pytest.raises(IntegrityError):
            Organization.objects.create(name='Another Lab', slug='acme-labs')

    def test_str_returns_name(self):
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')

        assert str(organization) == 'Acme Labs'


@pytest.mark.django_db
class TestMembershipModel:
    def test_membership_links_user_and_organization(self):
        user = _make_user()
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')

        membership = Membership.objects.create(user=user, organization=organization)

        assert membership.user_id == user.pk
        assert membership.organization_id == organization.pk
        assert membership.status == Membership.Status.ACTIVE
        assert list(user.memberships.all()) == [membership]
        assert list(organization.memberships.all()) == [membership]

    def test_user_and_organization_pair_is_unique_regardless_of_status(self):
        user = _make_user()
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')
        Membership.objects.create(user=user, organization=organization)

        with pytest.raises(IntegrityError):
            Membership.objects.create(
                user=user,
                organization=organization,
                status=Membership.Status.INACTIVE,
            )

    def test_deleting_organization_deletes_memberships(self):
        user = _make_user()
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')
        membership = Membership.objects.create(user=user, organization=organization)

        organization.delete()

        assert not Membership.objects.filter(pk=membership.pk).exists()

    def test_deleting_user_deletes_memberships(self):
        user = _make_user()
        organization = Organization.objects.create(name='Acme Labs', slug='acme-labs')
        membership = Membership.objects.create(user=user, organization=organization)

        user.delete()

        assert not Membership.objects.filter(pk=membership.pk).exists()
