"""
Uploaded files on Cloudflare R2, end to end.

The same uploads, downloads and deletes the filesystem suites cover, run
against the real `storages.backends.s3.S3Storage` with the exact options
`config.settings.base.r2_storage_options` builds - so the R2 configuration
itself is under test, not a stand-in. The bucket is `r2_bucket`
(ideas/tests/conftest.py): `moto` answering the S3 API in-process, at an
endpoint that can never resolve.

Beyond "it still works on R2", this pins what the S3 backend changes:

- botocore's exceptions are not `OSError`, so every storage call site has to
  treat them as a storage failure (`ideas.storage.STORAGE_ERRORS`) rather
  than let them escape as a 500 - or, on delete, after the row is gone.
- The object's stored metadata is the server's decision (content type from
  the server-generated key, `Content-Disposition: attachment`), never the
  uploading browser's `Content-Type`.
- Any URL the storage can generate is a short-lived SigV4 signature, and none
  ever reaches an API response.
"""

import json
from io import StringIO
from unittest import mock

import pytest
from botocore.exceptions import ClientError
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import CommandError, call_command

from config.settings.base import R2_STORAGE_BACKEND
from ideas import storage
from ideas.models import Attachment
from ideas.tests import test_attachment_views as attachment_views
from ideas.tests.conftest import (
    R2_ACCESS_KEY,
    R2_BUCKET,
    R2_ENDPOINT,
    R2_SECRET_KEY,
    r2_object_keys,
)
from ideas.tests.test_attachment_views import (
    PDF_BYTES,
    auth_headers,
    download,
    make_idea,
    sign_in,
    upload_pdf,
)
from identity.models import User

PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 64

DELETE_ATTACHMENT = """
mutation DeleteAttachment($id: ID!) {
  deleteAttachment(id: $id) { success message field }
}
"""

# The same accounts and organizations as the filesystem upload suite.
world = attachment_views.world


def client_error(code: str, status: int) -> ClientError:
    return ClientError(
        {'Error': {'Code': code, 'Message': code}, 'ResponseMetadata': {'HTTPStatusCode': status}},
        'Operation',
    )


