from django.core.management.base import BaseCommand

from ideas import storage
from learning.authoring import (
    lesson_has_notes,
    rebuild_first_converter_notes,
    write_notes_from_pdf,
)
from learning.models import Lesson


class Command(BaseCommand):
    help = (
        'Give every lesson with a PDF attached the notes in that PDF when it has none - for '
        'lessons uploaded before uploads did it themselves - and rebuild notes the first '
        'converter wrote that nobody has edited since (a course guide then becomes its '
        'lessons). Notes anybody wrote or edited are never touched, so this is safe to run '
        'at any time.'
    )

    def handle(self, *args, **options):
        lessons = (
            Lesson.objects.filter(materials__content_type='application/pdf')
            .distinct()
            .order_by('pk')
        )
        written = rebuilt = skipped = 0
        for lesson in lessons:
            material = lesson.materials.filter(content_type='application/pdf').first()
            had_notes = lesson_has_notes(lesson)
            try:
                with storage.open_object(material.storage_key) as handle:
                    data = handle.read()
            except (FileNotFoundError, storage.AttachmentStorageError) as exc:
                self.stdout.write(f'Skipped "{lesson.title}": its PDF could not be read ({exc}).')
                skipped += 1
                continue

            if had_notes:
                # Only the first converter's untouched notes; everything else is left alone.
                if count := rebuild_first_converter_notes(lesson, data):
                    self.stdout.write(
                        f'Rebuilt "{lesson.title}" from {material.filename}'
                        + (f', and {count - 1} lessons after it.' if count > 1 else '.')
                    )
                    rebuilt += 1
                continue

            if count := write_notes_from_pdf(lesson, data):
                self.stdout.write(
                    f'Wrote notes for "{lesson.title}" from {material.filename}'
                    + (f', and {count - 1} lessons after it.' if count > 1 else '.')
                )
                written += 1
            else:
                self.stdout.write(
                    f'Skipped "{lesson.title}": {material.filename} has no readable text '
                    '(a scan?), so the lesson keeps the file only.'
                )
                skipped += 1
        self.stdout.write(
            self.style.SUCCESS(
                f'PDF lesson notes: {written} written, {rebuilt} rebuilt, {skipped} skipped.'
            )
        )
