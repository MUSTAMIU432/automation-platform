"""
GraphQL for the implementation plan, stage approvals and the delivery manager's desk.

Who may do what is `automation.implementation`'s to decide; this module only asks and
reports. A refusal is a `success: false` payload naming its field, like everywhere else.
"""

from datetime import date, datetime

import strawberry

from automation import authorization as authz
from automation import implementation
from automation.authorization import AutomationError
from automation.delivery_schema import MilestoneType, ProjectType, TaskType, _build, _id, _project
from automation.models import ImplementationPlan, Milestone, StageReport
from automation.schema import OpportunityType, _camel


def _name(user) -> str | None:
    return (user.get_full_name() or user.email) if user else None


@strawberry.type
class ImplementationPlanType:
    id: strawberry.ID
    project_id: strawberry.ID
    approach: str
    architecture: str
    technology: str
    integrations: str
    environments: str
    testing_strategy: str
    risks: str
    status: str
    review_feedback: str
    submitted_by_name: str | None
    submitted_at: datetime | None
    decided_by_name: str | None
    decided_at: datetime | None
    updated_at: datetime
    missing: list[str] = strawberry.field(
        description='What the plan still needs before it can be submitted, in words.'
    )
    can_edit: bool
    can_submit: bool
    can_decide: bool


def _plan(plan: ImplementationPlan, user) -> ImplementationPlanType:
    project = plan.project
    assignee = authz.is_assignee(user, project)
    editable = plan.status in ('draft', 'changes_requested') and project.status == 'planning'
    missing = implementation.missing_from_plan(plan)
    return _build(
        ImplementationPlanType,
        plan,
        submitted_by_name=_name(plan.submitted_by),
        decided_by_name=_name(plan.decided_by),
        missing=missing,
        can_edit=assignee and editable,
        can_submit=assignee and editable and not missing,
        can_decide=authz.is_delivery_manager(user) and plan.status == 'submitted',
    )


@strawberry.type
class StageReportType:
    id: strawberry.ID
    milestone_id: strawberry.ID
    author_name: str
    summary: str
    decision: str
    feedback: str
    decided_by_name: str | None
    decided_at: datetime | None
    created_at: datetime


def _report(r: StageReport) -> StageReportType:
    return _build(
        StageReportType,
        r,
        author_name=_name(r.author),
        decided_by_name=_name(r.decided_by),
    )


@strawberry.type
class StageType:
    """A stage of the plan - one milestone - with the reports made on it, newest first."""

    milestone: MilestoneType
    reports: list[StageReportType]
    can_report: bool
    can_decide: bool
    tasks_total: int
    tasks_done: int


def _stage(m: Milestone, user) -> StageType:
    project = m.project
    return StageType(
        milestone=_build(MilestoneType, m),
        reports=[_report(r) for r in m.reports.select_related('author', 'decided_by')],
        can_report=authz.is_assignee(user, project)
        and project.status in ('active', 'testing', 'uat')
        and m.status not in ('submitted', 'completed'),
        can_decide=authz.is_delivery_manager(user) and m.status == 'submitted',
        tasks_total=m.tasks.count(),
        tasks_done=m.tasks.filter(status='done').count(),
    )


@strawberry.type
class PlanWaiting:
    project: ProjectType
    plan: ImplementationPlanType


@strawberry.type
class StageWaiting:
    project: ProjectType
    stage: StageType


@strawberry.type
class DeveloperOption:
    id: strawberry.ID
    name: str
    email: str
    active_projects: int


@strawberry.type
class DeskProject:
    """One project in delivery, with where its plan and stages stand."""

    project: ProjectType
    plan_status: str
    stages_total: int
    stages_approved: int
    stages_waiting: int
    stages: list[StageType] = strawberry.field(
        description='Every stage of the project, in order, with its reports and task counts.'
    )


def _desk_project(p, user) -> DeskProject:
    plan = ImplementationPlan.objects.filter(project=p).first()
    milestones = list(p.milestones.select_related('project'))
    statuses = [m.status for m in milestones]
    return DeskProject(
        project=_project(p, user),
        plan_status=plan.status if plan else 'draft',
        stages_total=len(statuses),
        stages_approved=statuses.count('completed'),
        stages_waiting=statuses.count('submitted'),
        stages=[_stage(m, user) for m in milestones],
    )


@strawberry.type
class DevelopmentWorkItem:
    """One project assigned to the developer, and the next step on it."""

    project: ProjectType
    plan_status: str
    stages_total: int
    stages_approved: int
    stages_waiting: int
    next_action: str
    next_tab: str = strawberry.field(description='The project tab where the next step is taken.')
    needs_me: bool = strawberry.field(description="Whether the next step is the developer's.")


