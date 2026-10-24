"""
From assignment to approved implementation: the developer's plan and the stage approvals.

The delivery manager assigns a developer, which opens the project. The developer reads the
agreed proposal and writes the **implementation plan** - the technical approach and the stages
(the project's milestones) - and submits it. The manager approves it, which starts
implementation, or sends it back with feedback. As each stage is done the developer submits a
**stage report**; the manager approves it, completing the stage, or sends it back.

The same rules as `automation.delivery`: authenticated user in, ids in, everything re-asked
under a row lock, the change and its event in one transaction, people told afterwards. Only
the assigned developer (or a member of the assigned team) writes the plan and the reports;
only a delivery manager decides on them. A refusal says what is missing in plain words.
"""

from django.db import models, transaction
from django.utils import timezone

from automation import authorization as authz
from automation import delivery
from automation.authorization import AutomationError
from automation.delivery import _locked_project, _pk, _tell
from automation.models import (
    AutomationOpportunity,
    ImplementationPlan,
    Milestone,
    Project,
    StageReport,
)
from automation.services import UNAVAILABLE, _clean, _notify, _record, delivery_managers
from identity.models import User

#: The plan's sections, in reading order, with the words used when one is missing.
PLAN_FIELDS = (
    ('approach', 'technical approach'),
    ('architecture', 'architecture and components'),
    ('technology', 'technology stack'),
    ('integrations', 'integrations and data'),
    ('environments', 'environments and deployment'),
    ('testing_strategy', 'testing strategy'),
    ('risks', 'technical risks'),
)
#: What a plan must say before it can be submitted.
REQUIRED_PLAN_FIELDS = ('approach', 'architecture', 'technology', 'testing_strategy')
_EDITABLE_PLAN = frozenset({'draft', 'changes_requested'})
#: Project statuses in which stages are being implemented and can be reported.
_IMPLEMENTING = frozenset({'active', 'testing', 'uat'})


# --- assignment --------------------------------------------------------------------------


@transaction.atomic
def assign_developer(
    user, opportunity_id, *, developer_id, start_date=None, target_date=None
) -> Project:
    """Assign a developer and open the project in one step, so they can start on the plan."""
    delivery.assign_opportunity(user, opportunity_id, assignee_user_id=developer_id)
    return delivery.create_project(
        user, opportunity_id, start_date=start_date, target_date=target_date
    )


# --- the plan ------------------------------------------------------------------------------


def _require_assignee(user, project: Project) -> None:
    if not authz.is_assignee(user, project):
        raise AutomationError('Only the developer assigned to this project can do that.')


def _require_manager(user) -> None:
    if not authz.is_delivery_manager(user):
        raise AutomationError('Only a delivery manager can decide on this.')


def plan_for(user, project_id) -> ImplementationPlan | None:
    """The project's plan, if the reader may see the project; created empty on first read."""
    project = delivery.get_project(user, project_id)
    if project is None:
        return None
    plan, _ = ImplementationPlan.objects.get_or_create(project=project)
    return plan


def _locked_plan(user, project_id) -> tuple[Project, ImplementationPlan]:
    project = _locked_project(user, project_id)
    ImplementationPlan.objects.get_or_create(project=project)
    plan = ImplementationPlan.objects.select_for_update().get(project=project)
    return project, plan


@transaction.atomic
def update_plan(user, project_id, values: dict) -> ImplementationPlan:
    project, plan = _locked_plan(user, project_id)
    _require_assignee(user, project)
    if plan.status not in _EDITABLE_PLAN:
        raise AutomationError(
            'The plan is with the delivery manager.'
            if plan.status == 'submitted'
            else 'The plan is approved and can no longer be changed.'
        )
    known = {field for field, _ in PLAN_FIELDS}
    changed = []
    for field, value in values.items():
        if field not in known:
            raise AutomationError('Unknown plan section.', field=field)
        if value is None:
            continue
        text = _clean(value, field)
        if getattr(plan, field) != text:
            setattr(plan, field, text)
            changed.append(field)
    if changed:
        plan.save(update_fields=[*changed, 'updated_at'])
    return plan


def missing_from_plan(plan: ImplementationPlan) -> list[str]:
    """What the plan still needs before it can be submitted, in words."""
    labels = dict(PLAN_FIELDS)
    missing = [labels[f] for f in REQUIRED_PLAN_FIELDS if not getattr(plan, f).strip()]
    if not plan.project.milestones.exists():
        missing.append('at least one stage')
    return missing


