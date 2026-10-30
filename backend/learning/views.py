"""
HTTP endpoints for lesson files - the one thing GraphQL does not carry.

The same shape as the idea attachment endpoints (`ideas/views.py`), for the same
reasons: authenticated by the bearer token, authorized before the body is read,
and downloads streamed through `stored_file_response`, which forces a download
with the server's own content type. The bucket stays private - there is never a
direct link to it.
"""

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ideas.views import stored_file_response
from identity.authentication import get_authenticated_user
from learning import authoring
from learning.models import LessonMaterial
from learning.services import LearningError

_STATUS_BY_REASON = {
    'unauthenticated': 401,
    'forbidden': 403,
    'not_found': 404,
    'storage_unavailable': 502,
}


def material_json(material: LessonMaterial) -> dict:
    return {
        'id': str(material.pk),
        'title': material.title,
        'filename': material.filename,
        'contentType': material.content_type,
        'size': material.size,
        'createdAt': material.created_at.isoformat(),
        'downloadUrl': f'/learning/materials/{material.pk}/download/',
    }


def _error(exc: LearningError) -> JsonResponse:
    status = 400 if exc.field is not None else _STATUS_BY_REASON.get(exc.reason, 400)
    return JsonResponse(
        {'success': False, 'message': exc.message, 'field': exc.field}, status=status
    )


@csrf_exempt  # Authorized by the bearer header, which a cross-site request cannot attach.
@require_http_methods(['POST'])
def upload_material_view(request: HttpRequest, lesson_id: int) -> HttpResponse:
    """`POST /learning/lessons/<id>/materials/`: multipart `file`, optional `title`."""
    user = get_authenticated_user(request)
    try:
        authoring.authorize_material_upload(user, lesson_id)
    except LearningError as exc:
        return _error(exc)

    uploaded = request.FILES.get('file')
    if uploaded is None:
        return JsonResponse(
            {'success': False, 'message': 'Choose a file to upload.', 'field': 'file'}, status=400
        )
    try:
        material = authoring.upload_material(
            user, lesson_id, uploaded, request.POST.get('title', '')
        )
    except LearningError as exc:
        return _error(exc)
    return JsonResponse(
        {
            'success': True,
            'message': 'File uploaded.',
            'field': None,
            'material': material_json(material),
            # A PDF on a lesson with no notes: its notes were made from it, into this
            # lesson and, for a whole course guide, the new lessons after it.
            'notesWritten': material.lessons_written > 0,
            'lessonsWritten': material.lessons_written,
        },
        status=201,
    )


@require_http_methods(['GET'])
def download_material_view(request: HttpRequest, material_id: int) -> HttpResponse:
    """
    `GET /learning/materials/<id>/download/`, for anybody who can open the lesson:
    an enrolled learner or a course manager. A 404 for every other case.
    """
    material = authoring.readable_material(get_authenticated_user(request), material_id)
    if material is None:
        return HttpResponse(status=404)
    return stored_file_response(
        material.storage_key, material.content_type, material.size, material.filename
    )
