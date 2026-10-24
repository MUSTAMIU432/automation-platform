"""Assignment -> the developer's implementation plan -> approved stages, with the manager's desk."""

import pytest

from automation import delivery, implementation
from automation.authorization import AutomationError
from automation.models import ImplementationPlan, Milestone, StageReport
from automation.tests.test_delivery import PLAN, ready_for_assignment
from automation.tests.test_opportunity import make_user
from notifications.models import Notification
from reviews.tests.platform import grant_permission

MANAGE = 'automation.manage_delivery'
ASSIGNABLE = 'automation.be_assignable'


@pytest.fixture
def author(db):
    return make_user('author@example.com')


@pytest.fixture
def manager(db):
    user = make_user('manager@example.com')
    grant_permission(user, MANAGE)
    return user


@pytest.fixture
def developer(db):
    user = make_user('dev@example.com')
    grant_permission(user, ASSIGNABLE)
    return user


@pytest.fixture
def project(author, manager, developer):
    opportunity = ready_for_assignment(author)
    return implementation.assign_developer(manager, opportunity.pk, developer_id=developer.pk)


def written(project, developer, stages=('Import',)):
    implementation.update_plan(developer, project.pk, PLAN)
    for title in stages:
        implementation.add_stage(developer, project.pk, title=title)


def implementing(project, manager, developer):
    written(project, developer)
    implementation.submit_plan(developer, project.pk)
    implementation.approve_plan(manager, project.pk)
    project.refresh_from_db()
    return project


@pytest.mark.django_db
class TestAssigning:
    def test_assigning_a_developer_opens_the_project_in_planning(self, project, developer):
        assert project.status == 'planning'
        assert project.assigned_user_id == developer.pk
        assert project.opportunity.status == 'project_created'

    def test_only_a_manager_assigns(self, author, developer):
        opportunity = ready_for_assignment(author)
        with pytest.raises(AutomationError):
            implementation.assign_developer(developer, opportunity.pk, developer_id=developer.pk)

    def test_the_developer_is_told(
        self, author, manager, developer, django_capture_on_commit_callbacks
    ):
        opportunity = ready_for_assignment(author)
        with django_capture_on_commit_callbacks(execute=True):
            implementation.assign_developer(manager, opportunity.pk, developer_id=developer.pk)

        assert Notification.objects.filter(
            user=developer, kind='automation.opportunity_assigned'
        ).exists()