@pytest.mark.django_db
class TestAttachmentsOnR2:
    def test_an_upload_lands_in_the_bucket_under_a_server_generated_key(
        self, client, world, r2_bucket
    ):
        idea = make_idea(world['organization'], world['author'])

        response = upload_pdf(client, idea.pk, world['author_token'], filename='../../x.pdf')

        assert response.status_code == 201, response.content
        attachment = Attachment.objects.get(idea=idea)
        assert r2_object_keys(r2_bucket) == [attachment.storage_key]
        prefix, name = attachment.storage_key.rsplit('/', 1)
        assert prefix == f'ideas/{idea.pk}'
        assert len(name) == len('0' * 32 + '.pdf')
        # Metadata in PostgreSQL; bytes only in the bucket.
        assert (attachment.filename, attachment.content_type, attachment.size) == (
            'x.pdf',
            'application/pdf',
            len(PDF_BYTES),
        )
        stored = r2_bucket.get_object(Bucket=R2_BUCKET, Key=attachment.storage_key)
        assert stored['Body'].read() == PDF_BYTES

    def test_the_stored_object_carries_server_metadata_not_the_browsers_claim(
        self, client, world, r2_bucket
    ):
        idea = make_idea(world['organization'], world['author'])
        upload = SimpleUploadedFile('evidence.pdf', PDF_BYTES, content_type='text/html')

        response = client.post(
            f'/ideas/{idea.pk}/attachments/',
            data={'file': upload},
            **auth_headers(world['author_token']),
        )

        assert response.status_code == 201, response.content
        key = Attachment.objects.get(idea=idea).storage_key
        head = r2_bucket.head_object(Bucket=R2_BUCKET, Key=key)
        assert head['ContentType'] == 'application/pdf'
        assert head['ContentDisposition'] == 'attachment'

    def test_no_bucket_detail_or_credential_reaches_the_api_response(
        self, client, world, r2_bucket
    ):
        idea = make_idea(world['organization'], world['author'])

        body = upload_pdf(client, idea.pk, world['author_token']).content.decode()

        for leak in (
            R2_ENDPOINT,
            'cloudflarestorage',
            R2_BUCKET,
            'X-Amz',
            R2_ACCESS_KEY,
            R2_SECRET_KEY,
        ):
            assert leak not in body
        download_url = json.loads(body)['attachment']['downloadUrl']
        assert download_url.startswith(f'/ideas/{idea.pk}/attachments/')

    def test_two_uploads_of_the_same_file_never_overwrite_each_other(
        self, client, world, r2_bucket
    ):
        idea = make_idea(world['organization'], world['author'])

        upload_pdf(client, idea.pk, world['author_token'])
        upload_pdf(client, idea.pk, world['author_token'])

        keys = set(Attachment.objects.filter(idea=idea).values_list('storage_key', flat=True))
        assert len(keys) == 2
        assert set(r2_object_keys(r2_bucket)) == keys

    def test_an_existing_key_is_never_overwritten_by_the_storage_itself(self, r2_bucket):
        first = storage.save_object('ideas/1/fixed.pdf', ContentFile(b'%PDF-first'))
        second = storage.save_object('ideas/1/fixed.pdf', ContentFile(b'%PDF-second'))

        assert first == 'ideas/1/fixed.pdf'
        assert second != first
        assert r2_bucket.get_object(Bucket=R2_BUCKET, Key=first)['Body'].read() == b'%PDF-first'

    def test_the_author_downloads_the_original_bytes(self, client, world, r2_bucket):
        idea = make_idea(world['organization'], world['author'])
        attachment_id = upload_pdf(client, idea.pk, world['author_token']).json()['attachment'][
            'id'
        ]

        response = download(client, idea.pk, attachment_id, world['colleague_token'])

        assert response.status_code == 200
        assert b''.join(response.streaming_content) == PDF_BYTES
        assert response['Content-Type'] == 'application/pdf'
        assert response['Content-Disposition'].startswith('attachment;')

    def test_outsiders_and_anonymous_callers_cannot_download(self, client, world, r2_bucket):
        idea = make_idea(world['organization'], world['author'])
        attachment_id = upload_pdf(client, idea.pk, world['author_token']).json()['attachment'][
            'id'
        ]

        assert download(client, idea.pk, attachment_id, world['outsider_token']).status_code == 404
        assert download(client, idea.pk, attachment_id, None).status_code == 404

    def test_an_outsider_cannot_upload_and_nothing_reaches_the_bucket(
        self, client, world, r2_bucket
    ):
        idea = make_idea(world['organization'], world['author'])

        response = upload_pdf(client, idea.pk, world['outsider_token'])

        assert response.status_code in (403, 404)
        assert r2_object_keys(r2_bucket) == []

    def test_a_rejected_file_never_reaches_the_bucket(self, client, world, r2_bucket):
        idea = make_idea(world['organization'], world['author'])

        response = upload_pdf(
            client, idea.pk, world['author_token'], filename='x.pdf', content=b'MZ\x90\x00'
        )

        assert response.status_code == 400
        assert r2_object_keys(r2_bucket) == []

    def test_deleting_an_attachment_removes_its_object(self, client, world, r2_bucket):
        idea = make_idea(world['organization'], world['author'])
        attachment_id = upload_pdf(client, idea.pk, world['author_token']).json()['attachment'][
            'id'
        ]

        result = self._delete(client, attachment_id, world['author_token'])

        assert result['success'] is True
        assert not Attachment.objects.filter(pk=attachment_id).exists()
        assert r2_object_keys(r2_bucket) == []

    def test_another_user_cannot_delete_the_object(self, client, world, r2_bucket):
        idea = make_idea(world['organization'], world['author'])
        attachment_id = upload_pdf(client, idea.pk, world['author_token']).json()['attachment'][
            'id'
        ]

        for token in (world['colleague_token'], world['outsider_token']):
            assert self._delete(client, attachment_id, token)['success'] is False

        assert Attachment.objects.filter(pk=attachment_id).exists()
        assert len(r2_object_keys(r2_bucket)) == 1

    @staticmethod
    def _delete(client, attachment_id, token):
        response = client.post(
            '/graphql/',
            data=json.dumps({'query': DELETE_ATTACHMENT, 'variables': {'id': attachment_id}}),
            content_type='application/json',
            **auth_headers(token),
        )
        return response.json()['data']['deleteAttachment']


