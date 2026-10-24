from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ai import gemini


class Command(BaseCommand):
    help = (
        'Check the Gemini configuration with one real request: a short text answer, and '
        'with --image a picture saved to the given file. Never prints the API key.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--image',
            metavar='PATH',
            help='Also generate a test image and save it to PATH.',
        )

    def handle(self, *args, image: str | None = None, **options):
        try:
            answer = gemini.generate_text('Reply with exactly: ok')
        except gemini.GeminiError as exc:
            raise CommandError(f'Text ({settings.GEMINI_TEXT_MODEL}): {exc.message}') from None
        self.stdout.write(
            self.style.SUCCESS(f'Text ({settings.GEMINI_TEXT_MODEL}): {answer.strip()!r}')
        )

        if image:
            try:
                picture = gemini.generate_image('A simple flat icon of a green gear on white.')
            except gemini.GeminiError as exc:
                raise CommandError(
                    f'Image ({settings.GEMINI_IMAGE_MODEL}): {exc.message}'
                ) from None
            Path(image).write_bytes(picture.data)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Image ({settings.GEMINI_IMAGE_MODEL}): {picture.mime_type}, '
                    f'{len(picture.data)} bytes saved to {image}'
                )
            )
