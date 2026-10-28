from django.core.management.base import BaseCommand, CommandError

from learning.content import CONTENT_ROOT, ContentError, read_course, sync_course
from learning.models import Course

COURSE_DIRECTORY = CONTENT_ROOT / 'python'


class Command(BaseCommand):
    help = (
        'Load "Python Programming: Beginner to Advanced" from learning/content/python/ as a '
        'starting point. Once loaded, administrators own the course and edit it in the '
        'console, so running this again changes nothing unless --overwrite is given.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--publish',
            action='store_true',
            help='Publish the course (a new course is otherwise a draft only managers see).',
        )
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help="Reload an existing course from the files, replacing administrators' edits "
            'to the same lessons (learner progress on lessons that remain is kept).',
        )
        parser.add_argument(
            '--prune',
            action='store_true',
            help='Delete modules, lessons and exercises no longer in the files, '
            'with any learner progress on them.',
        )

    def handle(
        self, *args, publish: bool = False, overwrite: bool = False, prune: bool = False, **options
    ):
        try:
            slug = read_course(COURSE_DIRECTORY).course['slug']
            existing = Course.objects.filter(slug=slug).first()
            if existing is not None and not overwrite:
                self.stdout.write(
                    f'{existing.title} is already loaded and is managed in the administration '
                    'console. Nothing was changed (use --overwrite to reload it from the files).'
                )
                return
            report = sync_course(COURSE_DIRECTORY, publish=publish, prune=prune)
        except ContentError as exc:
            raise CommandError(f'Nothing was changed. {exc}') from None

        course = report.course
        self.stdout.write(
            self.style.SUCCESS(
                f'{course.title} ({course.get_status_display().lower()}): {report.modules} '
                f'modules, {report.lessons} lessons, {report.exercises} exercises, '
                f'{report.questions} quiz questions.'
            )
        )
        for item in report.kept:
            self.stdout.write(f'Kept, no longer in the files: {item} (use --prune to delete)')
        for item in report.pruned:
            self.stdout.write(self.style.WARNING(f'Deleted: {item}'))
