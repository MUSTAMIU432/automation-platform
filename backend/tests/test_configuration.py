from django.core.management import call_command


def test_django_system_checks_pass():
    call_command('check')


def test_settings_load_with_local_configuration(settings):
    assert settings.ROOT_URLCONF == 'config.urls'
    assert settings.SECRET_KEY


def test_foundation_apps_are_installed(settings):
    assert 'graphql_api' in settings.INSTALLED_APPS
    assert 'strawberry_django' in settings.INSTALLED_APPS
