import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Api from '../api/automationApi'
import { Route, Routes } from 'react-router-dom'

import { AdminAutomationPage } from '../../administration/pages/AdminAutomationPage'
import { AutomationLayout } from './AutomationLayout'
import {
  AutomationHome,
  DevelopmentWorkSection,
  MyTasksPage,
  WorkspacePage,
} from './DevelopmentWork'
import { PlanTab } from './PlanTab'
import { StagesPanel } from './StagesPanel'

vi.mock('../api/automationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof Api>()),
  adminOpportunitiesRequest: vi.fn(),
  deliveryDeskRequest: vi.fn(),
  assignDeveloper: vi.fn(),
  implementationPlanRequest: vi.fn(),
  projectStagesRequest: vi.fn(),
  updateImplementationPlan: vi.fn(),
  submitImplementationPlan: vi.fn(),
  approveImplementationPlan: vi.fn(),
  returnImplementationPlan: vi.fn(),
  addStage: vi.fn(),
  removeStage: vi.fn(),
  submitStage: vi.fn(),
  updateTask: vi.fn(),
  createTask: vi.fn(),
  approveStage: vi.fn(),
  returnStage: vi.fn(),
  myDevelopmentWorkRequest: vi.fn(),
  myTasksRequest: vi.fn(),
  projectRequest: vi.fn(),
  tasksRequest: vi.fn(),
  myAutomationRolesRequest: vi.fn(),
  developerQueueRequest: vi.fn(),
}))
vi.mock('../../reviews/api/workApi', () => ({ reviewerWorkRequest: vi.fn() }))
const workApi = vi.mocked(await import('../../reviews/api/workApi'))
const api = vi.mocked(await import('../api/automationApi'))

const OK = { success: true, message: 'Done.', field: null }

function opportunity(overrides: Partial<Api.Opportunity> = {}): Api.Opportunity {
  return {
    id: '7',
    ideaId: '3',
    ideaTitle: 'Tax collection',
    title: 'Tax collection',
    summary: '',
    problemStatement: '',
    automationGoal: '',
    expectedBenefit: '',
    priority: 'high',
    status: 'ready_for_assignment',
    submissionContext: 'individual',
    ownerName: 'Owner Test',
    tenantName: null,
    approvedAt: null,
    readyAt: '2026-10-16T10:00:00Z',
    createdAt: '2026-10-16T10:00:00Z',
    updatedAt: '2026-10-16T10:00:00Z',
    capabilities: { canManageRequirements: false, canEditSolution: false, canTransition: false },
    ...overrides,
  }
}

function project(overrides: Partial<Api.Project> = {}): Api.Project {
  return {
    id: '9',
    opportunityId: '7',
    ideaId: '3',
    title: 'Tax collection',
    description: '',
    status: 'planning',
    submissionContext: 'individual',
    ownerName: 'Owner Test',
    tenantName: null,
    assignedName: 'Dana Developer',
    startDate: null,
    targetDate: '2027-01-29',
    completedAt: null,
    progress: {
      stages: [],
      taskCompletionPercent: null,
      tasksTotal: 0,
      tasksDone: 0,
      tasksBlocked: 0,
    },
    capabilities: { canManage: true, canPerformUat: false, canRecordImpact: false },
    ...overrides,
  }
}

function plan(overrides: Partial<Api.ImplementationPlan> = {}): Api.ImplementationPlan {
  return {
    id: '1',
    projectId: '9',
    approach: '',
    architecture: '',
    technology: '',
    integrations: '',
    environments: '',
    testingStrategy: '',
    risks: '',
    status: 'draft',
    reviewFeedback: '',
    submittedByName: null,
    submittedAt: null,
    decidedByName: null,
    decidedAt: null,
    updatedAt: '2026-10-16T10:00:00Z',
    missing: [],
    canEdit: false,
    canSubmit: false,
    canDecide: false,
    ...overrides,
  }
}

function stage(overrides: Partial<Api.Stage> = {}, status = 'pending'): Api.Stage {
  return {
    milestone: {
      id: '21',
      projectId: '9',
      title: 'Import and matching',
      description: '',
      dueDate: '2026-11-30',
      status,
      completedAt: null,
    },
    reports: [],
    canReport: false,
    canDecide: false,
    tasksTotal: 0,
    tasksDone: 0,
    ...overrides,
  }
}

function desk(overrides: Partial<Api.DeliveryDesk> = {}): Api.DeliveryDesk {
  return {
    canManage: true,
    toAssign: [],
    plans: [],
    stages: [],
    projects: [],
    developers: [{ id: '5', name: 'Dana Developer', email: 'dana@example.com', activeProjects: 1 }],
    ...overrides,
  }
}

