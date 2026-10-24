"""
The proposal's one HTTP surface beyond GraphQL: the platform admin's PDF download.

A PDF is bytes, which do not travel through GraphQL, so this is a plain view like the
attachment downloads - and like them it authenticates with the bearer token, never a cookie,
so a link on another site cannot trigger it. Only someone who may release proposals
downloads one; every download is in the administrative audit trail before the file is sent.
A 404 answers every refusal, so the endpoint says nothing about which proposals exist.
"""

from django.http import HttpRequest, HttpResponse
from django.views.decorators.http import require_http_methods

from administration import authorization as admin_authorization
from administration import services as admin_services
from administration.models import AdminAuditEntry
from identity.authentication import get_authenticated_user
from reviews import proposal_pdf
from reviews.models import IdeaProposal


@require_http_methods(['GET'])
def admin_proposal_pdf_view(request: HttpRequest, idea_id: int) -> HttpResponse:
    """`GET /administration/proposals/<idea_id>/pdf/`."""
    user = get_authenticated_user(request)
    if user is None or not admin_authorization.capabilities_for(user).can_release_proposals:
        return HttpResponse(status=404)
    proposal = IdeaProposal.objects.select_related('idea', 'team').filter(idea_id=idea_id).first()
    if proposal is None:
        return HttpResponse(status=404)

    admin_services.record_event(
        user,
        AdminAuditEntry.Action.PROPOSAL_DOWNLOADED,
        'idea',
        proposal.idea_id,
        proposal.title[:255],  # the audit label is a snapshot; the proposal keeps the rest
        metadata={'status': proposal.status},
    )
    response = HttpResponse(proposal_pdf.build_pdf(proposal, user), content_type='application/pdf')
    response['Content-Disposition'] = (
        f'attachment; filename="{proposal_pdf.filename_for(proposal)}"'
    )
    response['X-Content-Type-Options'] = 'nosniff'
    response['Cache-Control'] = 'no-store'
    return response