@transaction.atomic
def submit_plan(user, project_id) -> ImplementationPlan:
    project, plan = _locked_plan(user, project_id)
    _require_assignee(user, project)
    if project.status != 'planning':
        raise AutomationError('The plan is submitted before implementation starts.')
    if plan.status not in _EDITABLE_PLAN:
        raise AutomationError('This plan has already been submitted.')
    missing = missing_from_plan(plan)
    if missing:
        raise AutomationError(f'Before submitting, add the {", ".join(missing)}.')

    before = plan.status
    plan.status = 'submitted'
    plan.submitted_by = user
    plan.submitted_at = timezone.now()
    plan.save(update_fields=['status', 'submitted_by', 'submitted_at', 'updated_at'])
    _record(project.opportunity, user, 'plan_submitted', 'plan', plan.pk, from_status=before)
    _notify(
        [m for m in delivery_managers() if m.pk != user.pk],
        'automation.plan_submitted',
        'An implementation plan is waiting for approval',
        f'The plan for "{project.title}" is ready for your decision.',
        project.opportunity.idea,
    )
    return plan


@transaction.atomic
def approve_plan(user, project_id, *, feedback='') -> ImplementationPlan:
    """Approve the plan, which allows - and starts - implementation."""
    project, plan = _locked_plan(user, project_id)
    _require_manager(user)
    if plan.status != 'submitted':
        raise AutomationError('Only a submitted plan can be approved.')

    plan.status = 'approved'
    plan.review_feedback = _clean(feedback, 'feedback')
    plan.decided_by = user
    plan.decided_at = timezone.now()
    plan.save(update_fields=['status', 'review_feedback', 'decided_by', 'decided_at', 'updated_at'])
    _record(project.opportunity, user, 'plan_approved', 'plan', plan.pk)
    if project.status == 'planning':
        delivery.start_project(user, project.pk)
    _tell(
        project,
        'automation.plan_approved',
        'Your implementation plan was approved',
        f'Implementation of "{project.title}" can begin.',
        owner=False,
        delivery=True,
        actor=user,
    )
    return plan


@transaction.atomic
def return_plan(user, project_id, *, feedback) -> ImplementationPlan:
    project, plan = _locked_plan(user, project_id)
    _require_manager(user)
    if plan.status != 'submitted':
        raise AutomationError('Only a submitted plan can be sent back.')
    text = _clean(feedback, 'feedback')
    if not text:
        raise AutomationError('Say what needs to change.', field='feedback')

    plan.status = 'changes_requested'
    plan.review_feedback = text
    plan.decided_by = user
    plan.decided_at = timezone.now()
    plan.save(update_fields=['status', 'review_feedback', 'decided_by', 'decided_at', 'updated_at'])
    _record(project.opportunity, user, 'plan_returned', 'plan', plan.pk)
    _tell(
        project,
        'automation.plan_returned',
        'Your implementation plan was sent back',
        f'The delivery manager asked for changes to the plan for "{project.title}".',
        owner=False,
        delivery=True,
        actor=user,
    )
    return plan


def plan_is_approved(project: Project) -> bool:
    return ImplementationPlan.objects.filter(project=project, status='approved').exists()


# --- stages ------------------------------------------------------------------------------


@transaction.atomic
def add_stage(user, project_id, *, title, description='', due_date=None) -> Milestone:
    """A stage of the plan. Not while the plan is with the manager."""
    project, plan = _locked_plan(user, project_id)
    _require_assignee(user, project)
    if plan.status == 'submitted':
        raise AutomationError('The plan is with the delivery manager; wait for their decision.')
    return delivery.create_milestone(
        user, project.pk, title=title, description=description, due_date=due_date
    )


@transaction.atomic
def remove_stage(user, milestone_id) -> Project:
    milestone = Milestone.objects.select_related('project').filter(pk=_pk(milestone_id)).first()
    if milestone is None:
        raise AutomationError(UNAVAILABLE)
    project, plan = _locked_plan(user, milestone.project_id)
    _require_assignee(user, project)
    if plan.status not in _EDITABLE_PLAN:
        raise AutomationError('Stages can only be removed while the plan is being written.')
    milestone.delete()
    return project


def _locked_stage(user, milestone_id) -> tuple[Project, Milestone]:
    milestone = Milestone.objects.filter(pk=_pk(milestone_id)).first()
    if milestone is None:
        raise AutomationError(UNAVAILABLE)
    project = _locked_project(user, milestone.project_id)
    return project, Milestone.objects.select_for_update().get(pk=milestone.pk)