const renderIn = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  api.adminOpportunitiesRequest.mockResolvedValue([opportunity()])
  api.projectStagesRequest.mockResolvedValue([])
  api.tasksRequest.mockResolvedValue([])
})

describe('the delivery desk', () => {
  it('assigns a developer, with dates, to an opportunity the owner went ahead with', async () => {
    api.deliveryDeskRequest.mockResolvedValue(desk({ toAssign: [opportunity()] }))
    api.assignDeveloper.mockResolvedValue({ ...OK, project: project() })
    renderIn(<AdminAutomationPage />)

    const form = await screen.findByRole('form', { name: 'Assign Tax collection' })
    expect(
      within(form).getByRole('option', { name: /Dana Developer - 1 active project/ }),
    ).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Developer'), { target: { value: '5' } })
    fireEvent.change(within(form).getByLabelText('Target date'), {
      target: { value: '2027-01-29' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Assign' }))

    await waitFor(() =>
      expect(api.assignDeveloper).toHaveBeenCalledWith({
        opportunityId: '7',
        developerId: '5',
        startDate: null,
        targetDate: '2027-01-29',
      }),
    )
    expect(
      await screen.findByText(/Dana Developer is assigned to “Tax collection”/),
    ).toBeInTheDocument()
  })

  it('lists plans to approve, and lets a stage be approved where it is listed', async () => {
    const reported = stage(
      {
        canDecide: true,
        reports: [
          {
            id: '4',
            milestoneId: '21',
            authorName: 'Dana Developer',
            summary: 'Import runs nightly.',
            decision: 'pending',
            feedback: '',
            decidedByName: null,
            decidedAt: null,
            createdAt: '2026-11-20T10:00:00Z',
          },
        ],
      },
      'submitted',
    )
    api.deliveryDeskRequest.mockResolvedValue(
      desk({
        plans: [
          {
            project: project(),
            plan: plan({
              status: 'submitted',
              submittedByName: 'Dana Developer',
              submittedAt: '2026-10-20T10:00:00Z',
            }),
          },
        ],
        stages: [{ project: project({ status: 'active' }), stage: reported }],
      }),
    )
    api.approveStage.mockResolvedValue({ ...OK, stage: reported })
    renderIn(<AdminAutomationPage />)

    expect(await screen.findByRole('link', { name: 'Review plan' })).toHaveAttribute(
      'href',
      '/app/automation/projects/9?tab=plan',
    )
    expect(screen.getByText('Import runs nightly.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Approve stage' }))

    await waitFor(() =>
      expect(api.approveStage).toHaveBeenCalledWith({ milestoneId: '21', feedback: '' }),
    )
    // The approval is seen to happen: a confirmation in its place, the stage gone from the
    // waiting list (even before the reload lands), and a message at the top of the desk.
    const decided = within(await screen.findByRole('list', { name: 'Decided just now' }))
    expect(decided.getByText('Stage approved')).toBeInTheDocument()
    expect(
      decided.getByText(/“Import and matching” on Tax collection is approved/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve stage' })).toBeNull()
    expect(screen.getByText('Nothing else is waiting for your approval.')).toBeInTheDocument()
    expect(
      screen.getByText(/Stage approved: “Import and matching” on Tax collection/),
    ).toBeInTheDocument()

    fireEvent.click(decided.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('list', { name: 'Decided just now' })).toBeNull()
  })

  it('shows each project’s plan and stage progress, and opens its stages marked', async () => {
    const milestone = (id: string, title: string, status: string, dueDate: string | null) => ({
      id,
      projectId: '9',
      title,
      description: '',
      dueDate,
      status,
      completedAt: status === 'completed' ? '2026-10-20T10:00:00Z' : null,
    })
    const report = (decision: 'approved' | 'pending' | 'returned', summary: string) => ({
      id: summary,
      milestoneId: '21',
      authorName: 'Dana Developer',
      summary,
      decision,
      feedback: decision === 'returned' ? 'Handle duplicates.' : '',
      decidedByName: decision === 'pending' ? null : 'Mia Manager',
      decidedAt: decision === 'pending' ? null : '2026-10-20T10:00:00Z',
      createdAt: '2026-10-19T10:00:00Z',
    })
    const stages: Api.Stage[] = [
      {
        ...stage(),
        milestone: milestone('21', 'Requirements', 'completed', '2026-10-20'),
        reports: [report('approved', 'Signed off.')],
        tasksTotal: 3,
        tasksDone: 3,
      },
      {
        ...stage(),
        milestone: milestone('22', 'Backend', 'submitted', '2026-10-29'),
        reports: [report('pending', 'API and models done.')],
        canDecide: true,
      },
      { ...stage(), milestone: milestone('23', 'Frontend', 'returned', '2000-01-01') },
      { ...stage(), milestone: milestone('24', 'Release', 'pending', null) },
    ]
    api.deliveryDeskRequest.mockResolvedValue(
      desk({
        projects: [
          {
            project: project({ status: 'active' }),
            planStatus: 'approved',
            stagesTotal: 4,
            stagesApproved: 1,
            stagesWaiting: 1,
            stages,
          },
        ],
      }),
    )
    api.approveStage.mockResolvedValue({ ...OK, stage: stages[1] })
    renderIn(<AdminAutomationPage />)

    const table = await screen.findByRole('table', { name: 'Projects in delivery' })
    expect(within(table).getByText('Approved')).toBeInTheDocument()
    expect(within(table).getByText('1 of 4 approved')).toBeInTheDocument()
    expect(within(table).getByText('1 waiting for you')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Stages' })).toBeNull()

    fireEvent.click(
      within(table).getByRole('button', { name: 'Show the stages of Tax collection' }),
    )
    const timeline = within(screen.getByRole('list', { name: 'Stages' }))
    const item = (name: string) => within(timeline.getByRole('listitem', { name }))
    expect(item('Stage 1: Requirements').getByText('Approved')).toBeInTheDocument()
    expect(item('Stage 1: Requirements').getByText(/Approved by Mia Manager/)).toBeInTheDocument()
    expect(item('Stage 1: Requirements').getByText('3 of 3 tasks done')).toBeInTheDocument()
    expect(item('Stage 2: Backend').getByText('Waiting for your approval')).toBeInTheDocument()
    expect(item('Stage 2: Backend').getByText('API and models done.')).toBeInTheDocument()
    expect(item('Stage 3: Frontend').getByText('Sent back to the developer')).toBeInTheDocument()
    expect(item('Stage 3: Frontend').getByText('Overdue')).toBeInTheDocument()
    expect(item('Stage 4: Release').getByText('Not started')).toBeInTheDocument()

    // A stage waiting on the manager is decided right on the timeline.
    fireEvent.click(item('Stage 2: Backend').getByRole('button', { name: 'Approve stage' }))
    await waitFor(() =>
      expect(api.approveStage).toHaveBeenCalledWith({ milestoneId: '22', feedback: '' }),
    )
    expect(await item('Stage 2: Backend').findByText('✓ Just approved')).toBeInTheDocument()
  })

  it('does not break on a desk loaded without stages', async () => {
    api.deliveryDeskRequest.mockResolvedValue(
      desk({
        projects: [
          {
            project: project({ status: 'active' }),
            planStatus: 'approved',
            stagesTotal: 0,
            stagesApproved: 0,
            stagesWaiting: 0,
          } as unknown as Api.DeskProject,
        ],
      }),
    )
    renderIn(<AdminAutomationPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Show the stages of Tax collection' }),
    )
    expect(screen.getByText(/No stages yet/)).toBeInTheDocument()
  })

  it('tells an administrator without the delivery manager role how to get it', async () => {
    api.deliveryDeskRequest.mockResolvedValue(desk({ canManage: false, developers: [] }))
    renderIn(<AdminAutomationPage />)

    expect(await screen.findByText(/needs the/)).toHaveTextContent('Delivery manager')
    expect(screen.queryByRole('heading', { name: 'Assign a developer' })).toBeNull()
    expect(
      await screen.findByRole('table', { name: 'Automation opportunities' }),
    ).toBeInTheDocument()
  })
})

describe('the implementation plan', () => {
  it('lets the developer write it, add stages and submit it', async () => {
    api.implementationPlanRequest.mockResolvedValue(
      plan({
        canEdit: true,
        canSubmit: true,
        approach: 'Nightly import.',
        technology: 'Django.',
        testingStrategy: 'Unit tests.',
      }),
    )
    api.projectStagesRequest.mockResolvedValue([stage()])
    api.updateImplementationPlan.mockResolvedValue({ ...OK, plan: plan() })
    api.addStage.mockResolvedValue({ ...OK, stage: stage() })
    api.submitImplementationPlan.mockResolvedValue({ ...OK, plan: plan({ status: 'submitted' }) })
    renderIn(<PlanTab project={project()} onChanged={() => undefined} />)

    const form = await screen.findByRole('form', { name: 'Implementation plan' })
    fireEvent.change(within(form).getByLabelText(/^Architecture and components/), {
      target: { value: 'A service and a dashboard.' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Save plan' }))
    await waitFor(() =>
      expect(api.updateImplementationPlan).toHaveBeenCalledWith({
        input: expect.objectContaining({
          projectId: '9',
          approach: 'Nightly import.',
          architecture: 'A service and a dashboard.',
        }),
      }),
    )

    const add = screen.getByRole('form', { name: 'Add a stage' })
    fireEvent.change(within(add).getByLabelText('Stage title'), { target: { value: 'Dashboard' } })
    fireEvent.change(within(add).getByLabelText('Due date'), { target: { value: '2026-12-15' } })
    fireEvent.click(within(add).getByRole('button', { name: 'Add stage' }))
    await waitFor(() =>
      expect(api.addStage).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: '9', title: 'Dashboard', dueDate: '2026-12-15' }),
      ),
    )

    // Submitting goes through the preview.
    fireEvent.click(screen.getByRole('button', { name: 'Preview and submit' }))
    const preview = within(screen.getByRole('dialog', { name: 'Tax collection' }))
    fireEvent.click(preview.getByRole('button', { name: 'Submit for approval' }))
    await waitFor(() =>
      expect(api.submitImplementationPlan).toHaveBeenCalledWith({ projectId: '9' }),
    )
  })

  it('previews the plan as the manager will read it, unsaved text included, and saves it on submit', async () => {
    api.implementationPlanRequest.mockResolvedValue(
      plan({
        canEdit: true,
        approach: 'Nightly import.',
        architecture: 'A service.',
        technology: 'Django.',
      }),
    )
    api.projectStagesRequest.mockResolvedValue([stage()])
    api.updateImplementationPlan.mockResolvedValue({ ...OK, plan: plan() })
    api.submitImplementationPlan.mockResolvedValue({ ...OK, plan: plan({ status: 'submitted' }) })
    renderIn(<PlanTab project={project()} onChanged={() => undefined} />)

    const form = await screen.findByRole('form', { name: 'Implementation plan' })
    fireEvent.change(within(form).getByLabelText(/^Testing strategy/), {
      target: { value: '- Unit tests\n- UAT with finance' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview and submit' }))

    const dialog = screen.getByRole('dialog', { name: 'Tax collection' })
    const preview = within(dialog)
    expect(preview.getByText(/Includes unsaved changes/)).toBeInTheDocument()
    expect(preview.getByText('Unit tests').tagName).toBe('LI')
    expect(preview.getByText('Import and matching')).toBeInTheDocument()
    expect(preview.getByText('The plan is complete.')).toBeInTheDocument()

    fireEvent.click(preview.getByRole('button', { name: 'Submit for approval' }))

    await waitFor(() =>
      expect(api.submitImplementationPlan).toHaveBeenCalledWith({ projectId: '9' }),
    )
    expect(api.updateImplementationPlan).toHaveBeenCalledWith({
      input: expect.objectContaining({
        projectId: '9',
        testingStrategy: '- Unit tests\n- UAT with finance',
      }),
    })
    expect(vi.mocked(api.updateImplementationPlan).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.submitImplementationPlan).mock.invocationCallOrder[0],
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('goes back to editing from the preview without submitting', async () => {
    api.implementationPlanRequest.mockResolvedValue(plan({ canEdit: true }))
    renderIn(<PlanTab project={project()} onChanged={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Preview and submit' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Back to editing' })[0],
    )

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.submitImplementationPlan).not.toHaveBeenCalled()
  })

  it('folds written sections and opens empty ones, like the proposal', async () => {
    api.implementationPlanRequest.mockResolvedValue(
      plan({ canEdit: true, approach: 'Nightly import.' }),
    )
    renderIn(<PlanTab project={project()} onChanged={() => undefined} />)

    const form = await screen.findByRole('form', { name: 'Implementation plan' })
    expect(within(form).getByText('1 of 7 sections written.')).toBeInTheDocument()
    const approach = within(form).getByRole('button', { name: /Technical approach/ })
    expect(approach).toHaveAttribute('aria-expanded', 'false')
    expect(approach).toHaveTextContent('Written ✓')
    expect(within(form).queryByLabelText(/^Technical approach/)).toBeNull()
    expect(within(form).getByLabelText(/^Architecture and components/)).toBeInTheDocument()

    fireEvent.click(approach)
    expect(within(form).getByLabelText(/^Technical approach/)).toHaveValue('Nightly import.')

    fireEvent.click(within(form).getByRole('button', { name: 'Collapse all' }))
    expect(within(form).queryByRole('textbox')).toBeNull()
    fireEvent.click(within(form).getByRole('button', { name: 'Expand all' }))
    expect(within(form).getAllByRole('textbox')).toHaveLength(7)
  })

  it('says what is missing, marks it in the preview, and will not submit an incomplete plan', async () => {
    api.implementationPlanRequest.mockResolvedValue(
      plan({ canEdit: true, approach: 'Nightly import.', architecture: 'A service.' }),
    )
    renderIn(<PlanTab project={project()} onChanged={() => undefined} />)

    const message =
      'Before submitting, add the technology stack, testing strategy, at least one stage.'
    expect(await screen.findByText(message)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Preview and submit' }))
    const preview = within(screen.getByRole('dialog'))
    expect(preview.getAllByText(/^Not written yet/)).toHaveLength(2)
    expect(preview.getByText(/No stages yet - add at least one/)).toBeInTheDocument()
    expect(preview.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()
  })

  it('lets the delivery manager read it and approve it, which starts implementation', async () => {
    api.implementationPlanRequest.mockResolvedValue(
      plan({ status: 'submitted', canDecide: true, approach: '- Nightly import\n- Matching job' }),
    )
    api.projectStagesRequest.mockResolvedValue([stage()])
    api.approveImplementationPlan.mockResolvedValue({ ...OK, plan: plan({ status: 'approved' }) })
    renderIn(<PlanTab project={project()} onChanged={() => undefined} />)

    expect((await screen.findByText('Nightly import')).tagName).toBe('LI')
    expect(screen.getByText('Import and matching')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Approve and start implementation' }))

    await waitFor(() =>
      expect(api.approveImplementationPlan).toHaveBeenCalledWith({ projectId: '9', feedback: '' }),
    )
  })

  it('shows the delivery manager’s feedback when the plan was sent back', async () => {
    api.implementationPlanRequest.mockResolvedValue(
      plan({ status: 'changes_requested', canEdit: true, reviewFeedback: 'Add a rollback plan.' }),
    )
    renderIn(<PlanTab project={project()} onChanged={() => undefined} />)

    expect(await screen.findByText('Add a rollback plan.')).toBeInTheDocument()
    expect(screen.getByText('The delivery manager asked for changes')).toBeInTheDocument()
  })
})

describe('stages', () => {
  it('lets the developer report a stage done', async () => {
    api.projectStagesRequest.mockResolvedValue([stage({ canReport: true }, 'in_progress')])
    api.submitStage.mockResolvedValue({ ...OK, stage: stage() })
    renderIn(<StagesPanel project={project({ status: 'active' })} onChanged={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: /Import and matching/ }))
    const form = await screen.findByRole('form', { name: 'Report Import and matching' })
    fireEvent.change(within(form).getByLabelText('What was done in this stage'), {
      target: { value: 'Import runs nightly.' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Preview report' }))

    // The report as the manager will read it, before it goes.
    const preview = within(
      screen.getByRole('region', { name: 'Preview of the report on Import and matching' }),
    )
    expect(preview.getByText('Import runs nightly.')).toBeInTheDocument()
    expect(api.submitStage).not.toHaveBeenCalled()
    fireEvent.click(preview.getByRole('button', { name: 'Submit for approval' }))

    await waitFor(() =>
      expect(api.submitStage).toHaveBeenCalledWith({
        milestoneId: '21',
        summary: 'Import runs nightly.',
      }),
    )
  })

  it('goes back from the report preview to the text, keeping it', async () => {
    api.projectStagesRequest.mockResolvedValue([stage({ canReport: true }, 'in_progress')])
    renderIn(<StagesPanel project={project({ status: 'active' })} onChanged={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: /Import and matching/ }))
    const form = await screen.findByRole('form', { name: 'Report Import and matching' })
    fireEvent.change(within(form).getByLabelText('What was done in this stage'), {
      target: { value: 'Half done.' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Preview report' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit report' }))

    expect(screen.getByLabelText('What was done in this stage')).toHaveValue('Half done.')
    expect(api.submitStage).not.toHaveBeenCalled()
  })

  it('shows the manager their decision on the stage once it is taken', async () => {
    const waiting = stage(
      {
        canDecide: true,
        reports: [
          {
            id: '4',
            milestoneId: '21',
            authorName: 'Dana Developer',
            summary: 'Done.',
            decision: 'pending',
            feedback: '',
            decidedByName: null,
            decidedAt: null,
            createdAt: '2026-11-20T10:00:00Z',
          },
        ],
      },
      'submitted',
    )
    api.projectStagesRequest.mockResolvedValue([waiting])
    api.returnStage.mockResolvedValue({ ...OK, stage: waiting })
    renderIn(<StagesPanel project={project({ status: 'active' })} onChanged={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: /Import and matching/ }))
    fireEvent.change(screen.getByLabelText(/Feedback for the developer/), {
      target: { value: 'Handle duplicates.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }))

    expect(await screen.findByText('Stage sent back')).toBeInTheDocument()
    expect(screen.getByText(/went back to the developer with your feedback/)).toBeInTheDocument()
  })

  it('starts folded, and keeps each stage’s tasks inside it', async () => {
    api.projectStagesRequest.mockResolvedValue([
      stage({ canReport: true }, 'in_progress'),
      stage({
        milestone: {
          id: '22',
          projectId: '9',
          title: 'Dashboard',
          description: '',
          dueDate: null,
          status: 'pending',
          completedAt: null,
        },
      }),
    ])
    api.tasksRequest.mockResolvedValue([
      task({ id: '31', milestoneId: '21', title: 'Build the import', status: 'done' }),
      task({ id: '32', milestoneId: '21', title: 'Match invoices', status: 'in_progress' }),
      task({ id: '33', milestoneId: '22', title: 'Draw the charts', status: 'todo' }),
      task({ id: '34', milestoneId: null, title: 'Old loose task', status: 'todo' }),
    ])
    api.createTask.mockResolvedValue({ ...OK, task: task() })
    renderIn(<StagesPanel project={project({ status: 'active' })} onChanged={() => undefined} />)

    // Folded: one line per stage, with how many of its tasks are done.
    const importStage = await screen.findByRole('button', { name: /Import and matching/ })
    expect(importStage).toHaveAttribute('aria-expanded', 'false')
    expect(importStage).toHaveTextContent('1 of 2 tasks done')
    expect(screen.queryByText('Match invoices')).toBeNull()

    // Open: only this stage's tasks, and a task added here belongs to it.
    fireEvent.click(importStage)
    const body = within(screen.getByRole('listitem', { name: 'Stage 1: Import and matching' }))
    expect(body.getByText('Match invoices')).toBeInTheDocument()
    expect(body.queryByText('Draw the charts')).toBeNull()
    expect(body.getByText(/1 task in this stage is not done yet/)).toBeInTheDocument()
    const add = body.getByRole('form', { name: 'Add a task to this stage' })
    expect(within(add).getByRole('button', { name: 'Add' })).toBeDisabled()
    fireEvent.change(within(add).getByLabelText('New task'), {
      target: { value: 'Handle duplicates' },
    })
    fireEvent.click(within(add).getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(api.createTask).toHaveBeenCalledWith({
        projectId: '9',
        title: 'Handle duplicates',
        priority: 'medium',
        milestoneId: '21',
      }),
    )

    // A task from before stages existed is not lost.
    expect(screen.getByRole('region', { name: 'Not in a stage' })).toHaveTextContent(
      'Old loose task',
    )
  })

  it('shows progress and keeps each report with its decision', async () => {
    api.projectStagesRequest.mockResolvedValue([
      stage(
        {
          reports: [
            {
              id: '4',
              milestoneId: '21',
              authorName: 'Dana Developer',
              summary: 'First go.',
              decision: 'returned',
              feedback: 'Handle duplicates.',
              decidedByName: 'Mia Manager',
              decidedAt: '2026-11-21T10:00:00Z',
              createdAt: '2026-11-20T10:00:00Z',
            },
          ],
        },
        'returned',
      ),
    ])
    renderIn(<StagesPanel project={project({ status: 'active' })} onChanged={() => undefined} />)

    expect(await screen.findByText('0 of 1 stages approved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Import and matching/ }))
    const history = screen.getByRole('list', { name: 'Reports' })
    expect(history).toHaveTextContent('Sent back')
    expect(history).toHaveTextContent('Mia Manager: Handle duplicates.')
  })
})

function work(overrides: Partial<Api.DevelopmentWorkItem> = {}): Api.DevelopmentWorkItem {
  return {
    project: project(),
    planStatus: 'draft',
    stagesTotal: 0,
    stagesApproved: 0,
    stagesWaiting: 0,
    nextAction: 'Write the implementation plan',
    nextTab: 'plan',
    needsMe: true,
    ...overrides,
  }
}

const DEVELOPER: Api.AutomationRoles = {
  isDeveloper: true,
  isDeliveryManager: false,
  isReviewer: true,
}

function task(overrides: Partial<Api.Task> = {}): Api.Task {
  return {
    id: '31',
    projectId: '9',
    milestoneId: '21',
    title: 'Build the import',
    description: '',
    status: 'in_progress',
    priority: 'medium',
    dueDate: '2026-11-15',
    ...overrides,
  }
}

/** The workspace inside the layout, as the router draws it. */
function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/app/automation/workspace']}>
      <Routes>
        <Route path="/app/automation" element={<AutomationLayout />}>
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="workspace/:projectId" element={<WorkspacePage />} />
          <Route path="review-queue" element={<p>review queue page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const tabNames = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)

describe('the developer’s workspace', () => {
  beforeEach(() => {
    window.localStorage.clear()
    api.myAutomationRolesRequest.mockResolvedValue(DEVELOPER)
    api.myTasksRequest.mockResolvedValue([
      { task: task(), projectId: '9', projectTitle: 'Tax collection', stageTitle: 'Import' },
    ])
    api.developerQueueRequest.mockResolvedValue([opportunity({ id: '8', title: 'Payroll' })])
    workApi.reviewerWorkRequest.mockResolvedValue({
      steps: [],
      items: [
        {
          ideaId: '4',
          title: 'Leave requests',
          ownerLabel: 'Ada',
          stage: 'review',
          stageLabel: 'In review',
          step: 0,
          needsMe: true,
          actionLabel: 'Review the idea',
          actionPath: '/app/reviews',
          teamName: null,
          isLead: false,
          updatedAt: '2026-10-16T10:00:00Z',
        },
      ],
    })
  })

  it('lists projects closed to their titles, and opens one at a time beneath its title', async () => {
    api.myDevelopmentWorkRequest.mockResolvedValue([
      work(),
      work({
        project: project({ id: '10', title: 'Payroll', status: 'active' }),
        planStatus: 'approved',
        stagesTotal: 3,
        stagesApproved: 1,
        stagesWaiting: 1,
        nextAction: 'Waiting for approval: Import',
        nextTab: 'work',
        needsMe: false,
      }),
    ])
    api.projectRequest.mockImplementation(async (id: string) =>
      id === '10' ? project({ id: '10', title: 'Payroll', status: 'active' }) : project(),
    )
    api.implementationPlanRequest.mockResolvedValue(plan({ canEdit: true }))
    api.projectStagesRequest.mockResolvedValue([])
    api.tasksRequest.mockResolvedValue([])
    renderWorkspace()

    // Closed: only titles (and who needs the developer).
    const taxRow = await screen.findByRole('button', { name: /Tax collection/ })
    const payrollRow = screen.getByRole('button', { name: /Payroll/ })
    expect(screen.getByRole('heading', { name: /My projects/ })).toHaveTextContent('2')
    expect(screen.getByText('1 needs you')).toBeInTheDocument()
    expect(taxRow).toHaveAttribute('aria-expanded', 'false')
    expect(taxRow).toHaveTextContent('Needs you')
    expect(screen.queryByText('Write the implementation plan')).toBeNull()

    // Open: the next step and the whole project, on the tab of that step - inside Workspace.
    fireEvent.click(taxRow)
    expect(taxRow).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('Write the implementation plan')).toBeInTheDocument()
    expect(await screen.findByRole('form', { name: 'Implementation plan' })).toBeInTheDocument()

    // The project's facts stay out of the way of the plan until asked for.
    const details = screen.getByRole('button', { name: 'Project details' })
    expect(details).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Project details' })).toBeNull()
    fireEvent.click(details)
    expect(screen.getByRole('region', { name: 'Project details' })).toHaveTextContent(
      'Dana Developer',
    )
    fireEvent.click(details)
    expect(screen.queryByRole('region', { name: 'Project details' })).toBeNull()
    expect(screen.getByRole('form', { name: 'Implementation plan' })).toBeInTheDocument()

    const nav = screen.getByRole('navigation', { name: 'Automation' })
    expect(within(nav).getByRole('link', { name: 'Workspace' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Opening another closes the first: one project at a time.
    fireEvent.click(payrollRow)
    await waitFor(() => expect(taxRow).toHaveAttribute('aria-expanded', 'false'))
    expect(payrollRow).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('Waiting for approval: Import')).toBeInTheDocument()

    // Closing it leaves only the titles.
    fireEvent.click(payrollRow)
    await waitFor(() => expect(payrollRow).toHaveAttribute('aria-expanded', 'false'))
    expect(screen.queryByText('Waiting for approval: Import')).toBeNull()
    // What the tabs above already show is not repeated here.
    expect(screen.queryByRole('region', { name: 'My tasks' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Developer queue' })).toBeNull()
  })

  it('opens straight onto a project from an "Open and do it" link', async () => {
    api.myDevelopmentWorkRequest.mockResolvedValue([work()])
    api.projectRequest.mockResolvedValue(project())
    api.implementationPlanRequest.mockResolvedValue(plan({ canEdit: true }))
    api.projectStagesRequest.mockResolvedValue([])
    render(
      <MemoryRouter initialEntries={['/app/automation/workspace/9?tab=plan']}>
        <Routes>
          <Route path="/app/automation" element={<AutomationLayout />}>
            <Route path="workspace/:projectId" element={<WorkspacePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: /Tax collection/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(await screen.findByRole('form', { name: 'Implementation plan' })).toBeInTheDocument()
  })

  it('lets someone who is both switch between developer and reviewer, and remembers it', async () => {
    api.myDevelopmentWorkRequest.mockResolvedValue([])
    renderWorkspace()

    const nav = await screen.findByRole('navigation', { name: 'Automation' })
    const modes = within(await screen.findByRole('group', { name: 'Work as' }))
    expect(modes.getByRole('button', { name: 'Developer' })).toHaveAttribute('aria-pressed', 'true')
    expect(tabNames(nav)).toEqual(['Workspace', 'My tasks', 'Developer queue', 'Projects'])
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your delivery workspace')

    fireEvent.click(modes.getByRole('button', { name: 'Reviewer' }))

    expect(await screen.findByText('review queue page')).toBeInTheDocument()
    expect(tabNames(nav)).toEqual(['Review queue', 'Opportunities', 'Projects'])
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your review queue')
    expect(window.localStorage.getItem('automation-mode')).toBe('reviewer')
  })

  it('shows an idea owner only the browsing tabs', async () => {
    api.myAutomationRolesRequest.mockResolvedValue({
      isDeveloper: false,
      isDeliveryManager: false,
      isReviewer: false,
    })
    api.myDevelopmentWorkRequest.mockResolvedValue([])
    renderWorkspace()

    const nav = await screen.findByRole('navigation', { name: 'Automation' })
    await waitFor(() => expect(tabNames(nav)).toEqual(['Opportunities', 'Projects']))
    expect(screen.queryByRole('group', { name: 'Work as' })).toBeNull()
  })

  it('treats a delivery manager as an ordinary user here, pointing to the admin desk', async () => {
    api.myAutomationRolesRequest.mockResolvedValue({
      isDeveloper: false,
      isDeliveryManager: true,
      isReviewer: false,
    })
    api.myDevelopmentWorkRequest.mockResolvedValue([])
    renderWorkspace()

    const nav = await screen.findByRole('navigation', { name: 'Automation' })
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Open the delivery desk' })).toHaveAttribute(
        'href',
        '/app/admin/automation',
      ),
    )
    expect(tabNames(nav)).toEqual(['Opportunities', 'Projects'])
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your ideas in delivery')
    expect(screen.queryByText('Delivery manager', { selector: 'span' })).toBeNull()
  })

  it('says plainly when nothing is assigned', async () => {
    api.myDevelopmentWorkRequest.mockResolvedValue([])
    renderWorkspace()

    expect(await screen.findByText('No project is assigned to you yet.')).toBeInTheDocument()
  })

  it('lands on the page of the job the person does, honouring their last choice', async () => {
    const routes = (
      <Routes>
        <Route path="/" element={<AutomationHome />} />
        <Route path="/workspace" element={<p>workspace page</p>} />
        <Route path="/review-queue" element={<p>review queue page</p>} />
        <Route path="/opportunities" element={<p>opportunities page</p>} />
      </Routes>
    )
    const { unmount } = renderIn(routes)
    expect(await screen.findByText('workspace page')).toBeInTheDocument()
    unmount()

    window.localStorage.setItem('automation-mode', 'reviewer')
    const second = renderIn(routes)
    expect(await screen.findByText('review queue page')).toBeInTheDocument()
    second.unmount()

    api.myAutomationRolesRequest.mockResolvedValue({
      isDeveloper: false,
      isDeliveryManager: true,
      isReviewer: false,
    })
    renderIn(routes)
    expect(await screen.findByText('opportunities page')).toBeInTheDocument()
  })

  it('lists my tasks by project and changes a status in place', async () => {
    api.updateTask.mockResolvedValue({ ...OK, task: task({ status: 'done' }) })
    renderIn(<MyTasksPage />)

    const group = await screen.findByRole('region', { name: 'Tax collection' })
    expect(within(group).getByText('Stage: Import')).toBeInTheDocument()
    fireEvent.change(within(group).getByLabelText('Status of Build the import'), {
      target: { value: 'done' },
    })

    await waitFor(() =>
      expect(api.updateTask).toHaveBeenCalledWith({ input: { id: '31', status: 'done' } }),
    )
  })

  it('appears on a reviewer’s My work only when they have development work', async () => {
    api.myDevelopmentWorkRequest.mockResolvedValue([work()])
    const { unmount } = renderIn(<DevelopmentWorkSection />)
    expect(await screen.findByRole('heading', { name: '1 project needs you' })).toBeInTheDocument()
    // Opening it goes to the project inside the workspace, not to the Projects list.
    expect(screen.getByRole('link', { name: 'Open and do it' })).toHaveAttribute(
      'href',
      '/app/automation/workspace/9?tab=plan',
    )
    unmount()

    api.myDevelopmentWorkRequest.mockResolvedValue([])
    const { container } = renderIn(<DevelopmentWorkSection />)
    await waitFor(() => expect(api.myDevelopmentWorkRequest).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
