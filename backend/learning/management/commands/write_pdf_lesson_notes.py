from django.core.management.base import BaseCommand

from ideas import storage
from learning.authoring import lesson_has_notes, write_notes_from_pdf
from learning.models import Lesson


class Command(BaseCommand):
    help = (
        'Give every lesson that has no notes but has a PDF attached the notes in that PDF - '
        'for lessons uploaded before uploads did it themselves. Lessons with notes are never '
        'touched, so this is safe to run at any time.'
    )

    def handle(self, *args, **options):
        lessons = (
            Lesson.objects.filter(materials__content_type='application/pdf')
            .distinct()
            .order_by('pk')
        )
        written = skipped = 0
        for lesson in lessons:
            if lesson_has_notes(lesson):
                continue
            material = lesson.materials.filter(content_type='application/pdf').first()
            try:
                with storage.open_object(material.storage_key) as handle:
                    data = handle.read()
            except (FileNotFoundError, storage.AttachmentStorageError) as exc:
                self.stdout.write(f'Skipped "{lesson.title}": its PDF could not be read ({exc}).')
                skipped += 1
                continue
            if write_notes_from_pdf(lesson, data):
                self.stdout.write(f'Wrote notes for "{lesson.title}" from {material.filename}.')
                written += 1
            else:
                self.stdout.write(
                    f'Skipped "{lesson.title}": {material.filename} has no readable text '
                    '(a scan?), so the lesson keeps the file only.'
                )
                skipped += 1
        self.stdout.write(
            self.style.SUCCESS(f'PDF lesson notes: {written} written, {skipped} skipped.')
        )