@transaction.atomic
def submit_stage(user, milestone_id, *, summary) -> StageReport:
    """The developer reports a stage done, for the delivery manager to approve."""
    project, milestone = _locked_stage(user, milestone_id)
    _require_assignee(user, project)
    if project.status not in _IMPLEMENTING:
        raise AutomationError('Stages are reported once implementation has started.')
    if milestone.status in ('submitted', 'completed'):
        raise AutomationError(
            'This stage is waiting for approval.'
            if milestone.status == 'submitted'
            else 'This stage is already approved.'
        )
    text = _clean(summary, 'summary')
    if not text:
        raise AutomationError('Say what was done in this stage.', field='summary')

    report = StageReport.objects.create(milestone=milestone, author=user, summary=text)
    milestone.status = 'submitted'
    milestone.save(update_fields=['status'])
    _record(project.opportunity, user, 'stage_submitted', 'milestone', milestone.pk)
    _notify(
        [m for m in delivery_managers() if m.pk != user.pk],
        'automation.stage_submitted',
        'A stage is waiting for approval',
        f'"{milestone.title}" on "{project.title}" was reported done.',
        project.opportunity.idea,
    )
    return report


def _pending_report(milestone: Milestone) -> StageReport:
    report = milestone.reports.filter(decision='pending').first()
    if milestone.status != 'submitted' or report is None:
        raise AutomationError('This stage is not waiting for a decision.')
    return report


@transaction.atomic
def approve_stage(user, milestone_id, *, feedback='') -> Milestone:
    project, milestone = _locked_stage(user, milestone_id)
    _require_manager(user)
    report = _pending_report(milestone)
    now = timezone.now()
    report.decision = 'approved'
    report.feedback = _clean(feedback, 'feedback')
    report.decided_by, report.decided_at = user, now
    report.save(update_fields=['decision', 'feedback', 'decided_by', 'decided_at'])
    milestone.status = 'completed'
    milestone.completed_at = now
    milestone.save(update_fields=['status', 'completed_at'])
    _record(project.opportunity, user, 'stage_approved', 'milestone', milestone.pk)
    _tell(
        project,
        'automation.stage_approved',
        'A stage was approved',
        f'"{milestone.title}" on "{project.title}" is approved.',
        delivery=True,
        actor=user,
    )
    return milestone


@transaction.atomic
def return_stage(user, milestone_id, *, feedback) -> Milestone:
    project, milestone = _locked_stage(user, milestone_id)
    _require_manager(user)
    report = _pending_report(milestone)
    text = _clean(feedback, 'feedback')
    if not text:
        raise AutomationError('Say what needs to change.', field='feedback')
    report.decision = 'returned'
    report.feedback = text
    report.decided_by, report.decided_at = user, timezone.now()
    report.save(update_fields=['decision', 'feedback', 'decided_by', 'decided_at'])
    milestone.status = 'returned'
    milestone.save(update_fields=['status'])
    _record(project.opportunity, user, 'stage_returned', 'milestone', milestone.pk)
    _tell(
        project,
        'automation.stage_returned',
        'A stage was sent back',
        f'The delivery manager asked for changes to "{milestone.title}" on "{project.title}".',
        owner=False,
        delivery=True,
        actor=user,
    )
    return milestone


# --- the delivery manager's desk -------------------------------------------------------------


def desk(user) -> dict:
    """
    What is waiting for a delivery manager: opportunities to assign, plans and stages to
    decide on, and the projects in delivery. Empty for anyone else.
    """
    empty = {'to_assign': [], 'plans': [], 'stages': [], 'projects': []}
    if not authz.is_delivery_manager(user):
        return empty
    projects = list(
        Project.objects.select_related(
            'opportunity__idea', 'owner', 'organization', 'team', 'assigned_user', 'assigned_team'
        ).order_by('-updated_at')
    )
    return {
        'to_assign': list(
            AutomationOpportunity.objects.filter(status='ready_for_assignment')
            .select_related('idea', 'owner', 'organization', 'team')
            .order_by('updated_at')
        ),
        'plans': list(
            ImplementationPlan.objects.filter(status='submitted')
            .select_related('project__assigned_user', 'project__assigned_team', 'submitted_by')
            .order_by('submitted_at')
        ),
        'stages': list(
            StageReport.objects.filter(decision='pending', milestone__status='submitted')
            .select_related('milestone__project', 'author')
            .order_by('created_at')
        ),
        'projects': projects,
    }


def developers() -> list[User]:
    """Everyone who may be assigned delivery work, for the manager's picker."""
    return [
        u
        for u in User.objects.filter(is_active=True).order_by('first_name', 'last_name', 'email')
        if authz.is_eligible_assignee(u)
    ]


# --- the developer's own work ----------------------------------------------------------------

_ACTIVE_PROJECT = ('planning', 'active', 'testing', 'uat', 'deployed', 'on_hold')


