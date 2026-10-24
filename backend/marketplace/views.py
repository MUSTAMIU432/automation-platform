"""
The marketplace's HTTP surface beyond GraphQL: a market idea's document, as bytes, and the
payment gateway's callback.

For the document, `POST` (multipart, field `file`) uploads or replaces it and `DELETE`
removes it - both for administrators who manage the marketplace. `GET` downloads it, for
whoever may read the idea's documentation: a buyer whose payment is confirmed, or an
administrator. Like the
attachment views (`ideas/views.py`), every request authenticates with the bearer token,
never a cookie, so a link or form on another site cannot use it; and a 404 answers every
refusal to download, so the endpoint says nothing about which ideas have a document.
"""

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ideas.views import stored_file_response
from identity.authentication import get_authenticated_user
from marketplace import services
from marketplace.models import MarketIdea

_STATUS_BY_REASON = {'unauthenticated': 401, 'forbidden': 404, 'storage_unavailable': 502}


def document_json(idea: MarketIdea) -> dict | None:
    """The same fields as GraphQL's `MarketDocumentType`."""
    if not idea.document_key:
        return None
    return {
        'filename': idea.document_name,
        'contentType': idea.document_content_type,
        'size': idea.document_size,
        'uploadedAt': idea.document_uploaded_at.isoformat() if idea.document_uploaded_at else None,
        'downloadPath': document_path(idea.pk),
    }


def document_path(idea_id: int) -> str:
    return f'/marketplace/ideas/{idea_id}/document/'


def _refused(exc: services.MarketplaceError) -> JsonResponse:
    # A refusal about the file itself is a 400 whatever its reason; see `ideas.views`.
    status = 400 if exc.field is not None else _STATUS_BY_REASON.get(exc.reason, 400)
    return JsonResponse(
        {'success': False, 'message': exc.message, 'field': exc.field}, status=status
    )


def _ok(idea: MarketIdea, message: str) -> JsonResponse:
    return JsonResponse(
        {'success': True, 'message': message, 'field': None, 'document': document_json(idea)}
    )


@csrf_exempt  # Authorized by the bearer header, which a cross-site request cannot attach.
@require_http_methods(['GET', 'POST', 'DELETE'])
def document_view(request: HttpRequest, idea_id: int) -> HttpResponse:
    """`/marketplace/ideas/<idea_id>/document/`."""
    user = get_authenticated_user(request)

    if request.method == 'GET':
        idea = services.document_for(user, idea_id)
        if idea is None:
            return HttpResponse(status=404)
        response = stored_file_response(
            idea.document_key, idea.document_content_type, idea.document_size, idea.document_name
        )
        response['Cache-Control'] = 'no-store'
        return response

    if request.method == 'DELETE':
        try:
            idea = services.remove_document(user, idea_id)
        except services.MarketplaceError as exc:
            return _refused(exc)
        return _ok(idea, 'The document has been removed.')

    # Refuse a caller with no standing before reading the body at all.
    try:
        services.authorize_document_upload(user, idea_id)
    except services.MarketplaceError as exc:
        return _refused(exc)
    uploaded = request.FILES.get('file')
    if uploaded is None:
        return JsonResponse(
            {'success': False, 'message': 'Choose a document to upload.', 'field': 'document'},
            status=400,
        )
    try:
        idea = services.upload_document(user, idea_id, uploaded)
    except services.MarketplaceError as exc:
        return _refused(exc)
    return _ok(idea, 'The document has been uploaded.')


@csrf_exempt  # A server-to-server notification; the gateway adapter authenticates it.
@require_http_methods(['POST'])
def gateway_callback_view(request: HttpRequest) -> HttpResponse:
    """
    `POST /marketplace/gateway/callback/`: the payment gateway reporting how a phone prompt
    ended. Nobody is signed in here - `marketplace.gateways`' adapter verifies the request
    came from the gateway, and anything it cannot verify changes nothing.
    """
    if not services.handle_gateway_callback(request):
        return JsonResponse({'ok': False}, status=400)
    return JsonResponse({'ok': True})
