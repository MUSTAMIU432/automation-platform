import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from ideas import storage

_PROBE = b'r2_check probe - safe to delete'


class Command(BaseCommand):
    help = (
        'Check the Cloudflare R2 configuration with one real round trip: write a small probe '
        'object, read it back and delete it. Never prints a credential.'
    )

    def handle(self, *args, **options):
        if settings.ATTACHMENTS_STORAGE_BACKEND != settings.R2_STORAGE_BACKEND:
            raise CommandError(
                'R2 is not configured: uploaded files are using '
                f'{settings.ATTACHMENTS_STORAGE_BACKEND}. Set the four R2_* variables '
                '(see docs/environments.md).'
            )

        bucket = settings.STORAGES['attachments']['OPTIONS']['bucket_name']
        key = f'r2-check/{uuid.uuid4().hex}.txt'

        try:
            saved_key = storage.save_object(key, ContentFile(_PROBE))
        except storage.AttachmentStorageError as exc:
            raise CommandError(f'Write to bucket {bucket!r} failed: {exc}') from None
        self.stdout.write(self.style.SUCCESS(f'Wrote {saved_key} to bucket {bucket!r}'))

        try:
            with storage.open_object(saved_key) as handle:
                data = handle.read()
        except (FileNotFoundError, storage.AttachmentStorageError) as exc:
            raise CommandError(f'Read back {saved_key} failed: {exc}') from None
        if data != _PROBE:
            raise CommandError(f'Read back {saved_key} returned different bytes.')
        self.stdout.write(self.style.SUCCESS(f'Read {saved_key} back intact'))

        storage.delete_object(saved_key)
        if storage.attachment_storage().exists(saved_key):
            raise CommandError(f'{saved_key} is still in the bucket after deleting it.')
        self.stdout.write(self.style.SUCCESS(f'Deleted {saved_key}'))
