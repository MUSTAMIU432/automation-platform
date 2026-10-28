"""
Uploaded-file storage configuration: Cloudflare R2 through `django-storages`.

The R2 credentials switch object storage on. Without them local development
and CI keep files on disk; with them, the `attachments` and `default`
storages point at the private bucket. A deployed environment must use R2 -
its local disk does not survive a deploy - so production refuses to start
without it.

Each case imports the settings module in a fresh interpreter (see
`.settings_helpers`), so a configuration is evaluated exactly as it would be
at startup. No request reaches Cloudflare: building settings never connects.
"""

import json

import pytest

from .settings_helpers import VALID_PRODUCTION_ENV, import_settings

S3_BACKEND = 'storages.backends.s3.S3Storage'
FILESYSTEM_BACKEND = 'django.core.files.storage.FileSystemStorage'
STATICFILES_BACKEND = 'django.contrib.staticfiles.storage.StaticFilesStorage'

R2_ENV = {name: VALID_PRODUCTION_ENV[name] for name in VALID_PRODUCTION_ENV if name[:3] == 'R2_'}
# Every R2 variable explicitly empty, so a developer's own backend/.env (read with
# `setdefault`) cannot switch R2 on underneath a test that expects it off.
NO_R2_ENV = dict.fromkeys(R2_ENV, '')
LOCAL = {'ENVIRONMENT': 'local'}

_PRINT_STORAGES = (
    'import json; from config.settings import {module} as s; '
    'out = {{}}\n'
    'for alias, conf in s.STORAGES.items():\n'
    '    options = dict(conf.get("OPTIONS", {{}}))\n'
    '    config = options.pop("client_config", None)\n'
    '    if config is not None:\n'
    '        options["client_config"] = {{\n'
    '            "signature_version": config.signature_version,\n'
    '            "request_checksum_calculation": config.request_checksum_calculation,\n'
    '            "response_checksum_validation": config.response_checksum_validation,\n'
    '        }}\n'
    '    out[alias] = {{"BACKEND": conf["BACKEND"], "OPTIONS": options}}\n'
    'print(json.dumps(out))'
)


