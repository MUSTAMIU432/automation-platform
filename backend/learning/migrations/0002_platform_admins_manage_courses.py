from django.contrib.auth.management import create_permissions
from django.db import migrations

PLATFORM_ADMIN_GROUP = 'Platform administrators'


def grant_to_platform_administrators(apps, schema_editor):
    """
    Give an existing "Platform administrators" group `learning.change_course`, so the
    administrators already granted see Courses in the console without re-running
    `grant_platform_admin`. Permissions are normally created after migrating; this
    app's are created here first so the permission can be added.
    """
    app_config = apps.get_app_config('learning')
    # A migration's app registry holds stubs without `models_module`, which
    # `create_permissions` checks; the stub is set for the call and put back after.
    app_config.models_module = True
    create_permissions(app_config, apps=apps, verbosity=0)
    app_config.models_module = None
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    group = Group.objects.filter(name=PLATFORM_ADMIN_GROUP).first()
    permission = Permission.objects.filter(
        content_type__app_label='learning', codename='change_course'
    ).first()
    if group is not None and permission is not None:
        group.permissions.add(permission)


def take_back(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    group = Group.objects.filter(name=PLATFORM_ADMIN_GROUP).first()
    if group is not None:
        group.permissions.remove(
            *Permission.objects.filter(content_type__app_label='learning', codename='change_course')
        )


class Migration(migrations.Migration):

    dependencies = [
        ('learning', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
        ('contenttypes', '0002_remove_content_type_name'),
    ]

    operations = [
        migrations.RunPython(grant_to_platform_administrators, take_back),
    ]
