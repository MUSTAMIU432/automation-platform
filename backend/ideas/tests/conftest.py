"""
Fixtures shared by the Ideas test suites.

`r2_bucket`: a private, empty Cloudflare R2 bucket for one test, answered
in-process by `moto` and configured as both upload storages with the exact
options production uses (`config.settings.base.r2_storage_options`). The
endpoint is under `.invalid`, a name that can never resolve, so nothing can
reach Cloudflare even if the mock were bypassed.
"""

import boto3
import pytest
from django.core.files.storage import storages
from moto import mock_aws

from config.settings.base import R2_STORAGE_BACKEND, r2_storage_options

R2_ENDPOINT = 'https://test-account.r2.cloudflarestorage.invalid'
R2_BUCKET = 'test-bucket'
R2_ACCESS_KEY = 'test-access-key-id'
R2_SECRET_KEY = 'test-secret-access-key-never-shown'


def r2_object_keys(client) -> list[str]:
    return [item['Key'] for item in client.list_objects_v2(Bucket=R2_BUCKET).get('Contents', [])]


@pytest.fixture
def r2_bucket(settings, monkeypatch):
    """An S3 client on the bucket, which is both upload storages for this test."""
    # Read by moto the first time it routes an S3 request in this process.
    monkeypatch.setenv('MOTO_S3_CUSTOM_ENDPOINTS', R2_ENDPOINT)
    with mock_aws():
        client = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            region_name='auto',
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
        )
        client.create_bucket(
            Bucket=R2_BUCKET, CreateBucketConfiguration={'LocationConstraint': 'auto'}
        )
        r2 = {
            'BACKEND': R2_STORAGE_BACKEND,
            'OPTIONS': r2_storage_options(R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_ENDPOINT),
        }
        settings.STORAGES = {**settings.STORAGES, 'attachments': r2, 'default': r2}
        storages._storages.clear()
        yield client
    storages._storages.clear()