@strawberry.type
class AutomationRoles:
    is_developer: bool
    is_delivery_manager: bool
    is_reviewer: bool


@strawberry.type
class MyTask:
    task: TaskType
    project_id: strawberry.ID
    project_title: str
    stage_title: str | None


@strawberry.type
class DeliveryDesk:
    """What is waiting for the delivery manager, and everything in delivery."""

    can_manage: bool
    to_assign: list[OpportunityType]
    plans: list[PlanWaiting]
    stages: list[StageWaiting]
    projects: list[DeskProject]
    developers: list[DeveloperOption]


@strawberry.type
class PlanPayload:
    success: bool
    message: str
    field: str | None = None
    plan: ImplementationPlanType | None = None


@strawberry.type
class StagePayload:
    success: bool
    message: str
    field: str | None = None
    stage: StageType | None = None


@strawberry.type
class AssignDeveloperPayload:
    success: bool
    message: str
    field: str | None = None
    project: ProjectType | None = None


@strawberry.input
class ImplementationPlanInput:
    project_id: strawberry.ID
    approach: str | None = None
    architecture: str | None = None
    technology: str | None = None
    integrations: str | None = None
    environments: str | None = None
    testing_strategy: str | None = None
    risks: str | None = None


def _refused(cls, exc: AutomationError):
    return cls(success=False, message=exc.message, field=_camel(exc.field))


def _plan_result(info, action) -> PlanPayload:
    user = info.context.user
    try:
        plan = action(user)
    except AutomationError as exc:
        return _refused(PlanPayload, exc)
    plan = ImplementationPlan.objects.select_related('project', 'submitted_by', 'decided_by').get(
        pk=plan.pk
    )
    return PlanPayload(success=True, message='Done.', plan=_plan(plan, user))


def _stage_result(info, action) -> StagePayload:
    user = info.context.user
    try:
        result = action(user)
    except AutomationError as exc:
        return _refused(StagePayload, exc)
    milestone = result.milestone if isinstance(result, StageReport) else result
    milestone = Milestone.objects.select_related('project').get(pk=milestone.pk)
    return StagePayload(success=True, message='Done.', stage=_stage(milestone, user))


def _active_projects(developer) -> int:
    return developer.delivery_projects.filter(
        status__in=('planning', 'active', 'testing', 'uat')
    ).count()


@strawberry.type
class Query:
    @strawberry.field(
        description="A project's implementation plan, or null if it is not yours to see."
    )
    def implementation_plan(
        self, info: strawberry.Info, project_id: strawberry.ID
    ) -> ImplementationPlanType | None:
        user = info.context.user
        plan = implementation.plan_for(user, project_id)
        return _plan(plan, user) if plan else None

    @strawberry.field(description="A project's stages with their reports; empty if not visible.")
    def project_stages(self, info: strawberry.Info, project_id: strawberry.ID) -> list[StageType]:
        from automation import delivery

        user = info.context.user
        project = delivery.get_project(user, project_id)
        if project is None:
            return []
        return [_stage(m, user) for m in project.milestones.select_related('project')]

    @strawberry.field(
        description='The projects assigned to the caller, with the next step on each; '
        'those waiting on them first.'
    )
    def my_development_work(self, info: strawberry.Info) -> list[DevelopmentWorkItem]:
        user = info.context.user
        return [
            DevelopmentWorkItem(
                project=_project(item['project'], user),
                plan_status=item['plan_status'],
                stages_total=item['stages_total'],
                stages_approved=item['stages_approved'],
                stages_waiting=item['stages_waiting'],
                next_action=item['next_action'],
                next_tab=item['next_tab'],
                needs_me=item['needs_me'],
            )
            for item in implementation.development_work(user)
        ]

    @strawberry.field(description='Which parts of delivery the caller takes part in.')
    def my_automation_roles(self, info: strawberry.Info) -> AutomationRoles:
        return AutomationRoles(**implementation.roles(info.context.user))

    @strawberry.field(
        description='Open tasks on the projects assigned to the caller: theirs and unassigned.'
    )
    def my_tasks(self, info: strawberry.Info) -> list[MyTask]:
        return [
            MyTask(
                task=_build(TaskType, t),
                project_id=_id(t.project_id),
                project_title=t.project.title,
                stage_title=t.milestone.title if t.milestone_id else None,
            )
            for t in implementation.my_tasks(info.context.user)
        ]

    @strawberry.field(description="The delivery manager's desk. Empty for anyone else.")
    def delivery_desk(self, info: strawberry.Info) -> DeliveryDesk:
        user = info.context.user
        found = implementation.desk(user)
        return DeliveryDesk(
            can_manage=authz.is_delivery_manager(user),
            to_assign=[OpportunityType.from_model(o, user) for o in found['to_assign']],
            plans=[
                PlanWaiting(project=_project(p.project, user), plan=_plan(p, user))
                for p in found['plans']
            ],
            stages=[
                StageWaiting(
                    project=_project(r.milestone.project, user), stage=_stage(r.milestone, user)
                )
                for r in found['stages']
            ],
            projects=[_desk_project(p, user) for p in found['projects']],
            developers=[
                DeveloperOption(
                    id=_id(d.pk),
                    name=_name(d),
                    email=d.email,
                    active_projects=_active_projects(d),
                )
                for d in (implementation.developers() if authz.is_delivery_manager(user) else [])
            ],
        )