def _plan_step(plan_status: str) -> tuple[str, str, bool]:
    if plan_status == 'submitted':
        return ('Waiting for the delivery manager to approve your plan', 'plan', False)
    if plan_status == 'changes_requested':
        return ('Revise the implementation plan - it was sent back', 'plan', True)
    return ('Write the implementation plan', 'plan', True)


def _stage_step(stages: list[Milestone]) -> tuple[str, str, bool]:
    for stage in stages:
        if stage.status == 'returned':
            return (f'Revise and report again: {stage.title}', 'work', True)
        if stage.status == 'submitted':
            return (f'Waiting for approval: {stage.title}', 'work', False)
        if stage.status != 'completed':
            return (f'Report when done: {stage.title}', 'work', True)
    return ('Every stage is approved - move the project to testing', 'overview', True)


#: The next step once a project is past its stages, by status.
_LATER_STEPS = {
    'testing': ('Run the tests, then send it to acceptance testing', 'testing', True),
    'uat': ("Waiting for the owner's acceptance testing", 'uat', False),
    'deployed': ('Deployed - record the impact', 'impact', True),
}


def _next_step(
    project: Project, plan_status: str, stages: list[Milestone]
) -> tuple[str, str, bool]:
    """The next step on `project`: its words, the project tab, and whether it is the developer's."""
    if project.status == 'planning':
        return _plan_step(plan_status)
    if project.status == 'active':
        return _stage_step(stages)
    return _LATER_STEPS.get(project.status, ('On hold', 'overview', False))


def development_work(user) -> list[dict]:
    """
    The projects assigned to `user` (directly or through their team) that are still open,
    each with where its plan and stages stand and the next step. Things waiting on the
    developer come first.
    """
    if user is None or not user.is_active:
        return []
    from teams.models import TeamMembership

    team_ids = TeamMembership.objects.filter(
        user=user, status=TeamMembership.Status.ACTIVE
    ).values_list('team_id', flat=True)
    projects = (
        Project.objects.filter(status__in=_ACTIVE_PROJECT)
        .filter(models.Q(assigned_user=user) | models.Q(assigned_team_id__in=list(team_ids)))
        .select_related(
            'opportunity__idea', 'owner', 'organization', 'team', 'assigned_user', 'assigned_team'
        )
        .order_by('-updated_at')
    )
    items = []
    for project in projects:
        plan = ImplementationPlan.objects.filter(project=project).first()
        plan_status = plan.status if plan else 'draft'
        stages = list(project.milestones.all())
        action, tab, needs_me = _next_step(project, plan_status, stages)
        items.append(
            {
                'project': project,
                'plan_status': plan_status,
                'stages_total': len(stages),
                'stages_approved': sum(1 for s in stages if s.status == 'completed'),
                'stages_waiting': sum(1 for s in stages if s.status == 'submitted'),
                'next_action': action,
                'next_tab': tab,
                'needs_me': needs_me,
            }
        )
    items.sort(key=lambda item: not item['needs_me'])
    return items


def _my_project_ids(user) -> list[int]:
    from teams.models import TeamMembership

    team_ids = TeamMembership.objects.filter(
        user=user, status=TeamMembership.Status.ACTIVE
    ).values_list('team_id', flat=True)
    return list(
        Project.objects.filter(status__in=_ACTIVE_PROJECT)
        .filter(models.Q(assigned_user=user) | models.Q(assigned_team_id__in=list(team_ids)))
        .values_list('pk', flat=True)
    )


def my_tasks(user) -> list:
    """
    The open tasks on the projects assigned to `user`: those assigned to them, and those
    assigned to nobody yet. Blocked first, then in progress, then to do; soonest due first.
    """
    from automation.models import Task

    if user is None or not user.is_active:
        return []
    order = {'blocked': 0, 'in_progress': 1, 'todo': 2}
    tasks = (
        Task.objects.filter(project_id__in=_my_project_ids(user))
        .exclude(status='done')
        .filter(models.Q(assignee=user) | models.Q(assignee__isnull=True))
        .select_related('project', 'milestone')
    )
    return sorted(
        tasks,
        key=lambda t: (order.get(t.status, 3), t.due_date is None, t.due_date, t.pk),
    )


def roles(user) -> dict:
    """Which parts of delivery the user takes part in, so the screens show only theirs."""
    from reviews import eligibility

    active = user is not None and user.is_active
    return {
        'is_developer': active and authz.is_eligible_assignee(user),
        'is_delivery_manager': active and authz.is_delivery_manager(user),
        'is_reviewer': active and eligibility.is_platform_reviewer(user),
    }
