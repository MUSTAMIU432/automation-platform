"""
AI drafts for the proposal's sections.

A writer asks for a first draft of one section; Gemini writes it from the idea (its
description and problem story) and from whatever the team has already written in the
other sections. The draft goes back to the writer's editor and nothing is saved here: the
writer reads it, changes it, and saves it with the rest of the form like anything they
typed, so every word in a proposal is still one a writer chose to keep.

Only someone who may edit the proposal may ask (`proposals._require_writer` and the same
editable states as `proposals.update_proposal`). The idea's text goes to Google to do it.
"""

from ai import gemini
from ideas.models import IDEA_STORY_FIELDS, Idea
from identity.models import User
from reviews import proposals
from reviews.models import IdeaProposal

#: What each section is for, told to the model the way the editor tells the writer.
SECTION_BRIEFS = {
    'title': 'A short name for the work, as the owner will see it. One line, no quotes.',
    'executive_summary': (
        'The whole proposal in a few sentences: what will be built, why, and what it takes.'
    ),
    'problem': 'What goes wrong today, who it affects and what it costs them.',
    'feasibility': 'Whether this can be built, and what it depends on.',
    'proposed_solution': 'What will be built and how it solves the problem.',
    'requirements_summary': 'What the solution needs: systems, data, access and people.',
    'scope': 'What is included, and just as clearly, what is not.',
    'deliverables': 'What the owner receives at the end.',
    'estimated_timeline': (
        'How long the work takes from start to finish - lead with the total, such as '
        '"8 weeks" - and briefly why.'
    ),
    'milestones': 'The stages of the work and when each is reached.',
    'estimated_effort': (
        'The effort involved - lead with the total, such as "2 developers for 6 weeks" - '
        'and what it is spent on.'
    ),
    'financial_requirements': 'What the work costs, and what that money pays for.',
    'payment_plan': 'How much the owner pays and when, for example by milestone.',
    'risks': 'What could go wrong, and how each risk will be handled.',
    'assumptions': 'What this proposal takes for granted.',
    'acceptance_criteria': 'How everyone will know the work is done and working.',
}

_LABELS = {field: field.replace('_', ' ').capitalize() for field in proposals.FIELDS}
_LABELS['requirements_summary'] = 'Requirements'
_LABELS['estimated_timeline'] = 'Overall timeline'
_LABELS['milestones'] = 'Timeline and milestones'

#: Sections that are one line in the editor; their drafts come back as one line.
_ONE_LINE = frozenset({'title'})

#: How much of any one piece of context is passed on, so one huge field cannot crowd out the rest.
_CONTEXT_LIMIT = 4000

SYSTEM = """You are drafting one section of a project proposal on an internal automation \
platform. A review team approved an idea from someone in the organization, and is now \
writing the proposal: what the platform would build for them, what it needs, how long it \
takes, what it costs and how it will be judged done.

Write only the body of the section you are asked for:
- Plain text. No Markdown headings, no bold, no title line, no preamble or sign-off.
- Short paragraphs, or lines starting with "- " where a list reads better.
- Be specific to this idea; build on what the team has already written and do not \
contradict it.
- Never invent figures, prices, dates or names that the material does not give. Where one \
is needed, write a sensible placeholder in square brackets, such as [cost to confirm]."""


def _clip(text: str) -> str:
    text = text.strip()
    return text if len(text) <= _CONTEXT_LIMIT else text[:_CONTEXT_LIMIT] + ' […]'


def _story(idea: Idea) -> list[str]:
    lines = []
    for field in IDEA_STORY_FIELDS:
        value = getattr(idea, field, None)
        if isinstance(value, list | tuple):
            value = ', '.join(str(v) for v in value if v)
        if value in (None, ''):
            continue
        lines.append(f'{field.replace("_", " ").capitalize()}: {_clip(str(value))}')
    return lines


#: The most of the writer's own instructions passed on.
INSTRUCTIONS_LIMIT = 2000


def _prompt(idea: Idea, section: str, written: dict[str, str], instructions: str = '') -> str:
    parts = [f'THE IDEA\nTitle: {idea.title}\nDescription: {_clip(idea.description)}']
    story = _story(idea)
    if story:
        parts.append("THE OWNER'S ACCOUNT OF THE PROBLEM\n" + '\n'.join(story))
    others = [
        f'{_LABELS[field]}:\n{_clip(text)}'
        for field, text in written.items()
        if field != section and field in _LABELS and text.strip()
    ]
    if others:
        parts.append('WHAT THE TEAM HAS WRITTEN SO FAR\n\n' + '\n\n'.join(others))
    length = (
        ' Answer in one short line.'
        if section in _ONE_LINE
        else ' Aim for roughly 80 to 250 words.'
    )
    if instructions.strip():
        parts.append(
            "THE WRITER'S INSTRUCTIONS FOR THIS SECTION (follow them unless they ask you to "
            'invent facts)\n' + instructions.strip()[:INSTRUCTIONS_LIMIT]
        )
    parts.append(f'NOW WRITE THE SECTION "{_LABELS[section]}"\n{SECTION_BRIEFS[section]}{length}')
    return '\n\n'.join(parts)


def draft_section(
    user: User | None, idea_id: object, section: str, written: dict, instructions: str = ''
) -> str:
    """A first draft of `section` for the writer's editor, steered by their `instructions`.

    Nothing is saved: the draft is shown beside the writer's own text, which changes only if
    they choose to use it.
    """
    if section not in SECTION_BRIEFS:
        raise proposals.ProposalError('That section cannot be drafted.', field=section)
    idea = Idea.objects.filter(pk=proposals._as_int(idea_id)).first()
    if idea is None:
        raise proposals.ProposalError(proposals.UNAVAILABLE)
    proposals._require_writer(user, idea)
    proposal = IdeaProposal.objects.filter(idea=idea).first()
    if proposal is None:
        raise proposals.ProposalError('There is no proposal for this idea yet.')
    if proposal.status not in proposals._EDITABLE:
        raise proposals.ProposalError('This proposal can no longer be edited.')

    # The editor's unsaved text where it sent some, the saved proposal for the rest.
    current = {field: getattr(proposal, field) for field in proposals.FIELDS}
    current.update({k: v for k, v in written.items() if k in current and isinstance(v, str)})

    try:
        text = gemini.generate_text(
            _prompt(idea, section, current, instructions or ''), system=SYSTEM
        )
    except gemini.GeminiError as exc:
        raise proposals.ProposalError(exc.message, field=section) from None

    text = text.strip()
    if section in _ONE_LINE and text:
        # A one-line field: keep the first line, without wrapping quotes.
        text = text.splitlines()[0].strip().strip('"“”')
    return text