@strawberry.type
class Mutation:
    @strawberry.mutation(
        description='Assign a developer to an opportunity and open its project (delivery manager).'
    )
    def assign_developer(
        self,
        info: strawberry.Info,
        opportunity_id: strawberry.ID,
        developer_id: strawberry.ID,
        start_date: date | None = None,
        target_date: date | None = None,
    ) -> AssignDeveloperPayload:
        user = info.context.user
        try:
            project = implementation.assign_developer(
                user,
                opportunity_id,
                developer_id=developer_id,
                start_date=start_date.isoformat() if start_date else None,
                target_date=target_date.isoformat() if target_date else None,
            )
        except AutomationError as exc:
            return _refused(AssignDeveloperPayload, exc)
        return AssignDeveloperPayload(
            success=True, message='Done.', project=_project(project, user)
        )

    @strawberry.mutation(description='Save sections of the implementation plan (the developer).')
    def update_implementation_plan(
        self, info: strawberry.Info, input: ImplementationPlanInput
    ) -> PlanPayload:
        values = {k: v for k, v in vars(input).items() if k != 'project_id' and v is not None}
        return _plan_result(
            info, lambda user: implementation.update_plan(user, input.project_id, values)
        )

    @strawberry.mutation(description='Send the implementation plan to the delivery manager.')
    def submit_implementation_plan(
        self, info: strawberry.Info, project_id: strawberry.ID
    ) -> PlanPayload:
        return _plan_result(info, lambda user: implementation.submit_plan(user, project_id))

    @strawberry.mutation(description='Approve the plan, which starts implementation.')
    def approve_implementation_plan(
        self, info: strawberry.Info, project_id: strawberry.ID, feedback: str | None = None
    ) -> PlanPayload:
        return _plan_result(
            info,
            lambda user: implementation.approve_plan(user, project_id, feedback=feedback or ''),
        )

    @strawberry.mutation(description='Send the plan back to the developer with feedback.')
    def return_implementation_plan(
        self, info: strawberry.Info, project_id: strawberry.ID, feedback: str
    ) -> PlanPayload:
        return _plan_result(
            info, lambda user: implementation.return_plan(user, project_id, feedback=feedback)
        )

    @strawberry.mutation(description='Add a stage to the plan (the developer).')
    def add_stage(
        self,
        info: strawberry.Info,
        project_id: strawberry.ID,
        title: str,
        description: str | None = None,
        due_date: str | None = None,
    ) -> StagePayload:
        return _stage_result(
            info,
            lambda user: implementation.add_stage(
                user,
                project_id,
                title=title,
                description=description or '',
                due_date=due_date or None,
            ),
        )

    @strawberry.mutation(description='Remove a stage while the plan is being written.')
    def remove_stage(self, info: strawberry.Info, milestone_id: strawberry.ID) -> StagePayload:
        user = info.context.user
        try:
            implementation.remove_stage(user, milestone_id)
        except AutomationError as exc:
            return _refused(StagePayload, exc)
        return StagePayload(success=True, message='Removed.')

    @strawberry.mutation(description='Report a stage done, for the delivery manager to approve.')
    def submit_stage(
        self, info: strawberry.Info, milestone_id: strawberry.ID, summary: str
    ) -> StagePayload:
        return _stage_result(
            info, lambda user: implementation.submit_stage(user, milestone_id, summary=summary)
        )

    @strawberry.mutation(description='Approve a reported stage, completing it.')
    def approve_stage(
        self, info: strawberry.Info, milestone_id: strawberry.ID, feedback: str | None = None
    ) -> StagePayload:
        return _stage_result(
            info,
            lambda user: implementation.approve_stage(user, milestone_id, feedback=feedback or ''),
        )

    @strawberry.mutation(description='Send a reported stage back to the developer with feedback.')
    def return_stage(
        self, info: strawberry.Info, milestone_id: strawberry.ID, feedback: str
    ) -> StagePayload:
        return _stage_result(
            info, lambda user: implementation.return_stage(user, milestone_id, feedback=feedback)
        )
