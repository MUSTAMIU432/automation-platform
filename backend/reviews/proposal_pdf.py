"""
A proposal as a PDF, for the platform admin.

Built on the server (ReportLab) from the stored proposal, never from anything the browser
sends, and stamped for the person who downloads it: their name, email and the time run
diagonally across every page and along its foot, so a copy that travels further still says
whose it was. The text is the writers' own, escaped - nothing in a proposal is ever read as
markup.
"""

from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from identity.models import User
from reviews.models import IdeaProposal

#: The sections in the order the editor and the reading page show them.
SECTIONS = (
    ('executive_summary', 'Executive summary'),
    ('problem', 'Problem'),
    ('feasibility', 'Feasibility'),
    ('proposed_solution', 'Proposed solution'),
    ('requirements_summary', 'Requirements'),
    ('scope', 'Scope'),
    ('deliverables', 'Deliverables'),
    ('estimated_timeline', 'Overall timeline'),
    ('milestones', 'Timeline and milestones'),
    ('estimated_effort', 'Estimated effort'),
    ('financial_requirements', 'Financial requirements'),
    ('payment_required', 'Does the owner pay?'),
    ('payment_plan', 'Payment plan'),
    ('risks', 'Risks'),
    ('assumptions', 'Assumptions'),
    ('acceptance_criteria', 'Acceptance criteria'),
)
PAYMENT_WORDS = {'yes': 'Yes - the owner pays', 'no': 'No - no charge to the owner'}
STATUS_WORDS = {
    'draft': 'Being written by the review team',
    'submitted': 'With the platform admin',
    'changes_requested': 'Sent back to the review team',
    'released': 'Released to the owner',
    'declined': 'Declined',
}

BRAND = colors.HexColor('#166146')
INK = colors.HexColor('#111827')
MUTED = colors.HexColor('#6b7280')

_KICKER = ParagraphStyle(
    'kicker', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=BRAND, spaceAfter=4
)
_TITLE = ParagraphStyle(
    'title', fontName='Helvetica-Bold', fontSize=22, leading=27, textColor=INK, spaceAfter=10
)
_HEADING = ParagraphStyle(
    'heading',
    fontName='Helvetica-Bold',
    fontSize=12,
    leading=15,
    textColor=BRAND,
    spaceBefore=14,
    spaceAfter=5,
)
_BODY = ParagraphStyle('body', fontName='Helvetica', fontSize=10, leading=15, textColor=INK)
_META = ParagraphStyle('meta', fontName='Helvetica', fontSize=9, leading=12, textColor=INK)
_META_LABEL = ParagraphStyle(
    'meta-label', fontName='Helvetica-Bold', fontSize=8, leading=12, textColor=MUTED
)


def _text(value: str) -> str:
    """The writer's text, safe for a ReportLab paragraph, with its line breaks kept."""
    return escape(value.strip()).replace('\n', '<br/>')


def filename_for(proposal: IdeaProposal) -> str:
    stem = ''.join(c if c.isalnum() else '-' for c in proposal.title.lower()).strip('-')
    stem = '-'.join(part for part in stem.split('-') if part)[:60] or 'proposal'
    return f'proposal-{proposal.idea_id}-{stem}.pdf'


def _facts(proposal: IdeaProposal) -> Table:
    """The box under the title: which idea, which team, where the proposal stands."""
    facts = [
        ('Idea', proposal.idea.title),
        ('Review team', proposal.team.name if proposal.team_id else '-'),
        ('Status', STATUS_WORDS.get(proposal.status, proposal.status)),
    ]
    if proposal.planned_start or proposal.planned_end:
        start = f'{proposal.planned_start:%d %b %Y}' if proposal.planned_start else 'to confirm'
        end = f'{proposal.planned_end:%d %b %Y}' if proposal.planned_end else 'to confirm'
        facts.append(('Planned dates', f'{start} to {end}'))
    if proposal.estimated_timeline.strip():
        facts.append(('Overall timeline', proposal.estimated_timeline.strip().splitlines()[0]))
    if proposal.submitted_at:
        facts.append(('Sent to the admin', f'{timezone.localtime(proposal.submitted_at):%d %b %Y}'))
    if proposal.decided_at:
        facts.append(('Decided', f'{timezone.localtime(proposal.decided_at):%d %b %Y}'))
    table = Table(
        [
            [Paragraph(label.upper(), _META_LABEL), Paragraph(escape(value), _META)]
            for label, value in facts
        ],
        colWidths=[38 * mm, None],
    )
    table.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f3f4f6')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _sections(proposal: IdeaProposal) -> list:
    """Every written section, headed; the payment plan only when the owner pays."""
    flowables = []
    for field, label in SECTIONS:
        if field == 'payment_plan' and proposal.payment_required != 'yes':
            continue
        value = getattr(proposal, field) or ''
        if field == 'payment_required':
            value = PAYMENT_WORDS.get(value, value)
        if value.strip():
            flowables += [Paragraph(label, _HEADING), Paragraph(_text(value), _BODY)]
    return flowables or [Paragraph('Nothing has been written yet.', _BODY)]


def build_pdf(proposal: IdeaProposal, reader: User, at=None) -> bytes:
    at = timezone.localtime(at or timezone.now())
    who = reader.get_full_name() or reader.email
    stamp = f'{who} · {reader.email} · {at:%d %b %Y %H:%M}'

    def decorate(canvas, doc):
        canvas.saveState()
        # The watermark: the reader's stamp, diagonally, repeated over the whole page.
        canvas.setFont('Helvetica', 11)
        canvas.setFillColor(colors.Color(0.07, 0.09, 0.15, alpha=0.08))
        width, height = A4
        for row in range(-2, 9):
            for column in range(-1, 3):
                canvas.saveState()
                canvas.translate(column * 95 * mm + (row % 2) * 45 * mm, row * 38 * mm)
                canvas.rotate(28)
                canvas.drawString(0, 0, f'CONFIDENTIAL · {stamp}')
                canvas.restoreState()
        # The foot: who downloaded it, and the page.
        canvas.setFillColor(MUTED)
        canvas.setFont('Helvetica', 7.5)
        canvas.drawString(18 * mm, 10 * mm, f'Downloaded by {stamp}. Do not share.')
        canvas.drawRightString(width - 18 * mm, 10 * mm, f'Page {doc.page}')
        canvas.setStrokeColor(BRAND)
        canvas.setLineWidth(2)
        canvas.line(0, height - 1, width, height - 1)
        canvas.restoreState()

    story = [
        Paragraph('PROPOSAL', _KICKER),
        Paragraph(_text(proposal.title), _TITLE),
        _facts(proposal),
        Spacer(1, 4 * mm),
        *_sections(proposal),
    ]

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title=proposal.title,
        author='Automation Platform',
        subject=f'Proposal - downloaded by {reader.email}',
    ).build(story, onFirstPage=decorate, onLaterPages=decorate)
    return buffer.getvalue()
