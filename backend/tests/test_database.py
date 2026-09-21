import pytest
from django.conf import settings
from django.db import connection


@pytest.mark.django_db
def test_database_is_postgresql():
    assert connection.vendor == 'postgresql'


@pytest.mark.django_db
def test_database_is_the_disposable_test_database():
    # Django creates and destroys a separate test_<name> database, so the
    # tests never touch the development database's data.
    assert connection.settings_dict['NAME'].startswith('test_')
    assert settings.DATABASES['default']['NAME'] == connection.settings_dict['NAME']


@pytest.mark.django_db
def test_database_accepts_queries():
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        assert cursor.fetchone() == (1,)