@pytest.mark.django_db
class TestR2Failures:
    def test_an_unreachable_bucket_is_a_502_and_records_nothing(self, client, world, r2_bucket):
        idea = make_idea(world['organization'], world['author'])
        r2_bucket.delete_bucket(Bucket=R2_BUCKET)

        response = upload_pdf(client, idea.pk, world['author_token'])

        assert response.status_code == 502
        assert not Attachment.objects.filter(idea=idea).exists()

    def test_a_failed_download_is_a_502_not_a_crash(self, client, world, r2_bucket):
        idea = make_idea(world['organization'], world['author'])
        attachment_id = upload_pdf(client, idea.pk, world['author_token']).json()['attachment'][
            'id'
        ]

        with mock.patch(
            'storages.backends.s3.S3Storage._open', side_effect=client_error('AccessDenied', 403)
        ):
            response = download(client, idea.pk, attachment_id, world['author_token'])

        assert response.status_code == 502

    def test_a_missing_object_is_a_404(self, client, world, r2_bucket):
        idea = make_idea(world['organization'], world['author'])
        attachment = upload_pdf(client, idea.pk, world['author_token']).json()['attachment']
        r2_bucket.delete_object(Bucket=R2_BUCKET, Key=r2_object_keys(r2_bucket)[0])

        assert download(client, idea.pk, attachment['id'], world['author_token']).status_code == 404

    def test_a_failed_object_delete_still_deletes_the_attachment(
        self, client, world, r2_bucket, caplog
    ):
        idea = make_idea(world['organization'], world['author'])
        attachment_id = upload_pdf(client, idea.pk, world['author_token']).json()['attachment'][
            'id'
        ]

        with mock.patch(
            'storages.backends.s3.S3Storage.delete', side_effect=client_error('AccessDenied', 403)
        ):
            result = TestAttachmentsOnR2._delete(client, attachment_id, world['author_token'])

        assert result['success'] is True
        assert not Attachment.objects.filter(pk=attachment_id).exists()
        assert 'Could not delete attachment object' in caplog.text


class TestSignedUrls:
    def test_any_generated_url_is_a_short_lived_sigv4_signature(self, r2_bucket):
        url = storage.attachment_storage().url('ideas/1/abc.pdf')

        assert url.startswith(f'{R2_ENDPOINT}/{R2_BUCKET}/ideas/1/abc.pdf?')
        assert 'X-Amz-Algorithm=AWS4-HMAC-SHA256' in url
        assert '%2Fauto%2Fs3%2Faws4_request' in url
        assert 'X-Amz-Expires=300' in url
        assert R2_SECRET_KEY not in url


@pytest.mark.django_db
class TestProfilePhotosOnR2:
    @pytest.fixture
    def member(self, client):
        user = User.objects.create_user(
            email='photo@example.com',
            password='a-strong-unique-pass-1',
            first_name='Ada',
            last_name='Lovelace',
            phone_number='+255712345678',
        )
        return user, sign_in(client, user)

    def test_a_photo_is_stored_served_and_removed(self, client, member, r2_bucket):
        user, token = member
        response = client.post(
            '/account/avatar/',
            {'file': SimpleUploadedFile('me.png', PNG)},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        assert response.status_code == 200, response.content
        user.refresh_from_db()
        assert user.avatar_key.startswith(f'avatars/{user.pk}/')
        assert r2_object_keys(r2_bucket) == [user.avatar_key]

        url = response.json()['user']['avatarUrl']
        served = client.get(url, HTTP_AUTHORIZATION=f'Bearer {token}')
        assert served.status_code == 200
        assert b''.join(served.streaming_content) == PNG

        client.delete('/account/avatar/', HTTP_AUTHORIZATION=f'Bearer {token}')
        assert r2_object_keys(r2_bucket) == []

    def test_an_unreachable_bucket_refuses_the_photo_cleanly(self, client, member, r2_bucket):
        user, token = member
        r2_bucket.delete_bucket(Bucket=R2_BUCKET)

        response = client.post(
            '/account/avatar/',
            {'file': SimpleUploadedFile('me.png', PNG)},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )

        assert response.status_code == 400
        user.refresh_from_db()
        assert user.avatar_key == ''


class TestR2CheckCommand:
    def test_a_probe_object_is_written_read_back_and_deleted(self, r2_bucket, settings):
        settings.ATTACHMENTS_STORAGE_BACKEND = R2_STORAGE_BACKEND
        out = StringIO()

        call_command('r2_check', stdout=out)

        assert 'Deleted r2-check/' in out.getvalue()
        assert r2_object_keys(r2_bucket) == []
        for secret in (R2_ACCESS_KEY, R2_SECRET_KEY):
            assert secret not in out.getvalue()

    def test_it_refuses_when_r2_is_not_configured(self):
        with pytest.raises(CommandError, match='R2 is not configured'):
            call_command('r2_check')