def _storages(module, overrides):
    result = import_settings(
        f'config.settings.{module}', overrides, code=_PRINT_STORAGES.format(module=module)
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def _refused(module, overrides):
    result = import_settings(f'config.settings.{module}', overrides)
    assert result.returncode != 0
    assert 'ImproperlyConfigured' in result.stderr
    # Whatever the refusal says, it never echoes a credential.
    assert R2_ENV['R2_SECRET_ACCESS_KEY'] not in result.stderr
    assert R2_ENV['R2_ACCESS_KEY_ID'] not in result.stderr
    return result.stderr


class TestLocalDevelopmentWithoutR2:
    def test_files_stay_on_the_local_filesystem(self):
        storages = _storages('local', {**LOCAL, **NO_R2_ENV})

        assert storages['attachments']['BACKEND'] == FILESYSTEM_BACKEND
        assert storages['attachments']['OPTIONS']['location'].endswith('media/attachments')
        assert storages['default']['BACKEND'] == FILESYSTEM_BACKEND

    def test_the_env_example_template_as_copied_still_starts(self):
        # backend/.env.example ships the bucket name and an endpoint placeholder with
        # empty credentials; copying it unchanged must not break local startup.
        storages = _storages(
            'local',
            {
                **LOCAL,
                **NO_R2_ENV,
                'R2_BUCKET_NAME': 'mustanet-automation',
                'R2_ENDPOINT_URL': 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
            },
        )

        assert storages['attachments']['BACKEND'] == FILESYSTEM_BACKEND


class TestR2Configuration:
    @pytest.fixture
    def storages(self):
        return _storages('local', {**LOCAL, **R2_ENV})

    @pytest.mark.parametrize('alias', ['attachments', 'default'])
    def test_uploaded_files_go_to_the_r2_bucket(self, storages, alias):
        options = storages[alias]['OPTIONS']

        assert storages[alias]['BACKEND'] == S3_BACKEND
        assert options['bucket_name'] == R2_ENV['R2_BUCKET_NAME']
        assert options['endpoint_url'] == R2_ENV['R2_ENDPOINT_URL']
        assert options['access_key'] == R2_ENV['R2_ACCESS_KEY_ID']
        assert options['secret_key'] == R2_ENV['R2_SECRET_ACCESS_KEY']

    def test_r2_specific_client_settings(self, storages):
        options = storages['attachments']['OPTIONS']

        assert options['region_name'] == 'auto'
        assert options['client_config']['signature_version'] == 's3v4'
        # R2 does not need botocore's optional request checksums; sending them only
        # when an operation requires one keeps uploads working across boto3 releases.
        assert options['client_config']['request_checksum_calculation'] == 'when_required'
        assert options['client_config']['response_checksum_validation'] == 'when_required'

    def test_objects_are_private_and_never_overwritten(self, storages):
        options = storages['attachments']['OPTIONS']

        assert options['file_overwrite'] is False
        assert options['querystring_auth'] is True
        assert options['querystring_expire'] <= 600
        assert options['default_acl'] is None
        assert options.get('custom_domain') in (None, '')
        assert options['object_parameters']['ContentDisposition'] == 'attachment'

    def test_static_files_are_unchanged(self, storages):
        assert storages['staticfiles'] == {'BACKEND': STATICFILES_BACKEND, 'OPTIONS': {}}

    def test_an_explicit_filesystem_choice_is_honored_locally(self):
        storages = _storages(
            'local', {**LOCAL, **R2_ENV, 'ATTACHMENTS_STORAGE_BACKEND': FILESYSTEM_BACKEND}
        )

        assert storages['attachments']['BACKEND'] == FILESYSTEM_BACKEND


class TestMisconfiguredR2IsRefused:
    @pytest.mark.parametrize('missing', ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'])
    def test_half_a_credential_pair(self, missing):
        stderr = _refused('local', {**LOCAL, **R2_ENV, missing: ''})

        assert missing in stderr

    @pytest.mark.parametrize('missing', ['R2_BUCKET_NAME', 'R2_ENDPOINT_URL'])
    def test_credentials_without_a_bucket_or_endpoint(self, missing):
        stderr = _refused('local', {**LOCAL, **R2_ENV, missing: ''})

        assert missing in stderr

    @pytest.mark.parametrize(
        'endpoint',
        [
            'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
            'http://abc123.r2.cloudflarestorage.com',
            'https://abc123.r2.cloudflarestorage.com/mustanet-automation',
            'abc123.r2.cloudflarestorage.com',
        ],
    )
    def test_a_malformed_endpoint(self, endpoint):
        stderr = _refused('local', {**LOCAL, **R2_ENV, 'R2_ENDPOINT_URL': endpoint})

        assert 'R2_ENDPOINT_URL' in stderr

    def test_choosing_the_s3_backend_without_r2_credentials(self):
        stderr = _refused(
            'local', {**LOCAL, **NO_R2_ENV, 'ATTACHMENTS_STORAGE_BACKEND': S3_BACKEND}
        )

        assert 'R2_ACCESS_KEY_ID' in stderr


class TestProductionRequiresR2:
    def test_the_valid_production_configuration_uses_r2(self):
        storages = _storages('production', {})

        assert storages['attachments']['BACKEND'] == S3_BACKEND
        assert storages['default']['BACKEND'] == S3_BACKEND
        assert storages['staticfiles']['BACKEND'] == STATICFILES_BACKEND

    def test_production_without_r2_is_refused(self):
        stderr = _refused('production', NO_R2_ENV)

        assert 'R2_ACCESS_KEY_ID' in stderr

    def test_production_refuses_the_local_filesystem(self):
        stderr = _refused('production', {'ATTACHMENTS_STORAGE_BACKEND': FILESYSTEM_BACKEND})

        assert 'ATTACHMENTS_STORAGE_BACKEND' in stderr