@pytest.mark.django_db
class TestThePlan:
    def test_only_the_assigned_developer_writes_it(self, project, manager, author):
        for person in (manager, author):
            with pytest.raises(AutomationError):
                implementation.update_plan(person, project.pk, {'approach': 'x'})

    def test_it_cannot_be_submitted_until_it_says_enough(self, project, developer):
        implementation.update_plan(developer, project.pk, {'approach': 'Nightly import.'})

        with pytest.raises(AutomationError, match='architecture and components') as raised:
            implementation.submit_plan(developer, project.pk)
        assert 'at least one stage' in raised.value.message

    def test_submitting_tells_the_managers_and_locks_it(
        self, project, manager, developer, django_capture_on_commit_callbacks
    ):
        written(project, developer)

        with django_capture_on_commit_callbacks(execute=True):
            plan = implementation.submit_plan(developer, project.pk)

        assert plan.status == 'submitted'
        assert Notification.objects.filter(user=manager, kind='automation.plan_submitted').exists()
        with pytest.raises(AutomationError, match='with the delivery manager'):
            implementation.update_plan(developer, project.pk, {'risks': 'x'})
        with pytest.raises(AutomationError, match='wait for their decision'):
            implementation.add_stage(developer, project.pk, title='Late stage')

    def test_implementation_cannot_start_before_approval(self, project, developer, manager):
        written(project, developer)
        with pytest.raises(AutomationError, match='approves the implementation plan'):
            delivery.start_project(manager, project.pk)

    def test_approval_starts_implementation(
        self, project, manager, developer, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            project = implementing(project, manager, developer)

        assert project.status == 'active'
        assert project.plan.status == 'approved'
        assert project.plan.decided_by == manager
        assert Notification.objects.filter(user=developer, kind='automation.plan_approved').exists()

    def test_only_a_manager_decides(self, project, developer, author):
        written(project, developer)
        implementation.submit_plan(developer, project.pk)
        for person in (developer, author):
            with pytest.raises(AutomationError):
                implementation.approve_plan(person, project.pk)

    def test_sending_it_back_needs_feedback_and_reopens_it(self, project, manager, developer):
        written(project, developer)
        implementation.submit_plan(developer, project.pk)

        with pytest.raises(AutomationError, match='what needs to change'):
            implementation.return_plan(manager, project.pk, feedback='  ')
        plan = implementation.return_plan(manager, project.pk, feedback='Add the rollback plan.')

        assert plan.status == 'changes_requested'
        implementation.update_plan(developer, project.pk, {'environments': 'Staging first.'})
        assert implementation.submit_plan(developer, project.pk).status == 'submitted'

    def test_a_stage_can_be_removed_only_while_writing(self, project, manager, developer):
        written(project, developer, stages=('Import', 'Dashboard'))
        extra = Milestone.objects.get(project=project, title='Dashboard')

        implementation.remove_stage(developer, extra.pk)
        assert not Milestone.objects.filter(pk=extra.pk).exists()

        implementation.submit_plan(developer, project.pk)
        stage = Milestone.objects.get(project=project)
        with pytest.raises(AutomationError, match='being written'):
            implementation.remove_stage(developer, stage.pk)


@pytest.mark.django_db
class TestStages:
    def test_a_stage_is_reported_and_approved(
        self, project, manager, developer, django_capture_on_commit_callbacks
    ):
        project = implementing(project, manager, developer)
        stage = project.milestones.get()

        with django_capture_on_commit_callbacks(execute=True):
            report = implementation.submit_stage(
                developer, stage.pk, summary='Import runs nightly.'
            )
        stage.refresh_from_db()
        assert stage.status == 'submitted'
        assert Notification.objects.filter(user=manager, kind='automation.stage_submitted').exists()

        implementation.approve_stage(manager, stage.pk, feedback='Good.')
        stage.refresh_from_db()
        report.refresh_from_db()
        assert stage.status == 'completed'
        assert stage.completed_at is not None
        assert (report.decision, report.feedback) == ('approved', 'Good.')

    def test_a_stage_sent_back_keeps_its_history(self, project, manager, developer):
        project = implementing(project, manager, developer)
        stage = project.milestones.get()
        implementation.submit_stage(developer, stage.pk, summary='First go.')

        implementation.return_stage(manager, stage.pk, feedback='Handle duplicate rows.')
        stage.refresh_from_db()
        assert stage.status == 'returned'

        implementation.submit_stage(developer, stage.pk, summary='Duplicates handled.')
        assert [r.decision for r in StageReport.objects.filter(milestone=stage)] == [
            'pending',
            'returned',
        ]

    def test_stages_are_reported_only_during_implementation(self, project, developer):
        written(project, developer)
        stage = project.milestones.get()
        with pytest.raises(AutomationError, match='once implementation has started'):
            implementation.submit_stage(developer, stage.pk, summary='Too early.')

    def test_a_report_says_what_was_done_and_waits_for_one_decision(
        self, project, manager, developer
    ):
        project = implementing(project, manager, developer)
        stage = project.milestones.get()
        with pytest.raises(AutomationError, match='what was done'):
            implementation.submit_stage(developer, stage.pk, summary='')
        implementation.submit_stage(developer, stage.pk, summary='Done.')
        with pytest.raises(AutomationError, match='waiting for approval'):
            implementation.submit_stage(developer, stage.pk, summary='Again.')
        with pytest.raises(AutomationError):
            implementation.approve_stage(developer, stage.pk)


@pytest.mark.django_db
class TestTheDesk:
    def test_it_shows_what_waits_for_the_manager(self, author, manager, developer, project):
        waiting = ready_for_assignment(make_user('other@example.com'))
        written(project, developer)
        implementation.submit_plan(developer, project.pk)

        desk = implementation.desk(manager)

        assert [o.pk for o in desk['to_assign']] == [waiting.pk]
        assert [p.project_id for p in desk['plans']] == [project.pk]
        assert desk['stages'] == []
        assert [p.pk for p in desk['projects']] == [project.pk]
        assert developer in implementation.developers()

    def test_it_is_empty_for_anyone_else(self, project, developer, author):
        for person in (developer, author, None):
            assert implementation.desk(person) == {
                'to_assign': [],
                'plans': [],
                'stages': [],
                'projects': [],
            }

    def test_a_plan_is_created_empty_on_first_read(self, project, developer):
        plan = implementation.plan_for(developer, project.pk)
        assert isinstance(plan, ImplementationPlan)
        assert plan.status == 'draft'


@pytest.mark.django_db
class TestTheDevelopersWork:
    def steps(self, developer):
        return [
            (i['project'].pk, i['next_action'], i['next_tab'], i['needs_me'])
            for i in implementation.development_work(developer)
        ]

    def test_it_follows_the_project_from_plan_to_stages(self, project, manager, developer):
        assert self.steps(developer) == [
            (project.pk, 'Write the implementation plan', 'plan', True)
        ]

        written(project, developer, stages=('Import', 'Dashboard'))
        implementation.submit_plan(developer, project.pk)
        assert self.steps(developer)[0][1:] == (
            'Waiting for the delivery manager to approve your plan',
            'plan',
            False,
        )

        implementation.return_plan(manager, project.pk, feedback='More detail.')
        assert self.steps(developer)[0][1] == 'Revise the implementation plan - it was sent back'

        implementation.submit_plan(developer, project.pk)
        implementation.approve_plan(manager, project.pk)
        assert self.steps(developer)[0][1:] == ('Report when done: Import', 'work', True)

        first = Milestone.objects.get(project=project, title='Import')
        implementation.submit_stage(developer, first.pk, summary='Done.')
        assert self.steps(developer)[0][1:] == ('Waiting for approval: Import', 'work', False)

        implementation.return_stage(manager, first.pk, feedback='Handle duplicates.')
        assert self.steps(developer)[0][1] == 'Revise and report again: Import'

        implementation.submit_stage(developer, first.pk, summary='Duplicates handled.')
        implementation.approve_stage(manager, first.pk)
        assert self.steps(developer)[0][1] == 'Report when done: Dashboard'

    def test_it_is_only_the_developers_own_work(self, project, manager, author):
        assert implementation.development_work(manager) == []
        assert implementation.development_work(author) == []
        assert implementation.development_work(None) == []


@pytest.mark.django_db
class TestTasksAndRoles:
    def test_my_tasks_are_the_open_ones_on_my_projects_mine_or_unassigned(
        self, project, manager, developer
    ):
        project = implementing(project, manager, developer)
        mine = delivery.create_task(developer, project.pk, title='Mine', assignee_id=developer.pk)
        loose = delivery.create_task(developer, project.pk, title='Unassigned')
        blocked = delivery.create_task(developer, project.pk, title='Blocked one')
        delivery.update_task(developer, blocked.pk, {'status': 'blocked'})
        done = delivery.create_task(developer, project.pk, title='Done')
        delivery.update_task(developer, done.pk, {'status': 'done'})

        tasks = implementation.my_tasks(developer)

        assert [t.pk for t in tasks] == [blocked.pk, mine.pk, loose.pk]
        assert implementation.my_tasks(manager) == []

    def test_roles_say_which_parts_of_delivery_someone_takes(self, manager, developer, author):
        assert implementation.roles(developer)['is_developer'] is True
        assert implementation.roles(manager)['is_delivery_manager'] is True
        assert implementation.roles(author) == {
            'is_developer': False,
            'is_delivery_manager': False,
            'is_reviewer': False,
        }
        assert implementation.roles(None)['is_developer'] is False


@pytest.mark.django_db
class TestWhatTheAppLists:
    """In the app everyone - a delivery manager too - sees only what belongs to them."""

    def test_the_owner_and_the_assigned_developer_see_it_and_nobody_else(
        self, project, author, manager, developer
    ):
        from automation import services

        outsider = make_user('outsider@example.com')
        mine = lambda person: [o.pk for o in services.list_opportunities(person)]  # noqa: E731

        assert mine(author) == [project.opportunity_id]
        assert mine(developer) == [project.opportunity_id]
        assert mine(outsider) == []
        # The delivery manager does not own it and is not delivering it: not in their app lists,
        # though the console's desk still shows it to them.
        assert mine(manager) == []
        assert [p.pk for p in delivery.list_projects(manager)] == []
        assert [p.pk for p in implementation.desk(manager)['projects']] == [project.pk]


@pytest.mark.django_db
def test_the_desk_carries_each_projects_stages_with_their_tasks(project, manager, developer):
    from automation.implementation_schema import _desk_project

    project = implementing(project, manager, developer)
    stage = project.milestones.get()
    delivery.create_task(developer, project.pk, title='Import', milestone_id=stage.pk)
    done = delivery.create_task(developer, project.pk, title='Match', milestone_id=stage.pk)
    delivery.update_task(developer, done.pk, {'status': 'done'})
    implementation.submit_stage(developer, stage.pk, summary='Import runs nightly.')

    row = _desk_project(project, manager)

    assert row.stages_waiting == 1
    (only,) = row.stages
    assert (only.milestone.title, only.tasks_total, only.tasks_done) == ('Import', 2, 1)
    assert only.can_decide is True
    assert only.reports[0].summary == 'Import runs nightly.'
